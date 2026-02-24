import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useDirectionsRoute, emptyRouteGeoJSON, type RoutePathCoord } from '../hooks/useDirectionsRoute'
import { getColorToken } from '../theme'
import { Tooltip } from '../shared/ui/Tooltip'
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
const MARKER_OFFSET_FULL = 9
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
  /** Текст остатка времени (минуты), как в карточке заказа: "15" или "+5" при просрочке */
  slaLabel: string
  /** Порядковый номер в маршруте (1, 2, 3) — не отображается в капсуле, оставлено для совместимости */
  routePosition?: number
  /** Заказ доставлен — в капсуле показывается иконка Done (как в карточке доставки) */
  isDelivered?: boolean
  /** Заказ в назначенном/активном маршруте, маршрут не выделен — показывать маркер с opacity 0.5 */
  isDimmed?: boolean
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
  /** Фокус на маршруте (клик по карточке или маркеру) — линию очищаем только когда false */
  showRouteFocus?: boolean
  /** Маршрут в режиме черновика — линия пульсирует (opacity 1 → 0.6 → 1) */
  isRouteDraft?: boolean
  focusCoords?: { lat: number; lng: number } | null
  focusBounds?: MapFocusBounds | null
  /** При false не вызывать onClearFocus по moveend (чтобы линия маршрута не исчезала после fitBounds) */
  clearFocusOnMoveEnd?: boolean
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
  /** Скрыть селектор вида карты (для фулскрин-оверлея на мобильных) */
  hideViewSelector?: boolean
  /** Тема интерфейса (при смене меняется lightPreset: day / night в стиле Standard) */
  theme?: 'dark' | 'light'
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

const DONE_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="mapbox-order-marker__done-icon" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.83 4.49946C11.4433 4.21746 10.9012 4.30237 10.6192 4.68911L7.1748 9.41286L5.43878 7.42883C5.1236 7.06862 4.57609 7.03212 4.21589 7.3473C3.85568 7.66248 3.81918 8.20999 4.13436 8.57019L6.58419 11.37C6.75762 11.5682 7.01176 11.6768 7.27486 11.6651C7.53797 11.6534 7.78148 11.5227 7.93665 11.3099L12.0197 5.7103C12.3017 5.32356 12.2168 4.78145 11.83 4.49946L11.5944 4.82264L11.83 4.49946Z" fill="currentColor"/></svg>'

function createMarkerElement(
  marker: MapMarkerItem,
  onMarkerClick?: (marker: MapMarkerItem) => void,
): HTMLDivElement {
  const wrap = document.createElement('div')
  wrap.className = 'mapbox-order-marker' + (marker.isDimmed ? ' mapbox-order-marker--dimmed' : '')
  wrap.style.opacity = marker.isDimmed ? '0.3' : ''
  wrap.setAttribute('data-order-id', marker.id)
  if (onMarkerClick) wrap.style.cursor = 'pointer'
  const pill = document.createElement('span')
  pill.className = 'mapbox-order-marker__pill'
  if (marker.isDelivered) {
    pill.classList.add('mapbox-order-marker__pill--done')
    pill.insertAdjacentHTML('beforeend', DONE_ICON_SVG)
  } else {
    if (marker.isOverdue) pill.classList.add('mapbox-order-marker__pill--overdue')
    const pillNum = document.createElement('span')
    pillNum.className = 'mapbox-order-marker__pill-num'
    pillNum.textContent = marker.slaLabel
    pill.appendChild(pillNum)
  }
  const label = document.createElement('span')
  label.className = 'mapbox-order-marker__label'
  label.textContent = shortenAddressForLabel(marker.address)
  wrap.appendChild(pill)
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
  const icon = document.createElement('span')
  icon.className = 'mapbox-restaurant-marker__icon'
  icon.style.setProperty('--icon-src', `url("${restaurantIconUrl}")`)
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
  wrap.setAttribute('data-courier-id', courier.id)
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
  showRouteFocus = false,
  isRouteDraft = false,
  focusCoords,
  focusBounds,
  clearFocusOnMoveEnd = true,
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
  hideViewSelector = false,
  theme = 'dark',
}: MapboxMapProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const initializedRef = useRef(false)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const courierMarkersRef = useRef<mapboxgl.Marker[]>([])
  const courierMarkersByIdRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const restaurantMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const popupOpenedAtRef = useRef(0)
  const popupMarkerIdRef = useRef<string | null>(null)
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
    let cancelled = false
    mapboxgl.accessToken = mapboxToken

    const isDark = theme === 'dark'
    const map = new mapboxgl.Map({
      container,
      style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/standard',
      center: DEFAULT_CENTER,
      zoom: RESTAURANT_FOCUS_ZOOM,
      attributionControl: false,
      ...(isDark
        ? {}
        : {
            config: {
              basemap: {
                lightPreset: 'day',
                theme: 'faded',
                showPointOfInterestLabels: false,
              },
            },
          }),
    })

    mapRef.current = map

    let resizeRafId: number | null = null
    const onResize = () => {
      if (resizeRafId !== null) return
      resizeRafId = requestAnimationFrame(() => {
        resizeRafId = null
        const rect = container.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          try {
            map.resize()
          } catch {
            // Контейнер мог стать невидимым (панель скрыта) или карта удалена
          }
        }
      })
    }
    map.on('load', () => {
      if (cancelled) return
      onResize()
      if (!map.getSource('route')) {
        map.addSource('route', {
          type: 'geojson',
          lineMetrics: true,
          data: emptyRouteGeoJSON(),
        })
      }
      const accent = getColorToken('--accent') || '#03ab00'
      /** Светлый акцент в середине линии (одинаково читаемо в светлой и тёмной теме) */
      const lineHighlight = '#B8FFB7'
      if (!map.getLayer('route-line-glow')) {
        map.addLayer({
          id: 'route-line-glow',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': accent,
            'line-width': 14,
            'line-blur': 12,
            'line-opacity': 0,
            'line-emissive-strength': 1,
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
              accent,
              0.35,
              accent,
              0.5,
              lineHighlight,
              0.65,
              accent,
              1,
              accent,
            ],
            'line-width': 3,
            'line-dasharray': [1.5, 2],
            'line-emissive-strength': 1,
          },
        })
      }
      if (!cancelled) setMapReady(true)
    })

    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    return () => {
      cancelled = true
      setMapReady(false)
      onClearFocusRef.current = () => {}
      onOrderAddToRouteRef.current = undefined
      onMapBackgroundClickRef.current = () => {}
      resizeObserver.disconnect()
      if (resizeRafId !== null) cancelAnimationFrame(resizeRafId)
      try {
        map.remove()
      } catch {
        // При активном маршруте/анимации remove() иногда бросает — всё равно сбрасываем refs
      }
      mapRef.current = null
      initializedRef.current = false
    }
  }, [theme])

  /** Светлая тема: Standard с preset day и темой faded (Cool). Тёмная: dark-v11. line-emissive-strength по теме. */
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    if (theme === 'light') {
      try {
        map.setConfigProperty('basemap', 'lightPreset', 'day')
        map.setConfigProperty('basemap', 'theme', 'faded')
      } catch {
        // Standard style only
      }
    }
    const emissive = theme === 'dark' ? 1 : 0
    try {
      if (map.getLayer('route-line')) map.setPaintProperty('route-line', 'line-emissive-strength', emissive)
      if (map.getLayer('route-line-glow')) map.setPaintProperty('route-line-glow', 'line-emissive-strength', emissive)
    } catch {
      // dark-v11 может не поддерживать line-emissive-strength
    }
  }, [theme, mapReady])

  useEffect(() => {
    if (mapViewMode === 'none' || !focusCoords || !mapRef.current) return
    const map = mapRef.current
    let cancelled = false
    const center: [number, number] = [focusCoords.lng, focusCoords.lat]
    try {
      map.flyTo({
        center,
        zoom: FOCUS_ZOOM,
        duration: FLY_DURATION_MS,
        curve: 0.35,
        essential: true,
      })
    } catch {
      return
    }
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
    try {
      map.fitBounds(
        [
          [swLng, swLat],
          [neLng, neLat],
        ],
        { padding: FIT_BOUNDS_PADDING_PX, duration: FIT_BOUNDS_DURATION_MS, maxZoom: 16 },
      )
    } catch {
      return
    }
    if (clearFocusOnMoveEnd) {
      const onMoveEnd = () => {
        if (!cancelled) onClearFocusRef.current?.()
      }
      map.once('moveend', onMoveEnd)
      return () => {
        cancelled = true
        map.off('moveend', onMoveEnd)
      }
    }
    return undefined
  }, [mapViewMode, focusBounds, clearFocusOnMoveEnd])

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const container = containerRef.current
    const popup = new mapboxgl.Popup({ closeButton: false, className: 'mapbox-marker-popup-container' })
    popupRef.current = popup

    const closePopupIfOpen = () => {
      if (popupRef.current) {
        popupRef.current.remove()
        popupMarkerIdRef.current = null
      }
    }

    const isMapBackgroundTap = (target: EventTarget | null): boolean => {
      if (!(target instanceof Node)) return false
      const el = popup.getElement()
      if (el && el.contains(target)) return false
      if (target instanceof Element && target.closest('.mapbox-order-marker')) return false
      if (target instanceof Element && target.closest('.mapbox-courier-marker')) return false
      if (target instanceof Element && target.closest('.mapbox-restaurant-marker')) return false
      if (target instanceof Element && target.closest('.mapbox-map-controls')) return false
      if (Date.now() - popupOpenedAtRef.current < 200) return false
      return true
    }

    const handleMapBackgroundTap = () => {
      closePopupIfOpen()
      onMapBackgroundClickRef.current?.()
    }

    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (!isMapBackgroundTap(e.originalEvent?.target)) return
      handleMapBackgroundTap()
    }
    map.on('click', onMapClick)

    let touchStartX = 0
    let touchStartY = 0
    const TAP_MOVE_THRESHOLD = 10
    const onTouchStart = (e: TouchEvent) => {
      if (e.changedTouches.length > 0) {
        touchStartX = e.changedTouches[0].clientX
        touchStartY = e.changedTouches[0].clientY
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return
      const touch = e.changedTouches[0]
      const dx = Math.abs(touch.clientX - touchStartX)
      const dy = Math.abs(touch.clientY - touchStartY)
      if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) return
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (!target || !container?.contains(target)) return
      if (!isMapBackgroundTap(target)) return
      handleMapBackgroundTap()
    }
    const canvas = map.getCanvas()
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })

    const onDragStart = () => closePopupIfOpen()
    map.on('dragstart', onDragStart)

    const onClickOutsideMap = (e: MouseEvent) => {
      const target = e.target
      if (!(target instanceof Node) || !container?.contains(target)) closePopupIfOpen()
    }
    document.addEventListener('click', onClickOutsideMap)

    return () => {
      map.off('click', onMapClick)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
      map.off('dragstart', onDragStart)
      document.removeEventListener('click', onClickOutsideMap)
      popup.remove()
      popupRef.current = null
      popupMarkerIdRef.current = null
    }
  }, [mapReady])

  /** Синхронизируем класс --dimmed на уже отрисованных маркерах (при смене выделенного маршрута) */
  const dimmedStateKey = useMemo(
    () => markers.map((m) => `${m.id}:${m.isDimmed ? 1 : 0}`).join(','),
    [markers],
  )
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
      if (orderIdsInRouteSet?.has(m.id) || m.isDelivered) return
      popup.setLngLat([m.lng, m.lat])
      popup.setDOMContent(
        createMarkerPopupContent(
          m.id,
          (orderId) => onOrderAddToRouteRef.current?.(orderId),
          popup,
        ),
      )
      popup.addTo(map)
      popupOpenedAtRef.current = Date.now()
      popupMarkerIdRef.current = m.id
    }
    const handleMarkerClick = (m: MapMarkerItem) => {
      if (popupRef.current && popupMarkerIdRef.current === m.id) {
        popupRef.current.remove()
        popupMarkerIdRef.current = null
        return
      }
      if (onOrderAddToRoute && !orderIdsInRouteSet?.has(m.id) && !m.isDelivered) openPopup(m)
      onMarkerClick?.(m)
    }
    byCoords.forEach((group) => {
      const first = group[0]
      const mergedMarker: MapMarkerItem = {
        ...first,
        isDimmed: group.some((m) => m.isDimmed),
      }
      const el = createMarkerElement(
        mergedMarker,
        onOrderAddToRoute || onMarkerClick ? handleMarkerClick : undefined,
      )
      const mapMarker = new mapboxgl.Marker({ element: el, anchor: 'top' })
        .setLngLat([first.lng, first.lat])
        .setOffset([0, MARKER_OFFSET_FULL])
        .addTo(map)
      markersRef.current.push(mapMarker)
    })
    updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [markers, mapReady, onOrderAddToRoute, orderIdsInRoute, onMarkerClick, dimmedStateKey])

  /** Синхронизируем класс --dimmed и opacity на уже отрисованных маркерах (при смене выделенного маршрута) */
  useEffect(() => {
    if (!mapReady || !markers.length) return
    const key = (lng: number, lat: number) => `${lng.toFixed(6)},${lat.toFixed(6)}`
    const byCoords = new Map<string, MapMarkerItem[]>()
    for (const m of markers) {
      const k = key(m.lng, m.lat)
      const list = byCoords.get(k) ?? []
      list.push(m)
      byCoords.set(k, list)
    }
    const idToDimmed = new Map<string, boolean>()
    byCoords.forEach((group) => {
      const dimmed = group.some((m) => !!m.isDimmed)
      group.forEach((m) => idToDimmed.set(m.id, dimmed))
    })
    markersRef.current.forEach((mapMarker) => {
      const el = mapMarker.getElement()
      const orderId = el?.getAttribute('data-order-id')
      if (orderId == null) return
      const dimmed = idToDimmed.get(orderId) ?? false
      el?.classList.toggle('mapbox-order-marker--dimmed', dimmed)
      if (el) (el as HTMLElement).style.opacity = dimmed ? '0.3' : ''
    })
  }, [mapReady, markers, dimmedStateKey])

  /** Синхронизация маркеров курьеров: обновляем позиции вместо пересоздания (для плавного движения по маршруту) */
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    const byId = courierMarkersByIdRef.current
    const newIds = new Set(courierMarkers.map((c) => c.id))

    for (const c of courierMarkers) {
      const existing = byId.get(c.id)
      if (existing) {
        existing.setLngLat([c.lng, c.lat])
      } else {
        const el = createCourierMarkerElement(c, onCourierMarkerClick)
        const mapMarker = new mapboxgl.Marker({ element: el, anchor: 'top' })
          .setLngLat([c.lng, c.lat])
          .setOffset([0, MARKER_OFFSET_FULL])
          .addTo(map)
        byId.set(c.id, mapMarker)
      }
    }

    const toRemove: string[] = []
    for (const [id, marker] of byId.entries()) {
      if (!newIds.has(id)) {
        marker.remove()
        toRemove.push(id)
      }
    }
    toRemove.forEach((id) => byId.delete(id))

    courierMarkersRef.current = Array.from(byId.values())
    updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
  }, [courierMarkers, mapReady, onCourierMarkerClick])

  useEffect(() => {
    return () => {
      courierMarkersByIdRef.current.forEach((m) => m.remove())
      courierMarkersByIdRef.current.clear()
      courierMarkersRef.current = []
    }
  }, [mapReady])

  const restaurantLat = restaurantCoords?.lat
  const restaurantLng = restaurantCoords?.lng
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    const map = mapRef.current
    restaurantMarkerRef.current?.remove()
    restaurantMarkerRef.current = null
    if (restaurantLat != null && restaurantLng != null) {
      const el = createRestaurantMarkerElement()
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([restaurantLng, restaurantLat])
        .addTo(map)
      restaurantMarkerRef.current = marker
      const onStyleLoad = () => {
        if (restaurantMarkerRef.current && restaurantLat != null && restaurantLng != null) {
          restaurantMarkerRef.current.addTo(map)
          updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
        }
      }
      map.on('style.load', onStyleLoad)
      updateAllMarkersByZoom(map, markersRef.current, restaurantMarkerRef.current, courierMarkersRef.current)
      return () => {
        map.off('style.load', onStyleLoad)
        restaurantMarkerRef.current?.remove()
        restaurantMarkerRef.current = null
      }
    }
    return () => {
      restaurantMarkerRef.current?.remove()
      restaurantMarkerRef.current = null
    }
  }, [mapReady, restaurantLat, restaurantLng])

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
    showRouteFocus,
    accessToken: mapboxToken ?? undefined,
    animateLine: isRouteDraft,
  })

  useEffect(() => {
    if (!mapRef.current || !mapReady || !mapRef.current.getLayer('route-line')) return
    const map = mapRef.current
    if (!isRouteDraft) {
      try {
        map.setPaintProperty('route-line', 'line-opacity', 1)
      } catch {
        // Standard (светлая тема) может вести себя иначе
      }
      return
    }
    const startTime = performance.now()
    let rafId: number
    const tick = () => {
      try {
        const elapsed = performance.now() - startTime
        const t = (elapsed / ROUTE_PULSE_DURATION_MS) * 2 * Math.PI
        const opacity = 0.7 + 0.3 * Math.cos(t)
        map.setPaintProperty('route-line', 'line-opacity', opacity)
      } catch {
        return
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      try {
        if (map.getLayer('route-line')) map.setPaintProperty('route-line', 'line-opacity', 1)
      } catch {
        // карта/слой могли быть удалены
      }
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
      try {
        const elapsed = performance.now() - startTime
        if (elapsed >= ROUTE_FLASH_DURATION_MS) {
          map.setPaintProperty('route-line-glow', 'line-opacity', 0)
          return
        }
        const t = elapsed / ROUTE_FLASH_DURATION_MS
        const opacity = t < 0.35 ? (t / 0.35) * 0.6 : 0.6 * (1 - (t - 0.35) / 0.65)
        map.setPaintProperty('route-line-glow', 'line-opacity', opacity)
      } catch {
        return
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      try {
        if (map.getLayer('route-line-glow')) map.setPaintProperty('route-line-glow', 'line-opacity', 0)
      } catch {
        // Standard (светлая тема) или карта удалена
      }
    }
  }, [mapReady, routeFlashTrigger])

  // Анимация движущегося свечения в градиенте линии маршрута (всегда).
  useEffect(() => {
    if (!mapRef.current || !mapReady || !mapRef.current.getLayer('route-line')) return
    const map = mapRef.current
    const accent = getColorToken('--accent') || '#03ab00'
    const startTime = performance.now()
    let rafId: number
    const tick = () => {
      try {
        const elapsed = performance.now() - startTime
        const phase = (elapsed / ROUTE_GLOW_CYCLE_MS) % 1
        map.setPaintProperty('route-line', 'line-gradient', [
          'interpolate',
          ['linear'],
          ['%', ['+', ['-', ['line-progress'], phase], 1], 1],
          0,
          accent,
          0.45,
          accent,
          0.5,
          '#B8FFB7',
          0.55,
          accent,
          1,
          accent,
        ])
      } catch {
        return
      }
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
      let startOpacity: number | undefined
      try {
        startOpacity = map.getPaintProperty('route-line', 'line-opacity') as number | undefined
      } catch {
        return
      }
      const start = performance.now()
      const startVal = typeof startOpacity === 'number' ? startOpacity : 1
      let rafId: number
      const tick = () => {
        let t = 1
        try {
          const elapsed = performance.now() - start
          t = Math.min(elapsed / ROUTE_COLLAPSE_DURATION_MS, 1)
          const opacity = startVal * (1 - t)
          map.setPaintProperty('route-line', 'line-opacity', opacity)
          if (hasGlowLayer) map.setPaintProperty('route-line-glow', 'line-opacity', opacity * 0.6)
        } catch {
          return
        }
        if (t < 1) rafId = requestAnimationFrame(tick)
      }
      rafId = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(rafId)
    }
    try {
      map.setPaintProperty('route-line', 'line-opacity', 1)
      if (hasGlowLayer) map.setPaintProperty('route-line-glow', 'line-opacity', 0)
    } catch {
      // Standard (светлая тема) или слой удалён
    }
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

  const mapWrapper = (
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
          <span className="mapbox-map-icon" style={{ ['--icon-src' as string]: `url("${arrowLeftIconUrl}")` }} />
        </div>
      ) : null}
      <div className="mapbox-map-controls">
        {restaurantCoords ? (
          <Tooltip title="К ресторану">
            <button
              type="button"
              className="mapbox-map-focus-restaurant-btn"
              onClick={handleFocusRestaurant}
              aria-label="К ресторану"
            >
              <span className="mapbox-map-icon" style={{ ['--icon-src' as string]: `url("${restaurantIconUrl}")` }} aria-hidden />
            </button>
          </Tooltip>
        ) : null}
        {!hideViewSelector ? (
          <div className="mapbox-map-view-selector" role="group" aria-label="Режим карты">
            {MAP_VIEW_MODES.map(({ value, icon, title }) => (
              <Tooltip key={value} title={title}>
                <button
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
                  aria-pressed={mapViewMode === value}
                  aria-label={title}
                >
                  <span className="mapbox-map-icon" style={{ ['--icon-src' as string]: `url("${icon}")` }} aria-hidden />
                </button>
              </Tooltip>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <Tooltip title={mapViewMode === 'none' ? 'Показать карту' : ''} fill>
      {mapWrapper}
    </Tooltip>
  )
}
