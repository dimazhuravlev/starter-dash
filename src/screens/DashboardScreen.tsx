import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CourierMarkerItem } from '../components/MapboxMap'
import { flushSync } from 'react-dom'
import { type Courier, type Order, type Route, RESTAURANT_COORDS } from '../model/types'
import { routeHasUnreadyKitchenOrders } from '../model/routeBuckets'
import { DashboardLayout } from './DashboardLayout'
import { DashboardLeftPanel } from './DashboardLeftPanel'
import { DashboardMapColumn } from './DashboardMapColumn'
import { DashboardMobileMap } from './DashboardMobileMap'
import { useDashboardMapData } from './useDashboardMapData'
import { useDashboardMapFocus } from './useDashboardMapFocus'
import { useDashboardResize } from './useDashboardResize'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'

type DashboardScreenProps = {
  routeMode: 'auto' | 'manual'
  onRouteModeChange: (mode: 'auto' | 'manual') => void
  theme: 'dark' | 'light'
  orders: Record<string, Order>
  couriers: Record<string, Courier>
  routes: Record<string, Route>
  createRouteDraft: () => string
  resetRouteDraft: (routeId: string) => void
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
  routeMode,
  onRouteModeChange,
  theme,
  orders,
  couriers,
  routes,
  createRouteDraft,
  resetRouteDraft,
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

  const draftRoutes = useMemo(() => {
    if (routeMode === 'auto') return []
    const drafts = routeList.filter((route) => route.status === 'draft')
    const empty = drafts.filter((r) => !r.courierId && r.orderIds.length === 0)
    const filled = drafts.filter((r) => r.courierId || r.orderIds.length > 0)
    empty.sort((a, b) => a.createdAt - b.createdAt)
    filled.sort((a, b) => a.createdAt - b.createdAt)
    return [...empty, ...filled]
  }, [routeList, routeMode])
  const sentRoutes = useMemo(() => routeList.filter((route) => route.status === 'sent'), [routeList])
  /** Ручной режим: авто-сборка на pickup с неготовыми заказами — в «Собрать маршрут» (карточка доставки) */
  const sentPickupAwaitingKitchen = useMemo(
    () =>
      [...sentRoutes]
        .filter(
          (route) =>
            route.step.kind === 'pickup' &&
            route.assembly === 'auto' &&
            routeHasUnreadyKitchenOrders(route, orders),
        )
        .sort((a, b) => a.createdAt - b.createdAt),
    [sentRoutes, orders],
  )
  /**
   * Ручной режим: «Назначенные» — все sent pickup, кроме авто-маршрутов, которые ещё ждут кухню
   * (те показываются в «Собрать маршрут»). После auto→manual авто-маршрут «в получении»
   * остаётся с assembly: 'auto' и тоже попадает сюда.
   */
  const manualAssignedRoutes = useMemo(
    () =>
      [...sentRoutes]
        .filter((route) => {
          if (route.step.kind !== 'pickup') return false
          if (route.assembly === 'auto' && routeHasUnreadyKitchenOrders(route, orders)) {
            return false
          }
          return true
        })
        .sort((a, b) => a.createdAt - b.createdAt),
    [sentRoutes, orders],
  )
  /** Авторежим: только назначенные pickup (шаблонов в UI нет) */
  const autoAssembledRoutes = useMemo(
    () =>
      [...routeList]
        .filter((route) => route.status === 'sent' && route.step.kind === 'pickup')
        .sort((a, b) => b.createdAt - a.createdAt),
    [routeList],
  )
  const clientRoutes = useMemo(
    () => sentRoutes.filter((route) => route.step.kind !== 'pickup' && route.step.kind !== 'returning'),
    [sentRoutes],
  )

  const courierMarkersRef = useRef<CourierMarkerItem[]>([])
  const mapFocus = useDashboardMapFocus({
    routes,
    orders,
    draftRoutes,
    routeMode,
    createRouteDraft,
    attachOrderToRoute,
    resizerJustInteractedRef,
    courierMarkersRef,
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
  /** Одноразовый «металлический» блик для карточек, впервые попавших в «Собранные автоматически» уже в авторежиме */
  const [autoTemplateShimmerRouteIds, setAutoTemplateShimmerRouteIds] = useState<string[]>([])
  const prevClientRouteIdsRef = useRef<Set<string>>(new Set())
  const didInitClientRoutesRef = useRef(false)
  const mountedRef = useRef(true)
  const isFirstRoutesLayoutRef = useRef(true)
  const prevRouteModeForShimmerRef = useRef(routeMode)
  const suppressAutoTemplateShimmerIdsRef = useRef<Set<string>>(new Set())
  const prevAutoAssembledIdsRef = useRef<Set<string>>(new Set())
  useLayoutEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

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
        if (mountedRef.current) setRecentlySentRouteIds((prev) => prev.filter((id) => id !== routeId))
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
      /* Карточка уже вызвала onRevertAfterExit после 350ms, сразу переносим маршрут в черновики */
      revertRouteToDraft(routeId)
      window.setTimeout(() => {
        if (mountedRef.current) {
          setRecentlyRevertedToDraftRouteIds((prev) => prev.filter((id) => id !== routeId))
          setNextRevertedDraftId(null)
        }
      }, 350)
    },
    [revertRouteToDraft],
  )

  const orderIdsInAnyRoute = useMemo(
    () => new Set(routeList.flatMap((r) => r.orderIds)),
    [routeList],
  )
  const ordersVisibleInColumn = orderList.filter(
    (order) =>
      !orderIdsInAnyRoute.has(order.id) ||
      order.status === 'waiting_cook' ||
      order.status === 'cooking',
  )
  const ordersWaiting = ordersVisibleInColumn.filter((order) => order.status === 'waiting_cook')
  const ordersCooking = ordersVisibleInColumn.filter((order) => order.status === 'cooking')
  const ordersReady = ordersVisibleInColumn.filter((order) => order.status === 'ready')

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

  courierMarkersRef.current = courierMarkers

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

  const handleAutoTemplateShimmerEnd = useCallback((routeId: string) => {
    setAutoTemplateShimmerRouteIds((prev) => prev.filter((id) => id !== routeId))
  }, [])

  useLayoutEffect(() => {
    if (routeMode !== 'auto') {
      prevAutoAssembledIdsRef.current = new Set()
      prevRouteModeForShimmerRef.current = routeMode
      if (isFirstRoutesLayoutRef.current) {
        isFirstRoutesLayoutRef.current = false
      }
      return
    }
    const currentIds = new Set(autoAssembledRoutes.map((r) => r.id))
    const suppress = suppressAutoTemplateShimmerIdsRef.current
    if (isFirstRoutesLayoutRef.current) {
      isFirstRoutesLayoutRef.current = false
      for (const id of currentIds) {
        suppress.add(id)
      }
      prevAutoAssembledIdsRef.current = new Set(currentIds)
      prevRouteModeForShimmerRef.current = routeMode
      return
    }
    if (prevRouteModeForShimmerRef.current !== 'auto') {
      for (const id of currentIds) {
        suppress.add(id)
      }
    }
    prevRouteModeForShimmerRef.current = routeMode
    const prevIds = prevAutoAssembledIdsRef.current
    const newcomers = [...currentIds].filter((id) => !prevIds.has(id))
    prevAutoAssembledIdsRef.current = new Set(currentIds)
    const toShimmer = newcomers.filter((id) => !suppress.has(id))
    if (toShimmer.length === 0) return
    setAutoTemplateShimmerRouteIds((prev) => {
      const next = new Set(prev)
      for (const id of toShimmer) {
        next.add(id)
      }
      return [...next]
    })
  }, [routeMode, autoAssembledRoutes])

  /** Кнопка удаления на заполненном шаблоне: если уже есть пустой шаблон — маршрут удаляется целиком, иначе только сброс содержимого. */
  const handleDraftTemplateRemove = useCallback(
    (routeId: string) => {
      const route = routes[routeId]
      if (!route || route.status !== 'draft') return
      const isEmpty = !route.courierId && route.orderIds.length === 0
      const hasOtherEmpty = Object.values(routes).some(
        (r) =>
          r.id !== routeId && r.status === 'draft' && !r.courierId && r.orderIds.length === 0,
      )
      if (!isEmpty && hasOtherEmpty) {
        deleteRouteDraft(routeId)
      } else {
        resetRouteDraft(routeId)
      }
    },
    [routes, deleteRouteDraft, resetRouteDraft],
  )

  return (
    <DashboardLayout
      dashboardRef={dashboardRef}
      isMobileMapOpen={isMobileMapOpen}
      resizerJustInteractedRef={resizerJustInteractedRef}
    >
      <DashboardMobileMap
        theme={theme}
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
        routeMode={routeMode}
        onRouteModeChange={onRouteModeChange}
        leftWrapperRef={leftWrapperRef}
        courierList={courierList}
        unassignedOrdersCount={ordersVisibleInColumn.length}
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
        draftRoutes={draftRoutes}
        sentPickupAwaitingKitchen={sentPickupAwaitingKitchen}
        draftSectionExiting={draftSectionExiting}
        setDraftSectionExiting={setDraftSectionExiting}
        manualAssignedRoutes={manualAssignedRoutes}
        autoAssembledRoutes={autoAssembledRoutes}
        recentlyRevertedToDraftRouteIds={recentlyRevertedToDraftRouteIds}
        nextRevertedDraftId={nextRevertedDraftId}
        recentlySentRouteIds={recentlySentRouteIds}
        pendingSendRouteId={pendingSendRouteId}
        pendingRevertRouteId={pendingRevertRouteId}
        onResetDraftTemplate={handleDraftTemplateRemove}
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
        autoTemplateShimmerRouteIds={autoTemplateShimmerRouteIds}
        onAutoTemplateShimmerEnd={handleAutoTemplateShimmerEnd}
      />

      <DashboardMapColumn
        theme={theme}
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
