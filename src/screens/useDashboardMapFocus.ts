import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useDashboardStore } from '../store/useDashboardStore'
import { type CourierMarkerItem, type MapViewMode } from '../components/MapboxMap'
import { type Order, type Route, RESTAURANT_COORDS } from '../model/types'

type MapFocusBounds = {
  sw: { lat: number; lng: number }
  ne: { lat: number; lng: number }
}

type UseDashboardMapFocusParams = {
  routes: Record<string, Route>
  orders: Record<string, Order>
  draftRoutes: Route[]
  routeMode: 'auto' | 'manual'
  createRouteDraft: () => string
  attachOrderToRoute: (routeId: string, orderId: string) => void
  resizerJustInteractedRef: MutableRefObject<boolean>
  /** Ref с актуальными маркерами курьеров (обновляется после useDashboardMapData) */
  courierMarkersRef: MutableRefObject<CourierMarkerItem[]>
}

export function useDashboardMapFocus({
  routes,
  orders,
  draftRoutes,
  routeMode,
  createRouteDraft,
  attachOrderToRoute,
  resizerJustInteractedRef,
  courierMarkersRef,
}: UseDashboardMapFocusParams) {
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

  const focusMapOnRoute = useCallback((routeId: string) => {
    const state = useDashboardStore.getState()
    const route = state.routes[routeId]
    if (!route?.orderIds.length) return
    if (mapViewMode === 'none') setMapViewMode('half')
    setHighlightedOrderIdFromMap(null)
    setFocusedRouteId(routeId)
    const orderCoords = route.orderIds
      .map((id) => state.orders[id]?.coords)
      .filter((c): c is { lat: number; lng: number } => c != null)
    if (orderCoords.length === 0) return
    const coords = [RESTAURANT_COORDS, ...orderCoords].map((c) => ({ lng: c.lng, lat: c.lat }))
    setFocusedRoutePathCoords(coords)
    setMapFocusCoords(null)
    const lngs = coords.map((c) => c.lng)
    const lats = coords.map((c) => c.lat)
    setMapFocusBounds({
      sw: { lng: Math.min(...lngs), lat: Math.min(...lats) },
      ne: { lng: Math.max(...lngs), lat: Math.max(...lats) },
    })
  }, [mapViewMode])

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

      if (routeIsActive && route) {
        focusMapOnRoute(route.id)
        setHighlightedCourierIdFromMap(marker.id)
      } else {
        setFocusedRouteId(null)
        setMapFocusBounds(null)
        setFocusedRoutePathCoords(null)
        setHighlightedCourierIdFromMap((prev) => (prev === marker.id ? null : marker.id))
        const current = courierMarkersRef.current.find((m) => m.id === marker.id)
        setMapFocusCoords(current ? { lat: current.lat, lng: current.lng } : { lat: marker.lat, lng: marker.lng })
      }
    },
    [focusMapOnRoute],
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
    handleMapViewModeChange,
    handleMapClearFocus,
  }
}
