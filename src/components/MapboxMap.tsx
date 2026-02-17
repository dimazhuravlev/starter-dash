import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useDirectionsRoute, emptyRouteGeoJSON, type RoutePathCoord } from '../hooks/useDirectionsRoute'
import restaurantIconUrl from '../assets/Restourant.svg'

const DEFAULT_CENTER: [number, number] = [30.3125, 59.965]
const DEFAULT_ZOOM = 13
const FOCUS_ZOOM = 16
const FLY_DURATION_MS = 1200
const FIT_BOUNDS_PADDING_PX = 80
const FIT_BOUNDS_DURATION_MS = 800
/** При зуме ≤ этого значения показываем только точку 12px без подписи */
const ZOOM_COMPACT_THRESHOLD = 12
const MARKER_OFFSET_FULL = 10
const MARKER_OFFSET_COMPACT = 6

function getMapboxToken(): string | undefined {
  const fromEnv = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined)?.trim()
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined') {
    const fromWindow = (window as { __MAPBOX_ACCESS_TOKEN__?: string }).__MAPBOX_ACCESS_TOKEN__?.trim()
    if (fromWindow) return fromWindow
  }
  return undefined
}
const mapboxToken = getMapboxToken()

export type MapMarkerItem = {
  id: string
  lng: number
  lat: number
  address: string
  isOverdue: boolean
  /** Порядковый номер в маршруте (1, 2, 3) — показывается внутри круга */
  routePosition?: number
}

export type MapFocusBounds = { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } }

const ROUTE_PULSE_DURATION_MS = 1500

type MapboxMapProps = {
  markers?: MapMarkerItem[]
  /** Координаты ресторана (точка, из которой доставляются заказы). Если заданы — отображается маркер. */
  restaurantCoords?: { lat: number; lng: number } | null
  /** Ordered coords for driving route (2+ to show route). When null or length < 2, route is hidden. */
  routePathCoords?: RoutePathCoord[] | null
  /** Маршрут в режиме черновика — линия пульсирует (opacity 1 → 0.6 → 1) */
  isRouteDraft?: boolean
  focusCoords?: { lat: number; lng: number } | null
  focusBounds?: MapFocusBounds | null
  onClearFocus?: () => void
}

/** Убирает тип улицы в начале адреса (ул., наб., пер., пр. и т.д.) для подписи под маркером */
function shortenAddressForLabel(address: string): string {
  return address
    .replace(
      /^\s*(ул\.?|улица|наб\.?|набережная|пер\.?|переулок|пр\.?|пр-т|проспект|ш\.?|шоссе|б-р|бульвар|туп\.?|тупик|пл\.?|площадь|линия|тракт|проезд|ал\.?|аллея)\s+/i,
      '',
    )
    .trim()
}

function createMarkerElement(marker: MapMarkerItem): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'mapbox-order-marker'
  wrap.setAttribute('aria-hidden', 'true')
  const dot = document.createElement('span')
  dot.className = 'mapbox-order-marker__dot'
  if (marker.isOverdue) dot.classList.add('mapbox-order-marker__dot--overdue')
  if (marker.routePosition != null) {
    const num = document.createElement('span')
    num.className = 'mapbox-order-marker__num'
    num.textContent = String(marker.routePosition)
    dot.appendChild(num)
  }
  const label = document.createElement('span')
  label.className = 'mapbox-order-marker__label'
  label.textContent = shortenAddressForLabel(marker.address)
  wrap.appendChild(dot)
  wrap.appendChild(label)
  return wrap
}

function createRestaurantMarkerElement(): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'mapbox-restaurant-marker'
  wrap.setAttribute('aria-hidden', 'true')
  const icon = document.createElement('img')
  icon.className = 'mapbox-restaurant-marker__icon'
  icon.src = restaurantIconUrl
  icon.width = 16
  icon.height = 16
  icon.alt = ''
  wrap.appendChild(icon)
  return wrap
}

function updateMarkersByZoom(map: mapboxgl.Map, markerInstances: mapboxgl.Marker[]) {
  const zoom = map.getZoom()
  const isCompact = zoom <= ZOOM_COMPACT_THRESHOLD
  const offsetY = isCompact ? MARKER_OFFSET_COMPACT : MARKER_OFFSET_FULL
  markerInstances.forEach((m) => {
    const el = m.getElement()
    if (!el) return
    if (isCompact) {
      el.classList.add('mapbox-order-marker--compact')
    } else {
      el.classList.remove('mapbox-order-marker--compact')
    }
    m.setOffset([0, offsetY])
  })
}

function updateRestaurantMarkerByZoom(map: mapboxgl.Map, marker: mapboxgl.Marker | null) {
  if (!marker) return
  const el = marker.getElement()
  if (!el) return
  const isCompact = map.getZoom() <= ZOOM_COMPACT_THRESHOLD
  if (isCompact) {
    el.classList.add('mapbox-restaurant-marker--compact')
  } else {
    el.classList.remove('mapbox-restaurant-marker--compact')
  }
}

export function MapboxMap({
  markers = [],
  restaurantCoords = null,
  routePathCoords = null,
  isRouteDraft = false,
  focusCoords,
  focusBounds,
  onClearFocus,
}: MapboxMapProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const initializedRef = useRef(false)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const restaurantMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const onClearFocusRef = useRef(onClearFocus)
  useEffect(() => {
    onClearFocusRef.current = onClearFocus
  }, [onClearFocus])

  useEffect(() => {
    if (!mapboxToken) {
      return
    }

    const container = containerRef.current
    if (!container || initializedRef.current) {
      return
    }

    initializedRef.current = true
    mapboxgl.accessToken = mapboxToken

    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    })

    mapRef.current = map

    let resizeRafId: number | null = null
    const onResize = () => {
      if (resizeRafId !== null) return
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null
        map.resize()
      })
    }
    map.on('load', () => {
      onResize()
      if (!map.getSource('route')) {
        map.addSource('route', {
          type: 'geojson',
          data: emptyRouteGeoJSON(),
        })
      }
      if (!map.getLayer('route-line')) {
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#03AB00',
            'line-width': 3,
            'line-dasharray': [1.5, 2],
          },
        })
      }
      setMapReady(true)
    })

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
      map.remove()
      mapRef.current = null
      initializedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!focusCoords || !mapRef.current) return
    const map = mapRef.current
    let cancelled = false
    const center: [number, number] = [focusCoords.lng, focusCoords.lat]
    map.flyTo({
      center,
      zoom: FOCUS_ZOOM,
      duration: FLY_DURATION_MS,
      curve: 0.35,
      essential: true,
    })
    const onMoveEnd = () => {
      if (!cancelled) onClearFocusRef.current?.()
    }
    map.once('moveend', onMoveEnd)
    return () => {
      cancelled = true
      map.off('moveend', onMoveEnd)
    }
  }, [focusCoords])

  useEffect(() => {
    if (!focusBounds || !mapRef.current) return
    const map = mapRef.current
    let cancelled = false
    const [[swLng, swLat], [neLng, neLat]] = [
      [focusBounds.sw.lng, focusBounds.sw.lat],
      [focusBounds.ne.lng, focusBounds.ne.lat],
    ]
    map.fitBounds(
      [
        [swLng, swLat],
        [neLng, neLat],
      ],
      { padding: FIT_BOUNDS_PADDING_PX, duration: FIT_BOUNDS_DURATION_MS, maxZoom: 16 },
    )
    const onMoveEnd = () => {
      if (!cancelled) onClearFocusRef.current?.()
    }
    map.once('moveend', onMoveEnd)
    return () => {
      cancelled = true
      map.off('moveend', onMoveEnd)
    }
  }, [focusBounds])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    markers.forEach((marker) => {
      const el = createMarkerElement(marker)
      const mapMarker = new mapboxgl.Marker({ element: el, anchor: 'top' })
        .setLngLat([marker.lng, marker.lat])
        .setOffset([0, MARKER_OFFSET_FULL])
        .addTo(map)
      markersRef.current.push(mapMarker)
    })
    updateMarkersByZoom(map, markersRef.current)
    const onZoomEnd = () => updateMarkersByZoom(map, markersRef.current)
    map.on('zoomend', onZoomEnd)
    return () => {
      map.off('zoomend', onZoomEnd)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [markers, mapReady])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    restaurantMarkerRef.current?.remove()
    restaurantMarkerRef.current = null
    if (restaurantCoords) {
      const el = createRestaurantMarkerElement()
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([restaurantCoords.lng, restaurantCoords.lat])
        .addTo(map)
      restaurantMarkerRef.current = marker
      updateRestaurantMarkerByZoom(map, marker)
      const onZoomEnd = () => updateRestaurantMarkerByZoom(map, restaurantMarkerRef.current)
      map.on('zoomend', onZoomEnd)
      return () => {
        map.off('zoomend', onZoomEnd)
        restaurantMarkerRef.current?.remove()
        restaurantMarkerRef.current = null
      }
    }
    return () => {
      restaurantMarkerRef.current?.remove()
      restaurantMarkerRef.current = null
    }
  }, [mapReady, restaurantCoords])

  useDirectionsRoute({
    mapRef,
    mapReady,
    routePathCoords: routePathCoords ?? null,
    accessToken: mapboxToken ?? undefined,
  })

  useEffect(() => {
    if (!mapRef.current || !mapReady || !mapRef.current.getLayer('route-line')) return
    const map = mapRef.current
    if (!isRouteDraft) {
      map.setPaintProperty('route-line', 'line-opacity', 1)
      return
    }
    const startTime = performance.now()
    let rafId: number
    const tick = () => {
      const elapsed = performance.now() - startTime
      const t = (elapsed / ROUTE_PULSE_DURATION_MS) * 2 * Math.PI
      const opacity = 0.7 + 0.3 * Math.cos(t)
      map.setPaintProperty('route-line', 'line-opacity', opacity)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      map.setPaintProperty('route-line', 'line-opacity', 1)
    }
  }, [mapReady, isRouteDraft])

  if (!mapboxToken) {
    return (
      <div className="mapbox-map-container mapbox-map-placeholder" aria-label="Map">
        <p>Для карты нужен Mapbox-токен.</p>
        <p className="mapbox-map-placeholder-hint">
          Локально: <code>VITE_MAPBOX_ACCESS_TOKEN</code> в <code>.env</code>. На деплое: переменная окружения при сборке или <code>window.__MAPBOX_ACCESS_TOKEN__</code> в HTML до загрузки приложения.
        </p>
        <p className="mapbox-map-placeholder-hint">
          <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer">
            Получить токен →
          </a>
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mapbox-map-container"
      aria-label="Map"
    />
  )
}
