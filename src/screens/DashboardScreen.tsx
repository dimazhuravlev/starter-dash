import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { type Courier, type Order, type Route, RESTAURANT_COORDS } from '../model/types'
import { DashboardLayout } from './DashboardLayout'
import { DashboardLeftPanel } from './DashboardLeftPanel'
import { DashboardMapColumn } from './DashboardMapColumn'
import { DashboardMobileMap } from './DashboardMobileMap'
import { useDashboardMapData } from './useDashboardMapData'
import { useDashboardMapFocus } from './useDashboardMapFocus'
import { useDashboardResize } from './useDashboardResize'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'

type DashboardScreenProps = {
  orders: Record<string, Order>
  couriers: Record<string, Courier>
  routes: Record<string, Route>
  createRouteDraft: () => string
  deleteRouteDraft: (routeId: string) => void
  detachCourierFromRoute: (routeId: string) => void
  attachCourierToRoute: (routeId: string, courierId: string) => void
  detachOrderFromRoute: (routeId: string, orderId: string) => void
  attachOrderToRoute: (routeId: string, orderId: string) => void
  reorderRouteOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  sendRoute: (routeId: string) => void
  revertRouteToDraft: (routeId: string) => void
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
}

export function DashboardScreen({
  orders,
  couriers,
  routes,
  createRouteDraft,
  deleteRouteDraft,
  detachCourierFromRoute,
  attachCourierToRoute,
  detachOrderFromRoute,
  attachOrderToRoute,
  reorderRouteOrders,
  sendRoute,
  revertRouteToDraft,
  now,
  orderStageMin,
  routeStageMin,
}: DashboardScreenProps) {
  const orderList = useMemo(() => Object.values(orders), [orders])
  const courierList = useMemo(() => Object.values(couriers), [couriers])
  const routeList = useMemo(() => Object.values(routes), [routes])
  const [isMobileMapOpen, setIsMobileMapOpen] = useState(false)
  const resize = useDashboardResize(isMobileMapOpen)
  const {
    dashboardRef,
    leftWrapperRef,
    rightColumnRef,
    resizerRef,
    rightColumnWidth,
    dashboardWidth,
    isResizing,
    handleResizerPointerDown,
    resizerJustInteractedRef,
  } = resize

  const draftRoutes = useMemo(() => routeList.filter((route) => route.status === 'draft'), [routeList])
  const sentRoutes = useMemo(() => routeList.filter((route) => route.status === 'sent'), [routeList])
  const assignedRoutes = useMemo(
    () => sentRoutes.filter((route) => route.step.kind === 'pickup'),
    [sentRoutes],
  )
  const clientRoutes = useMemo(
    () => sentRoutes.filter((route) => route.step.kind !== 'pickup' && route.step.kind !== 'returning'),
    [sentRoutes],
  )

  const mapFocus = useDashboardMapFocus({
    routes,
    orders,
    draftRoutes,
    createRouteDraft,
    attachOrderToRoute,
    resizerJustInteractedRef,
  })
  const {
    mapFocusCoords,
    mapFocusBounds,
    focusedRouteId,
    highlightedOrderIdFromMap,
    highlightedCourierIdFromMap,
    mapViewMode,
    focusMapOnRoute,
    handleMarkerClick,
    handleMapBackgroundClick,
    handleLeftPanelClick,
    handleCourierMarkerClick,
    handleOrderCardClick,
    handleCourierCardClick,
    handleOrderAddToRouteFromMap,
    handleMapViewModeChange,
    handleMapClearFocus,
  } = mapFocus

  const [draftSectionExiting, setDraftSectionExiting] = useState(false)
  const [pendingSendRouteId, setPendingSendRouteId] = useState<string | null>(null)
  const [recentlySentRouteIds, setRecentlySentRouteIds] = useState<string[]>([])
  const [pendingRevertRouteId, setPendingRevertRouteId] = useState<string | null>(null)
  const [recentlyRevertedToDraftRouteIds, setRecentlyRevertedToDraftRouteIds] = useState<string[]>([])
  const [recentlyMovedToActiveRouteIds, setRecentlyMovedToActiveRouteIds] = useState<string[]>([])
  const [routeFlashTrigger, setRouteFlashTrigger] = useState<number | null>(null)
  const [nextRevertedDraftId, setNextRevertedDraftId] = useState<string | null>(null)
  const prevClientRouteIdsRef = useRef<Set<string>>(new Set())
  const didInitClientRoutesRef = useRef(false)

  const handleSendRouteClick = useCallback((routeId: string) => {
    setPendingSendRouteId(routeId)
  }, [])

  const handleSendAfterExit = useCallback(
    (routeId: string) => {
      sendRoute(routeId)
      setRouteFlashTrigger(Date.now())
      setPendingSendRouteId(null)
      setRecentlySentRouteIds((prev) => [...prev, routeId])
      window.setTimeout(() => {
        setRecentlySentRouteIds((prev) => prev.filter((id) => id !== routeId))
      }, 350)
    },
    [sendRoute],
  )

  const handleRevertClick = useCallback((routeId: string) => {
    setPendingRevertRouteId(routeId)
  }, [])

  const handleRevertAfterExit = useCallback(
    (routeId: string) => {
      setNextRevertedDraftId(routeId)
      flushSync(() => {
        setPendingRevertRouteId(null)
        setRecentlyRevertedToDraftRouteIds((prev) => [...prev, routeId])
      })
      requestAnimationFrame(() => {
        revertRouteToDraft(routeId)
      })
      window.setTimeout(() => {
        setRecentlyRevertedToDraftRouteIds((prev) => prev.filter((id) => id !== routeId))
        setNextRevertedDraftId(null)
      }, 350)
    },
    [revertRouteToDraft],
  )

  const unassignedOrders = orderList.filter((order) => !order.routeId)
  const ordersWaiting = unassignedOrders.filter((order) => order.status === 'waiting_cook')
  const ordersCooking = unassignedOrders.filter((order) => order.status === 'cooking')
  const ordersReady = unassignedOrders.filter((order) => order.status === 'ready')

  const { orderMarkers, courierMarkers, routePathCoords, orderIdsInRoute } = useDashboardMapData({
    orders,
    routes,
    couriers,
    orderList,
    focusedRouteId,
    now,
    orderStageMin,
    routeStageMin,
    restaurantCoords: RESTAURANT_COORDS,
  })

  useLayoutEffect(() => {
    const currentIds = new Set(clientRoutes.map((r) => r.id))
    const prevIds = prevClientRouteIdsRef.current
    if (!didInitClientRoutesRef.current) {
      didInitClientRoutesRef.current = true
      prevClientRouteIdsRef.current = currentIds
      return
    }
    prevClientRouteIdsRef.current = currentIds
    const newlyActiveIds = clientRoutes.filter((r) => !prevIds.has(r.id)).map((r) => r.id)
    if (newlyActiveIds.length === 0) return
    setRecentlyMovedToActiveRouteIds((prev) => [...prev, ...newlyActiveIds])
    const t = window.setTimeout(() => {
      setRecentlyMovedToActiveRouteIds((prev) => prev.filter((id) => !newlyActiveIds.includes(id)))
    }, 350)
    return () => window.clearTimeout(t)
  }, [clientRoutes])

  const handleDeleteDraft = useCallback((routeId: string) => {
    deleteRouteDraft(routeId)
  }, [deleteRouteDraft])

  return (
    <DashboardLayout
      dashboardRef={dashboardRef}
      isMobileMapOpen={isMobileMapOpen}
      resizerJustInteractedRef={resizerJustInteractedRef}
    >
      <DashboardMobileMap
        isOpen={isMobileMapOpen}
        onToggle={() => setIsMobileMapOpen((prev) => !prev)}
        orders={orders}
        orderMarkers={orderMarkers}
        courierMarkers={courierMarkers}
        restaurantCoords={RESTAURANT_COORDS}
        routePathCoords={routePathCoords}
        focusedRouteId={focusedRouteId}
        routes={routes}
        mapFocusCoords={mapFocusCoords}
        mapFocusBounds={mapFocusBounds}
        onClearFocus={handleMapClearFocus}
        onOrderAddToRoute={handleOrderAddToRouteFromMap}
        orderIdsInRoute={orderIdsInRoute}
        onMarkerClick={handleMarkerClick}
        onCourierMarkerClick={handleCourierMarkerClick}
        onMapBackgroundClick={handleMapBackgroundClick}
        routeFlashTrigger={routeFlashTrigger}
      />
      <DashboardLeftPanel
        leftWrapperRef={leftWrapperRef}
        onLeftPanelClick={handleLeftPanelClick}
        courierList={courierList}
        unassignedOrdersCount={unassignedOrders.length}
        ordersReady={ordersReady}
        ordersCooking={ordersCooking}
        ordersWaiting={ordersWaiting}
        routes={routes}
        orders={orders}
        couriers={couriers}
        now={now}
        orderStageMin={orderStageMin}
        routeStageMin={routeStageMin}
        highlightedOrderIdFromMap={highlightedOrderIdFromMap}
        highlightedCourierIdFromMap={highlightedCourierIdFromMap}
        onOrderCardClick={handleOrderCardClick}
        focusMapOnRoute={focusMapOnRoute}
        onCourierCardClick={handleCourierCardClick}
        createRouteDraft={createRouteDraft}
        draftRoutes={draftRoutes}
        draftSectionExiting={draftSectionExiting}
        setDraftSectionExiting={setDraftSectionExiting}
        assignedRoutes={assignedRoutes}
        recentlyRevertedToDraftRouteIds={recentlyRevertedToDraftRouteIds}
        nextRevertedDraftId={nextRevertedDraftId}
        recentlySentRouteIds={recentlySentRouteIds}
        pendingSendRouteId={pendingSendRouteId}
        pendingRevertRouteId={pendingRevertRouteId}
        onDeleteDraft={handleDeleteDraft}
        detachCourierFromRoute={detachCourierFromRoute}
        detachOrderFromRoute={detachOrderFromRoute}
        attachCourierToRoute={attachCourierToRoute}
        attachOrderToRoute={attachOrderToRoute}
        reorderRouteOrders={reorderRouteOrders}
        onSendRouteClick={handleSendRouteClick}
        onSendAfterExit={handleSendAfterExit}
        onRevertClick={handleRevertClick}
        onRevertAfterExit={handleRevertAfterExit}
        clientRoutes={clientRoutes}
        recentlyMovedToActiveRouteIds={recentlyMovedToActiveRouteIds}
      />

      <DashboardMapColumn
        rightColumnRef={rightColumnRef}
        resizerRef={resizerRef}
        mapViewMode={mapViewMode}
        isResizing={isResizing}
        rightColumnWidth={rightColumnWidth}
        dashboardWidth={dashboardWidth}
        onResizerPointerDown={handleResizerPointerDown}
        onMapViewModeChange={handleMapViewModeChange}
        orders={orders}
        orderMarkers={orderMarkers}
        courierMarkers={courierMarkers}
        restaurantCoords={RESTAURANT_COORDS}
        routePathCoords={routePathCoords}
        focusedRouteId={focusedRouteId}
        routes={routes}
        mapFocusCoords={mapFocusCoords}
        mapFocusBounds={mapFocusBounds}
        onClearFocus={handleMapClearFocus}
        onOrderAddToRoute={handleOrderAddToRouteFromMap}
        orderIdsInRoute={orderIdsInRoute}
        onMarkerClick={handleMarkerClick}
        onCourierMarkerClick={handleCourierMarkerClick}
        onMapBackgroundClick={handleMapBackgroundClick}
        routeFlashTrigger={routeFlashTrigger}
      />
    </DashboardLayout>
  )
}
