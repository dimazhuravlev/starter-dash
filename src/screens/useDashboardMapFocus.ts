import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useDashboardStore } from '../store/useDashboardStore'
import { type CourierMarkerItem, type MapViewMode } from '../components/MapboxMap'
import { type Order, type Route, RESTAURANT_COORDS } from '../model/types'

type MapFocusBounds = {
  sw: { lat: number; lng: number }
  ne: { lat: number; lng: number }
}

/** Автозум/позиционирование при действиях с курьером на карте — только если текущий зум карты ≤ этого значения */
export const MAP_COURIER_CAMERA_MAX_ZOOM = 13

type UseDashboardMapFocusParams = {
  routes: Record<string, Route>
  orders: Record<string, Order>
  draftRoutes: Route[]
  routeMode: 'auto' | 'manual'
  createRouteDraft: () => string
  attachOrderToRoute: (routeId: string, orderId: string) => void
  detachCourierFromRoute: (routeId: string) => void
  attachCourierToRoute: (routeId: string, courierId: string) => void
  resizerJustInteractedRef: MutableRefObject<boolean>
  /** Ref с актуальными маркерами курьеров (обновляется после useDashboardMapData) */
  courierMarkersRef: MutableRefObject<CourierMarkerItem[]>
  /** Текущий getZoom() карты — обновляется в MapboxMap */
  mapZoomRef: MutableRefObject<number>
}

export function useDashboardMapFocus({
  routes,
  orders,
  draftRoutes,
  routeMode,
  createRouteDraft,
  attachOrderToRoute,
  detachCourierFromRoute,
  attachCourierToRoute,
  resizerJustInteractedRef,
  courierMarkersRef,
  mapZoomRef,
}: UseDashboardMapFocusParams) {
  const isEditingAutoRoutes = useDashboardStore((s) => s.isEditingAutoRoutes)
  const [mapFocusCoords, setMapFocusCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [highlightedOrderIdFromMap, setHighlightedOrderIdFromMap] = useState<string | null>(null)
  const [highlightedCourierIdFromMap, setHighlightedCourierIdFromMap] = useState<string | null>(null)
  const highlightedOrderIdFromMapRef = useRef(highlightedOrderIdFromMap)
  useEffect(() => {
    highlightedOrderIdFromMapRef.current = highlightedOrderIdFromMap
  }, [highlightedOrderIdFromMap])
  const [mapFocusBounds, setMapFocusBounds] = useState<MapFocusBounds | null>(null)
  const [focusedRouteId, setFocusedRouteId] = useState<string | null>(null)
  /** Координаты линии маршрута — задаём в момент фокуса (карточка/маркер), один источник правды */
  const [focusedRoutePathCoords, setFocusedRoutePathCoords] = useState<
    { lng: number; lat: number }[] | null
  >(null)
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('half')
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const focusMapOnRoute = useCallback(
    (routeId: string, options?: { skipCamera?: boolean }) => {
      const state = useDashboardStore.getState()
      const route = state.routes[routeId]
      if (!route?.orderIds.length) return
      setHighlightedOrderIdFromMap(null)
      setFocusedRouteId(routeId)
      const orderCoords = route.orderIds
        .map((id) => state.orders[id]?.coords)
        .filter((c): c is { lat: number; lng: number } => c != null)
      if (orderCoords.length === 0) return
      const coords = [RESTAURANT_COORDS, ...orderCoords].map((c) => ({ lng: c.lng, lat: c.lat }))
      setFocusedRoutePathCoords(coords)
      setMapFocusCoords(null)
      if (options?.skipCamera) {
        setMapFocusBounds(null)
      } else {
        const lngs = coords.map((c) => c.lng)
        const lats = coords.map((c) => c.lat)
        setMapFocusBounds({
          sw: { lng: Math.min(...lngs), lat: Math.min(...lats) },
          ne: { lng: Math.max(...lngs), lat: Math.max(...lats) },
        })
      }
    },
    [],
  )

  const handleMarkerClick = useCallback(
    (marker: { id: string }) => {
      const state = useDashboardStore.getState()
      const routeContainingOrder = Object.values(state.routes).find((r) => r.orderIds.includes(marker.id))

      if (routeContainingOrder) {
        focusMapOnRoute(routeContainingOrder.id)
        setHighlightedOrderIdFromMap(marker.id)
      } else {
        setFocusedRouteId(null)
        setMapFocusBounds(null)
        setFocusedRoutePathCoords(null)
        if (highlightedOrderIdFromMapRef.current === marker.id) {
          setHighlightedOrderIdFromMap(null)
          requestAnimationFrame(() => {
            if (mountedRef.current) setHighlightedOrderIdFromMap(marker.id)
          })
        } else {
          setHighlightedOrderIdFromMap(marker.id)
        }
      }
    },
    [focusMapOnRoute],
  )

  useEffect(() => {
    if (!focusedRouteId) return
    const route = routes[focusedRouteId]
    const routeCardVisible =
      route &&
      (route.status === 'draft' ||
        (route.status === 'sent' && route.step.kind !== 'returning'))
    const allOrdersDelivered =
      route && route.orderIds.length > 0 && route.orderIds.every((id) => orders[id]?.status === 'delivered')
    if (!routeCardVisible || allOrdersDelivered) {
      let rafId = 0
      rafId = requestAnimationFrame(() => {
        if (mountedRef.current) {
          setFocusedRouteId(null)
          setMapFocusBounds(null)
          setFocusedRoutePathCoords(null)
        }
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [focusedRouteId, routes, orders])

  const handleMapBackgroundClick = useCallback(() => {
    setHighlightedOrderIdFromMap(null)
    setHighlightedCourierIdFromMap(null)
    setFocusedRouteId(null)
    setMapFocusBounds(null)
    setFocusedRoutePathCoords(null)
  }, [])

  const handleCourierMarkerClick = useCallback(
    (marker: CourierMarkerItem) => {
      const state = useDashboardStore.getState()
      const courier = state.couriers[marker.id]
      const route = courier?.routeId ? state.routes[courier.routeId] : undefined
      const routeIsActive =
        route?.status === 'sent' &&
        route.step.kind !== 'pickup' &&
        route.step.kind !== 'returning' &&
        route.orderIds.length > 0

      const skipCourierCamera = mapZoomRef.current > MAP_COURIER_CAMERA_MAX_ZOOM

      if (routeIsActive && route) {
        focusMapOnRoute(route.id, { skipCamera: skipCourierCamera })
        setHighlightedCourierIdFromMap(marker.id)
      } else {
        setFocusedRouteId(null)
        setMapFocusBounds(null)
        setFocusedRoutePathCoords(null)
        setHighlightedCourierIdFromMap((prev) => (prev === marker.id ? null : marker.id))
        if (skipCourierCamera) {
          setMapFocusCoords(null)
        } else {
          const current = courierMarkersRef.current.find((m) => m.id === marker.id)
          setMapFocusCoords(current ? { lat: current.lat, lng: current.lng } : { lat: marker.lat, lng: marker.lng })
        }
      }
    },
    [focusMapOnRoute, mapZoomRef],
  )

  const handleOrderCardClick = useCallback(
    (coords: { lat: number; lng: number }) => {
      if (mapViewMode === 'none') return
      setFocusedRouteId(null)
      setMapFocusBounds(null)
      setFocusedRoutePathCoords(null)
      setMapFocusCoords(coords)
    },
    [mapViewMode],
  )

  const handleCourierCardClick = useCallback(
    (courierId: string) => {
      if (mapViewMode === 'none') return
      const state = useDashboardStore.getState()
      const courier = state.couriers[courierId]
      const route = courier?.routeId ? state.routes[courier.routeId] : undefined
      const routeIsActive =
        route?.status === 'sent' &&
        route.step.kind !== 'pickup' &&
        route.step.kind !== 'returning' &&
        route.orderIds.length > 0

      if (routeIsActive && route) {
        focusMapOnRoute(route.id)
        setHighlightedCourierIdFromMap(courierId)
      } else {
        setFocusedRouteId(null)
        setMapFocusBounds(null)
        setFocusedRoutePathCoords(null)
        const marker = courierMarkersRef.current.find((m) => m.id === courierId)
        if (marker) {
          setMapFocusCoords({ lat: marker.lat, lng: marker.lng })
        } else if (courier) {
          setMapFocusCoords({ lat: courier.coords.lat, lng: courier.coords.lng })
        }
        setHighlightedCourierIdFromMap((prev) => (prev === courierId ? null : courierId))
      }
    },
    [mapViewMode, focusMapOnRoute],
  )

  const handleOrderAddToRouteFromMap = useCallback(
    (orderId: string) => {
      if (routeMode === 'auto') return
      const draftWithSpace = draftRoutes.find((r) => r.orderIds.length < 3)
      const routeId = draftWithSpace ? draftWithSpace.id : createRouteDraft()
      if (!routeId) return
      setHighlightedOrderIdFromMap(null)
      attachOrderToRoute(routeId, orderId)
      focusMapOnRoute(routeId)
      requestAnimationFrame(() => {
        if (mountedRef.current) setHighlightedOrderIdFromMap(orderId)
      })
    },
    [routeMode, draftRoutes, createRouteDraft, attachOrderToRoute, focusMapOnRoute],
  )

  /** Курьер с карты в черновик: шаблон с заказами без курьера, иначе пустой шаблон, иначе createRouteDraft */
  const handleCourierAddToRouteFromMap = useCallback(
    (courierId: string) => {
      if (routeMode !== 'manual' && !isEditingAutoRoutes) return

      const allDrafts = Object.values(routes)
        .filter((r) => r.status === 'draft')
        .sort((a, b) => a.createdAt - b.createdAt)

      const withOrdersNoCourier = allDrafts.find((r) => r.orderIds.length > 0 && !r.courierId)
      const emptyOnly = allDrafts.find((r) => !r.courierId && r.orderIds.length === 0)
      let routeId = withOrdersNoCourier?.id ?? emptyOnly?.id ?? ''
      if (!routeId) {
        routeId = createRouteDraft()
        if (!routeId) return
      }

      const prevDraft = allDrafts.find((r) => r.courierId === courierId)
      if (prevDraft && prevDraft.id !== routeId) {
        detachCourierFromRoute(prevDraft.id)
      }

      attachCourierToRoute(routeId, courierId)
      setHighlightedCourierIdFromMap(null)
      const skipCourierCamera = mapZoomRef.current > MAP_COURIER_CAMERA_MAX_ZOOM
      focusMapOnRoute(routeId, { skipCamera: skipCourierCamera })
      requestAnimationFrame(() => {
        if (mountedRef.current) setHighlightedCourierIdFromMap(courierId)
      })
    },
    [
      routeMode,
      isEditingAutoRoutes,
      routes,
      createRouteDraft,
      detachCourierFromRoute,
      attachCourierToRoute,
      focusMapOnRoute,
      mapZoomRef,
    ],
  )

  const handleMapViewModeChange = useCallback((mode: MapViewMode) => {
    if (mode === 'none' && resizerJustInteractedRef.current) return
    setMapViewMode(mode)
  }, [resizerJustInteractedRef])

  const handleMapClearFocus = useCallback(() => {
    setMapFocusCoords(null)
    setMapFocusBounds(null)
    setFocusedRoutePathCoords(null)
    setHighlightedOrderIdFromMap(null)
    setHighlightedCourierIdFromMap(null)
  }, [])

  return {
    mapFocusCoords,
    mapFocusBounds,
    focusedRouteId,
    focusedRoutePathCoords,
    highlightedOrderIdFromMap,
    highlightedCourierIdFromMap,
    mapViewMode,
    focusMapOnRoute,
    handleMarkerClick,
    handleMapBackgroundClick,
    handleCourierMarkerClick,
    handleOrderCardClick,
    handleCourierCardClick,
    handleOrderAddToRouteFromMap,
    handleCourierAddToRouteFromMap,
    handleMapViewModeChange,
    handleMapClearFocus,
  }
}
