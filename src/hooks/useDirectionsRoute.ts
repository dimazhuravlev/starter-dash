import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Map as MapboxMapInstance } from 'mapbox-gl'

const DIRECTIONS_PROFILE = 'mapbox/cycling'
const DEBOUNCE_MS = 250
const ROUTE_FIT_PADDING_PX = 80
const ROUTE_FIT_DURATION_MS = 600

export type RoutePathCoord = { lng: number; lat: number }

const emptyRouteGeoJSON = (): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [] },
    },
  ],
})

function buildCacheKey(coords: RoutePathCoord[]): string {
  return `${DIRECTIONS_PROFILE}|${coords.map((c) => `${c.lng},${c.lat}`).join(';')}`
}

async function fetchDirections(
  token: string,
  coords: RoutePathCoord[],
): Promise<GeoJSON.LineString | null> {
  const coordsStr = coords.map((c) => `${c.lng},${c.lat}`).join(';')
  const url = `https://api.mapbox.com/directions/v5/${DIRECTIONS_PROFILE}/${encodeURIComponent(coordsStr)}?geometries=geojson&overview=full&access_token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Directions API ${res.status}: ${text || res.statusText}`)
  }
  const data = (await res.json()) as {
    routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>
  }
  const coordsArr = data.routes?.[0]?.geometry?.coordinates
  if (!coordsArr?.length) return null
  return { type: 'LineString', coordinates: coordsArr }
}

const ROUTE_ANIMATION_DURATION_MS = 1500

function setRouteSourceData(
  map: MapboxMapInstance,
  geometry: GeoJSON.LineString | null,
): void {
  const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined
  if (!source) return
  if (!geometry || geometry.coordinates.length < 2) {
    source.setData(emptyRouteGeoJSON())
    return
  }
  source.setData({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry },
    ],
  })
}

/**
 * Находит индекс точки в coordinates, ближайшей к waypoint [lng, lat].
 */
function findClosestPointIndex(
  coordinates: [number, number][],
  waypoint: { lng: number; lat: number },
): number {
  let best = 0
  let bestDist = Infinity
  const [lng, lat] = [waypoint.lng, waypoint.lat]
  coordinates.forEach((c, i) => {
    const d = (c[0] - lng) ** 2 + (c[1] - lat) ** 2
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  })
  return best
}

/**
 * Показывает уже построенный участок (baseCoords) и анимирует только новый (от splitIndex до конца).
 * Возвращает функцию отмены анимации.
 */
function animateRouteLineExtension(
  map: MapboxMapInstance,
  fullCoords: [number, number][],
  splitIndex: number,
  durationMs: number,
): () => void {
  const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined
  if (!source || fullCoords.length < 2 || splitIndex <= 0) return () => {}

  const baseCoords = fullCoords.slice(0, splitIndex + 1)
  const newSegmentCoords = fullCoords.slice(splitIndex)
  const newSegmentLength = newSegmentCoords.length
  if (newSegmentLength < 2) {
    setRouteSourceData(map, { type: 'LineString', coordinates: baseCoords })
    return () => {}
  }

  setRouteSourceData(map, { type: 'LineString', coordinates: baseCoords })

  const startTime = performance.now()
  let rafId: number

  const fullData: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: fullCoords },
      },
    ],
  }

  const tick = (time: number) => {
    const elapsed = time - startTime
    const progress = Math.min(elapsed / durationMs, 1)
    const numNewPoints = Math.max(1, Math.round(progress * newSegmentLength))
    const partialCoords = baseCoords.concat(newSegmentCoords.slice(1, numNewPoints + 1))
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: partialCoords },
        },
      ],
    })
    if (progress < 1) {
      rafId = requestAnimationFrame(tick)
    } else {
      source.setData(fullData)
    }
  }

  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}

function fitMapToRoute(
  map: MapboxMapInstance,
  coords: RoutePathCoord[],
  padding = ROUTE_FIT_PADDING_PX,
  duration = ROUTE_FIT_DURATION_MS,
): void {
  if (coords.length < 2) return
  const bounds = new mapboxgl.LngLatBounds()
  coords.forEach((c) => bounds.extend([c.lng, c.lat]))
  map.fitBounds(bounds, { padding, duration, maxZoom: 16 })
}

type UseDirectionsRouteParams = {
  mapRef: React.RefObject<MapboxMapInstance | null>
  mapReady: boolean
  routePathCoords: RoutePathCoord[] | null
  /** Фокус на маршруте (карточка/маркер) — линию очищаем только когда false */
  showRouteFocus?: boolean
  accessToken: string | undefined
  /** При false линия маршрута показывается сразу, без анимации прорисовки (для назначенных/активных маршрутов) */
  animateLine?: boolean
}

/**
 * Fetches driving route from Mapbox Directions API and updates the map's "route" source.
 * Uses debounce and in-memory cache. Clears route when coords length < 2.
 */
export function useDirectionsRoute({
  mapRef,
  mapReady,
  routePathCoords,
  showRouteFocus = false,
  accessToken,
  animateLine = true,
}: UseDirectionsRouteParams): void {
  const cacheRef = useRef<Record<string, GeoJSON.LineString>>({})
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCoordsKeyRef = useRef<string | null>(null)
  const lastCoordsRef = useRef<RoutePathCoord[] | null>(null)
  const cancelAnimationRef = useRef<(() => void) | null>(null)
  const coordsRef = useRef<RoutePathCoord[] | null>(null)
  coordsRef.current = routePathCoords ?? null

  // Стабильный ключ: эффект перезапускается только при смене набора точек, а не при каждой перерисовке
  const routePathKey =
    routePathCoords && routePathCoords.length >= 2
      ? buildCacheKey(routePathCoords)
      : ''

  useEffect(() => {
    if (!mapReady || !mapRef.current || !accessToken?.trim()) return

    const map = mapRef.current
    const coords = coordsRef.current ?? []

    if (coords.length < 2) {
      lastCoordsKeyRef.current = null
      lastCoordsRef.current = null
      cancelAnimationRef.current?.()
      cancelAnimationRef.current = null
      if (!showRouteFocus) setRouteSourceData(map, null)
      return
    }

    const key = buildCacheKey(coords)
    const previousKey = lastCoordsKeyRef.current
    const isExtension =
      previousKey != null &&
      coords.length >= 3 &&
      buildCacheKey(coords.slice(0, -1)) === previousKey

    const apply = async () => {
      cancelAnimationRef.current?.()
      cancelAnimationRef.current = null
      const cached = cacheRef.current[key]
      if (cached) {
        if (lastCoordsKeyRef.current === key) {
          fitMapToRoute(map, coords)
          return
        }
        if (animateLine && isExtension) {
          const prevLastWaypoint = coords[coords.length - 2]
          const coordsArr = cached.coordinates as [number, number][]
          const splitIndex = findClosestPointIndex(coordsArr, prevLastWaypoint)
          cancelAnimationRef.current = animateRouteLineExtension(
            map,
            coordsArr,
            splitIndex,
            ROUTE_ANIMATION_DURATION_MS,
          )
        } else {
          setRouteSourceData(map, cached)
        }
        lastCoordsKeyRef.current = key
        lastCoordsRef.current = coords
        fitMapToRoute(map, coords)
        return
      }
      try {
        const geometry = await fetchDirections(accessToken, coords)
        if (geometry) {
          cacheRef.current[key] = geometry
          if (animateLine && isExtension) {
            const prevLastWaypoint = coords[coords.length - 2]
            const coordsArr = geometry.coordinates as [number, number][]
            const splitIndex = findClosestPointIndex(coordsArr, prevLastWaypoint)
            cancelAnimationRef.current = animateRouteLineExtension(
              map,
              coordsArr,
              splitIndex,
              ROUTE_ANIMATION_DURATION_MS,
            )
          } else {
            setRouteSourceData(map, geometry)
          }
          lastCoordsKeyRef.current = key
          lastCoordsRef.current = coords
          fitMapToRoute(map, coords)
        } else {
          setRouteSourceData(map, null)
        }
      } catch (err) {
        console.warn('[useDirectionsRoute]', err instanceof Error ? err.message : err)
        setRouteSourceData(map, null)
      }
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = null

    const hasCached = cacheRef.current[key]
    if (hasCached) {
      apply()
    } else {
      debounceTimerRef.current = setTimeout(apply, DEBOUNCE_MS)
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      cancelAnimationRef.current?.()
      cancelAnimationRef.current = null
    }
  }, [mapRef, mapReady, routePathKey, showRouteFocus, accessToken, animateLine])
}

export { emptyRouteGeoJSON, setRouteSourceData }
