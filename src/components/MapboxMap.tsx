import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useDirectionsRoute, emptyRouteGeoJSON, type RoutePathCoord } from '../hooks/useDirectionsRoute'
import restaurantIconUrl from '../assets/Restourant.svg'
import fullMapIconUrl from '../assets/Full map.svg'
import halfMapIconUrl from '../assets/Half map.svg'
import noMapIconUrl from '../assets/No map.svg'
import arrowLeftIconUrl from '../assets/Arrow-left.svg'

const DEFAULT_CENTER: [number, number] = [30.3125, 59.965]
const DEFAULT_ZOOM = 13
const FOCUS_ZOOM = 15
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
/** Длительность одного цикла «пробега» свечения по линии (мс) */
const ROUTE_GLOW_CYCLE_MS = 2500
/** Длительность вспышки маршрута при «Назначить» (мс) */
const ROUTE_FLASH_DURATION_MS = 800

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
  /** При клике на «Добавить в маршрут» в попапе маркера — добавить заказ в черновик (orderId) */
  onOrderAddToRoute?: (orderId: string) => void
  /** Id заказов, уже добавленных в какой-либо маршрут — для них тултип «Добавить в маршрут» не показывается */
  orderIdsInRoute?: string[]
  /** Вызывается при тапе/клике по маркеру заказа (для подсветки карточки заказа) */
  onMarkerClick?: (marker: MapMarkerItem) => void
  /** Вызывается при клике по карте (не по маркеру/попапу) — например для сброса подсветки карточки */
  onMapBackgroundClick?: () => void
  /** Триггер вспышки маршрута (например Date.now() при нажатии «Назначить») — один раз анимирует свечение линии */
  routeFlashTrigger?: number | null
  /** Режим отображения карты: полная / половина / скрыта */
  mapViewMode?: MapViewMode
  /** Вызывается при смене режима карты */
  onMapViewModeChange?: (mode: MapViewMode) => void
}

export type MapViewMode = 'full' | 'half' | 'none'

/** Убирает тип улицы в начале адреса (ул., наб., пер., пр. и т.д.) для подписи под маркером */
function shortenAddressForLabel(address: string): string {
  return address
    .replace(
      /^\s*(ул\.?|улица|наб\.?|набережная|пер\.?|переулок|пр\.?|пр-т|проспект|ш\.?|шоссе|б-р|бульвар|туп\.?|тупик|пл\.?|площадь|линия|тракт|проезд|ал\.?|аллея)\s+/i,
      '',
    )
    .trim()
}

function createMarkerElement(
  marker: MapMarkerItem,
  onMarkerClick?: (marker: MapMarkerItem) => void,
): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'mapbox-order-marker'
  wrap.setAttribute('aria-hidden', 'true')
  if (onMarkerClick) wrap.style.cursor = 'pointer'
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
  if (onMarkerClick) {
    wrap.addEventListener('click', (e) => {
      e.stopPropagation()
      onMarkerClick(marker)
    })
  }
  return wrap
}

function createMarkerPopupContent(
  orderId: string,
  onAdd: (orderId: string) => void,
  popup: mapboxgl.Popup,
): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'mapbox-marker-popup'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'mapbox-marker-popup__btn'
  btn.textContent = 'Добавить в маршрут'
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onAdd(orderId)
    popup.remove()
  })
  wrap.appendChild(btn)
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

const MAP_VIEW_MODES: { value: MapViewMode; icon: string; title: string }[] = [
  { value: 'full', icon: fullMapIconUrl, title: 'Раскрыть карту' },
  { value: 'half', icon: halfMapIconUrl, title: 'Показать карту' },
  { value: 'none', icon: noMapIconUrl, title: 'Скрыть карту' },
]

export function MapboxMap({
  markers = [],
  restaurantCoords = null,
  routePathCoords = null,
  isRouteDraft = false,
  focusCoords,
  focusBounds,
  onClearFocus,
  onOrderAddToRoute,
  orderIdsInRoute,
  onMarkerClick,
  onMapBackgroundClick,
  routeFlashTrigger,
  mapViewMode: mapViewModeProp,
  onMapViewModeChange,
}: MapboxMapProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const initializedRef = useRef(false)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const restaurantMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const popupOpenedAtRef = useRef(0)
  const initialBoundsFitDoneRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapContentHidden, setMapContentHidden] = useState(false)
  const [mapViewModeInternal, setMapViewModeInternal] = useState<MapViewMode>('half')
  const mapViewMode = mapViewModeProp ?? mapViewModeInternal
  const setMapViewMode = (mode: MapViewMode) => {
    if (mapViewModeProp == null) setMapViewModeInternal(mode)
    onMapViewModeChange?.(mode)
  }

  useEffect(() => {
    if (mapViewMode !== 'none') {
      setMapContentHidden(false)
      return
    }
    const t = window.setTimeout(() => setMapContentHidden(true), 1000)
    return () => clearTimeout(t)
  }, [mapViewMode])
  const onClearFocusRef = useRef(onClearFocus)
  const onOrderAddToRouteRef = useRef(onOrderAddToRoute)
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick)
  useEffect(() => {
    onClearFocusRef.current = onClearFocus
  }, [onClearFocus])
  useEffect(() => {
    onOrderAddToRouteRef.current = onOrderAddToRoute
  }, [onOrderAddToRoute])
  useEffect(() => {
    onMapBackgroundClickRef.current = onMapBackgroundClick
  }, [onMapBackgroundClick])

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
          lineMetrics: true,
          data: emptyRouteGeoJSON(),
        })
      }
      if (!map.getLayer('route-line-glow')) {
        map.addLayer({
          id: 'route-line-glow',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#03AB00',
            'line-width': 14,
            'line-blur': 12,
            'line-opacity': 0,
          },
        })
      }
      if (!map.getLayer('route-line')) {
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-gradient': [
              'interpolate',
              ['linear'],
              ['%', ['+', ['-', ['line-progress'], 0], 1], 1],
              0,
              '#03AB00',
              0.35,
              '#03AB00',
              0.5,
              '#ffffff',
              0.65,
              '#03AB00',
              1,
              '#03AB00',
            ],
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
    if (mapViewMode === 'none' || !focusCoords || !mapRef.current) return
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
  }, [mapViewMode, focusCoords])

  useEffect(() => {
    if (mapViewMode === 'none' || !focusBounds || !mapRef.current) return
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
  }, [mapViewMode, focusBounds])

  /* При первой загрузке карты — подогнать вид так, чтобы все заказы и ресторан влезали в область */
  useEffect(() => {
    if (!mapRef.current || !mapReady || initialBoundsFitDoneRef.current) return
    const points: [number, number][] = []
    markers.forEach((m) => points.push([m.lng, m.lat]))
    if (restaurantCoords) points.push([restaurantCoords.lng, restaurantCoords.lat])
    if (points.length < 2) {
      initialBoundsFitDoneRef.current = true
      return
    }
    const bounds = new mapboxgl.LngLatBounds()
    points.forEach((p) => bounds.extend(p))
    initialBoundsFitDoneRef.current = true
    mapRef.current.fitBounds(bounds, {
      padding: FIT_BOUNDS_PADDING_PX,
      duration: FIT_BOUNDS_DURATION_MS,
      maxZoom: 16,
    })
  }, [mapReady, markers, restaurantCoords])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const popup = new mapboxgl.Popup({ closeButton: false, className: 'mapbox-marker-popup-container' })
    popupRef.current = popup
    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      const target = e.originalEvent?.target
      if (!(target instanceof Node)) return
      const el = popup.getElement()
      if (el && el.contains(target)) return
      if (target instanceof Element && target.closest('.mapbox-order-marker')) return
      if (Date.now() - popupOpenedAtRef.current < 200) return
      popup.remove()
      onMapBackgroundClickRef.current?.()
    }
    map.on('click', onMapClick)
    return () => {
      map.off('click', onMapClick)
      popup.remove()
      popupRef.current = null
    }
  }, [mapReady])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    // Группируем по координатам, чтобы не рисовать несколько подписей в одной точке (наложение)
    const key = (lng: number, lat: number) => `${lng.toFixed(6)},${lat.toFixed(6)}`
    const byCoords = new Map<string, MapMarkerItem[]>()
    for (const m of markers) {
      const k = key(m.lng, m.lat)
      const list = byCoords.get(k) ?? []
      list.push(m)
      byCoords.set(k, list)
    }
    const orderIdsInRouteSet = orderIdsInRoute ? new Set(orderIdsInRoute) : null
    const openPopup = (m: MapMarkerItem) => {
      const popup = popupRef.current
      if (!popup || !onOrderAddToRouteRef.current) return
      if (orderIdsInRouteSet?.has(m.id)) return
      popup.setLngLat([m.lng, m.lat])
      popup.setDOMContent(
        createMarkerPopupContent(m.id, (orderId) => onOrderAddToRouteRef.current?.(orderId), popup),
      )
      popup.addTo(map)
      popupOpenedAtRef.current = Date.now()
    }
    const handleMarkerClick = (m: MapMarkerItem) => {
      if (onOrderAddToRoute && !orderIdsInRouteSet?.has(m.id)) openPopup(m)
      onMarkerClick?.(m)
    }
    byCoords.forEach((group) => {
      const marker = group[0]
      const el = createMarkerElement(
        marker,
        onOrderAddToRoute || onMarkerClick ? handleMarkerClick : undefined,
      )
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
  }, [markers, mapReady, onOrderAddToRoute, orderIdsInRoute, onMarkerClick])

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

  // Вспышка маршрута при «Назначить»: один раз анимируем свечение (opacity 0 → 0.8 → 0)
  useEffect(() => {
    if (
      routeFlashTrigger == null ||
      !mapRef.current ||
      !mapReady ||
      !mapRef.current.getLayer('route-line-glow')
    )
      return
    const map = mapRef.current
    const startTime = performance.now()
    let rafId: number
    const tick = () => {
      const elapsed = performance.now() - startTime
      if (elapsed >= ROUTE_FLASH_DURATION_MS) {
        map.setPaintProperty('route-line-glow', 'line-opacity', 0)
        return
      }
      const t = elapsed / ROUTE_FLASH_DURATION_MS
      const opacity = t < 0.35 ? (t / 0.35) * 0.6 : 0.6 * (1 - (t - 0.35) / 0.65)
      map.setPaintProperty('route-line-glow', 'line-opacity', opacity)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      if (map.getLayer('route-line-glow')) map.setPaintProperty('route-line-glow', 'line-opacity', 0)
    }
  }, [mapReady, routeFlashTrigger])

  // Анимация «пробегающего» свечения по пунктирной линии (градиент зелёный–белый–зелёный)
  useEffect(() => {
    if (!mapRef.current || !mapReady || !mapRef.current.getLayer('route-line')) return
    const map = mapRef.current
    const startTime = performance.now()
    let rafId: number
    const tick = () => {
      const elapsed = performance.now() - startTime
      const phase = (elapsed / ROUTE_GLOW_CYCLE_MS) % 1
      map.setPaintProperty('route-line', 'line-gradient', [
        'interpolate',
        ['linear'],
        ['%', ['+', ['-', ['line-progress'], phase], 1], 1],
        0,
        '#03AB00',
        0.45,
        '#03AB00',
        0.5,
        '#B8FFB7',
        0.55,
        '#03AB00',
        1,
        '#03AB00',
      ])
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [mapReady])

  const ROUTE_COLLAPSE_DURATION_MS = 300
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const hasRouteLayer = map.getLayer('route-line') != null
    const hasGlowLayer = map.getLayer('route-line-glow') != null
    if (!hasRouteLayer) return
    if (mapViewMode === 'none') {
      const startOpacity = map.getPaintProperty('route-line', 'line-opacity') as number | undefined
      const start = performance.now()
      const startVal = typeof startOpacity === 'number' ? startOpacity : 1
      let rafId: number
      const tick = () => {
        const elapsed = performance.now() - start
        const t = Math.min(elapsed / ROUTE_COLLAPSE_DURATION_MS, 1)
        const opacity = startVal * (1 - t)
        map.setPaintProperty('route-line', 'line-opacity', opacity)
        if (hasGlowLayer) map.setPaintProperty('route-line-glow', 'line-opacity', opacity * 0.6)
        if (t < 1) rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(rafId)
    }
    map.setPaintProperty('route-line', 'line-opacity', 1)
    if (hasGlowLayer) map.setPaintProperty('route-line-glow', 'line-opacity', 0)
    return undefined
  }, [mapReady, mapViewMode])

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

  const handleWrapperClick = (e: React.MouseEvent) => {
    if (mapViewMode !== 'none') return
    if ((e.target as Node) instanceof Element && (e.target as Element).closest('.mapbox-map-view-selector')) return
    onMapViewModeChange?.('half')
  }

  return (
    <div
      className={`mapbox-map-wrapper${mapViewMode === 'none' ? ' mapbox-map-wrapper--collapsed' : ''}`}
      onClick={handleWrapperClick}
      role={mapViewMode === 'none' ? 'button' : undefined}
      tabIndex={mapViewMode === 'none' ? 0 : undefined}
      onKeyDown={
        mapViewMode === 'none'
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onMapViewModeChange?.('half')
              }
            }
          : undefined
      }
      aria-label={mapViewMode === 'none' ? 'Показать карту' : undefined}
    >
      <div
        ref={containerRef}
        className={`mapbox-map-container${mapContentHidden ? ' mapbox-map-container--hidden' : ''}`}
        aria-label="Map"
      />
      <div className="mapbox-map-overlay" aria-hidden="true" />
      {mapViewMode === 'none' ? (
        <div className="mapbox-map-expand-icon" aria-hidden="true">
          <img src={arrowLeftIconUrl} alt="" width={16} height={16} />
        </div>
      ) : null}
      <div className="mapbox-map-view-selector" role="group" aria-label="Режим карты">
        {MAP_VIEW_MODES.map(({ value, icon, title }) => (
          <button
            key={value}
            type="button"
            className={`mapbox-map-view-selector__btn ${mapViewMode === value ? 'mapbox-map-view-selector__btn--active' : ''}`}
            onClick={() => setMapViewMode(value)}
            title={title}
            aria-pressed={mapViewMode === value}
            aria-label={title}
          >
            <img src={icon} alt="" width={16} height={16} />
          </button>
        ))}
      </div>
    </div>
  )
}
