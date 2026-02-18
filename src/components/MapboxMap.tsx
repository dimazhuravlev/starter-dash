import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useDirectionsRoute, emptyRouteGeoJSON, type RoutePathCoord } from '../hooks/useDirectionsRoute'
import restaurantIconUrl from '../assets/Restourant.svg'
import halfMapIconUrl from '../assets/Half map.svg'
import noMapIconUrl from '../assets/No map.svg'
import arrowLeftIconUrl from '../assets/Arrow-left.svg'
import walkingCourierIconUrl from '../assets/Walking courier.svg'
import bikeCourierIconUrl from '../assets/Bike courier.svg'
import carCourierIconUrl from '../assets/Car courier 2.svg'
import { RESTAURANT_COORDS, type CourierType } from '../model/types'

/** По умолчанию при загрузке страницы — те же параметры, что у кнопки «Ресторан» на карте */
const DEFAULT_CENTER: [number, number] = [RESTAURANT_COORDS.lng, RESTAURANT_COORDS.lat]
const FOCUS_ZOOM = 15
/** Зум при фокусе на ресторан (кнопка на карте и начальная загрузка) */
const RESTAURANT_FOCUS_ZOOM = 13
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

/** Маркер курьера на карте: иконка типа (пеший/вело/авто) 16px зелёный + подпись фамилии */
export type CourierMarkerItem = {
  id: string
  lng: number
  lat: number
  /** Фамилия курьера (без имени) для подписи под маркером */
  surname: string
  type: CourierType
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
  /** Маркеры курьеров на карте (иконка 16px зелёный + фамилия) */
  courierMarkers?: CourierMarkerItem[]
  /** Вызывается при клике по маркеру курьера (для подсветки карточки курьера) */
  onCourierMarkerClick?: (marker: CourierMarkerItem) => void
}

export type MapViewMode = 'half' | 'none'

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

const COURIER_TYPE_ICONS: Record<CourierType, string> = {
  pedestrian: walkingCourierIconUrl,
  bike: bikeCourierIconUrl,
  car: carCourierIconUrl,
}

function createCourierMarkerElement(
  courier: CourierMarkerItem,
  onCourierMarkerClick?: (marker: CourierMarkerItem) => void,
): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'mapbox-courier-marker'
  wrap.setAttribute('aria-hidden', 'true')
  if (onCourierMarkerClick) {
    wrap.style.cursor = 'pointer'
    wrap.style.pointerEvents = 'auto'
  }
  const icon = document.createElement('img')
  icon.className = 'mapbox-courier-marker__icon'
  icon.src = COURIER_TYPE_ICONS[courier.type]
  icon.width = 16
  icon.height = 16
  icon.alt = ''
  const label = document.createElement('span')
  label.className = 'mapbox-courier-marker__label'
  label.textContent = courier.surname
  wrap.appendChild(icon)
  wrap.appendChild(label)
  if (onCourierMarkerClick) {
    wrap.addEventListener('click', (e) => {
      e.stopPropagation()
      onCourierMarkerClick(courier)
    })
  }
  return wrap
}

/** Единое условие и параметры для переключения маркеров по масштабу карты */
function getMarkerZoomState(map: mapboxgl.Map): { isCompact: boolean; offsetY: number } {
  const zoom = map.getZoom()
  const isCompact = zoom <= ZOOM_COMPACT_THRESHOLD
  const offsetY = isCompact ? MARKER_OFFSET_COMPACT : MARKER_OFFSET_FULL
  return { isCompact, offsetY }
}

function updateOrderMarkersByZoom(
  markerInstances: mapboxgl.Marker[],
  state: { isCompact: boolean; offsetY: number },
) {
  markerInstances.forEach((m) => {
    const el = m.getElement()
    if (!el) return
    if (state.isCompact) {
      el.classList.add('mapbox-order-marker--compact')
    } else {
      el.classList.remove('mapbox-order-marker--compact')
    }
    m.setOffset([0, state.offsetY])
  })
}

function updateRestaurantMarkerByZoom(
  marker: mapboxgl.Marker | null,
  state: { isCompact: boolean },
) {
  if (!marker) return
  const el = marker.getElement()
  if (!el) return
  if (state.isCompact) {
    el.classList.add('mapbox-restaurant-marker--compact')
  } else {
    el.classList.remove('mapbox-restaurant-marker--compact')
  }
}

function updateCourierMarkersByZoom(
  markerInstances: mapboxgl.Marker[],
  state: { isCompact: boolean; offsetY: number },
) {
  markerInstances.forEach((m) => {
    const el = m.getElement()
    if (!el) return
    if (state.isCompact) {
      el.classList.add('mapbox-courier-marker--compact')
    } else {
      el.classList.remove('mapbox-courier-marker--compact')
    }
    m.setOffset([0, state.offsetY])
  })
}

function updateAllMarkersByZoom(
  map: mapboxgl.Map,
  orderMarkers: mapboxgl.Marker[],
  restaurantMarker: mapboxgl.Marker | null,
  courierMarkers: mapboxgl.Marker[],
) {
  const state = getMarkerZoomState(map)
  updateOrderMarkersByZoom(orderMarkers, state)
  updateRestaurantMarkerByZoom(restaurantMarker, state)
  updateCourierMarkersByZoom(courierMarkers, state)
}

const MAP_VIEW_MODES: { value: MapViewMode; icon: string; title: string }[] = [
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
  courierMarkers = [],
  onCourierMarkerClick,
}: MapboxMapProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const initializedRef = useRef(false)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const courierMarkersRef = useRef<mapboxgl.Marker[]>([])
  const restaurantMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const popupOpenedAtRef = useRef(0)
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
      zoom: RESTAURANT_FOCUS_ZOOM,
      attributionControl: false,
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
      if (target instanceof Element && target.closest('.mapbox-courier-marker')) return
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
    updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [markers, mapReady, onOrderAddToRoute, orderIdsInRoute, onMarkerClick])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    courierMarkersRef.current.forEach((m) => m.remove())
    courierMarkersRef.current = []
    courierMarkers.forEach((c) => {
      const el = createCourierMarkerElement(c, onCourierMarkerClick)
      const mapMarker = new mapboxgl.Marker({ element: el, anchor: 'top' })
        .setLngLat([c.lng, c.lat])
        .setOffset([0, MARKER_OFFSET_FULL])
        .addTo(map)
      courierMarkersRef.current.push(mapMarker)
    })
    updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
    return () => {
      courierMarkersRef.current.forEach((m) => m.remove())
      courierMarkersRef.current = []
    }
  }, [courierMarkers, mapReady, onCourierMarkerClick])

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
      updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
      return () => {
        restaurantMarkerRef.current?.remove()
        restaurantMarkerRef.current = null
      }
    }
    return () => {
      restaurantMarkerRef.current?.remove()
      restaurantMarkerRef.current = null
    }
  }, [mapReady, restaurantCoords])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const onZoomEnd = () => {
      updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
    }
    map.on('zoomend', onZoomEnd)
    return () => {
      map.off('zoomend', onZoomEnd)
    }
  }, [mapReady])

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
    if ((e.target as Node) instanceof Element && (e.target as Element).closest('.mapbox-map-controls')) return
    onMapViewModeChange?.('half')
  }

  const handleFocusRestaurant = () => {
    if (!restaurantCoords || !mapRef.current || mapViewMode === 'none') return
    mapRef.current.flyTo({
      center: [restaurantCoords.lng, restaurantCoords.lat],
      zoom: RESTAURANT_FOCUS_ZOOM,
      duration: FLY_DURATION_MS,
      curve: 0.35,
      essential: true,
    })
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
      <div className="mapbox-map-controls">
        {restaurantCoords ? (
          <button
            type="button"
            className="mapbox-map-focus-restaurant-btn"
            onClick={handleFocusRestaurant}
            title="Центрировать на ресторане"
            aria-label="Центрировать на ресторане"
          >
            <img src={restaurantIconUrl} alt="" width={16} height={16} />
          </button>
        ) : null}
        <div className="mapbox-map-view-selector" role="group" aria-label="Режим карты">
          {MAP_VIEW_MODES.map(({ value, icon, title }) => (
            <button
              key={value}
              type="button"
              className={`mapbox-map-view-selector__btn ${mapViewMode === value ? 'mapbox-map-view-selector__btn--active' : ''}`}
              onClick={(e) => {
                if (value === 'none') {
                  const wrapper = (e.target as Element).closest('.mapbox-map-wrapper')
                  if (wrapper) {
                    const rect = wrapper.getBoundingClientRect()
                    if (e.clientX < rect.left + 40) return
                  }
                }
                setMapViewMode(value)
              }}
              title={title}
              aria-pressed={mapViewMode === value}
              aria-label={title}
            >
              <img src={icon} alt="" width={16} height={16} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
