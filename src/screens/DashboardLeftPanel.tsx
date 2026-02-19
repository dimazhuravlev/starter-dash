import type { RefObject } from 'react'
import { type Courier, type Order, type Route } from '../model/types'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import { CouriersColumn } from '../entities/CouriersColumn'
import { DeliveryColumn } from '../entities/DeliveryColumn'
import { OrdersSection } from '../entities/OrdersSection'
import { RoutesColumn } from '../entities/RoutesColumn'

export type DashboardLeftPanelProps = {
  leftWrapperRef: RefObject<HTMLDivElement | null>
  courierList: Courier[]
  unassignedOrdersCount: number
  ordersReady: Order[]
  ordersCooking: Order[]
  ordersWaiting: Order[]
  routes: Record<string, Route>
  orders: Record<string, Order>
  couriers: Record<string, Courier>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedOrderIdFromMap: string | null
  highlightedCourierIdFromMap: string | null
  onOrderCardClick: (coords: { lat: number; lng: number }) => void
  focusMapOnRoute: (routeId: string) => void
  onCourierCardClick: (coords: { lat: number; lng: number }) => void
  createRouteDraft: () => void
  draftRoutes: Route[]
  draftSectionExiting: boolean
  setDraftSectionExiting: (value: boolean) => void
  assignedRoutes: Route[]
  recentlyRevertedToDraftRouteIds: string[]
  nextRevertedDraftId: string | null
  recentlySentRouteIds: string[]
  pendingSendRouteId: string | null
  pendingRevertRouteId: string | null
  onDeleteDraft: (routeId: string) => void
  detachCourierFromRoute: (routeId: string) => void
  detachOrderFromRoute: (routeId: string, orderId: string) => void
  attachCourierToRoute: (routeId: string, courierId: string) => void
  attachOrderToRoute: (routeId: string, orderId: string) => void
  reorderRouteOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  onSendRouteClick: (routeId: string) => void
  onSendAfterExit: (routeId: string) => void
  onRevertClick: (routeId: string) => void
  onRevertAfterExit: (routeId: string) => void
  clientRoutes: Route[]
  recentlyMovedToActiveRouteIds: string[]
}

export function DashboardLeftPanel({
  leftWrapperRef,
  courierList,
  unassignedOrdersCount,
  ordersReady,
  ordersCooking,
  ordersWaiting,
  routes,
  orders,
  couriers,
  now,
  orderStageMin,
  routeStageMin,
  highlightedOrderIdFromMap,
  highlightedCourierIdFromMap,
  onOrderCardClick,
  focusMapOnRoute,
  onCourierCardClick,
  createRouteDraft,
  draftRoutes,
  draftSectionExiting,
  setDraftSectionExiting,
  assignedRoutes,
  recentlyRevertedToDraftRouteIds,
  nextRevertedDraftId,
  recentlySentRouteIds,
  pendingSendRouteId,
  pendingRevertRouteId,
  onDeleteDraft,
  detachCourierFromRoute,
  detachOrderFromRoute,
  attachCourierToRoute,
  attachOrderToRoute,
  reorderRouteOrders,
  onSendRouteClick,
  onSendAfterExit,
  onRevertClick,
  onRevertAfterExit,
  clientRoutes,
  recentlyMovedToActiveRouteIds,
}: DashboardLeftPanelProps) {
  return (
    <div className="dashboard__left-wrapper" ref={leftWrapperRef}>
      <div className="dashboard__left">
        <section className="dashboard__column">
          <div className="column__title">Курьеры{courierList.length > 0 && <span className="column__title-count">{courierList.length}</span>}</div>
          <CouriersColumn
            couriers={courierList}
            routes={routes}
            orders={orders}
            now={now}
            routeStageMin={routeStageMin}
            highlightedCourierIdFromMap={highlightedCourierIdFromMap}
            onCourierCardClick={onCourierCardClick}
          />
        </section>
        <div className="dashboard__divider" aria-hidden />
        <section className="dashboard__column">
          <div className="column__title">Заказы{unassignedOrdersCount > 0 && <span className="column__title-count">{unassignedOrdersCount}</span>}</div>
          <OrdersSection
            title="Готовы"
            orders={ordersReady}
            routes={routes}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
            highlightedOrderIdFromMap={highlightedOrderIdFromMap}
            onOrderCardClick={onOrderCardClick}
            onOrderAttachedToRoute={focusMapOnRoute}
          />
          <OrdersSection
            title="Готовятся"
            orders={ordersCooking}
            routes={routes}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
            highlightedOrderIdFromMap={highlightedOrderIdFromMap}
            onOrderCardClick={onOrderCardClick}
            onOrderAttachedToRoute={focusMapOnRoute}
          />
          <OrdersSection
            title="Ожидают готовки"
            orders={ordersWaiting}
            routes={routes}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
            highlightedOrderIdFromMap={highlightedOrderIdFromMap}
            onOrderCardClick={onOrderCardClick}
            onOrderAttachedToRoute={focusMapOnRoute}
          />
        </section>
        <div className="dashboard__divider" aria-hidden />
        <RoutesColumn
          createRouteDraft={createRouteDraft}
          draftRoutes={draftRoutes}
          draftSectionExiting={draftSectionExiting}
          setDraftSectionExiting={setDraftSectionExiting}
          assignedRoutes={assignedRoutes}
          courierList={courierList}
          couriers={couriers}
          orders={orders}
          routes={routes}
          now={now}
          orderStageMin={orderStageMin}
          routeStageMin={routeStageMin}
          highlightedOrderIdFromMap={highlightedOrderIdFromMap}
          recentlyRevertedToDraftRouteIds={recentlyRevertedToDraftRouteIds}
          nextRevertedDraftId={nextRevertedDraftId}
          recentlySentRouteIds={recentlySentRouteIds}
          pendingSendRouteId={pendingSendRouteId}
          pendingRevertRouteId={pendingRevertRouteId}
          onDeleteDraft={onDeleteDraft}
          detachCourierFromRoute={detachCourierFromRoute}
          detachOrderFromRoute={detachOrderFromRoute}
          attachCourierToRoute={attachCourierToRoute}
          attachOrderToRoute={attachOrderToRoute}
          reorderRouteOrders={reorderRouteOrders}
          focusMapOnRoute={focusMapOnRoute}
          onSendRouteClick={onSendRouteClick}
          onSendAfterExit={onSendAfterExit}
          onRevertClick={onRevertClick}
          onRevertAfterExit={onRevertAfterExit}
        />
        <div className="dashboard__divider" aria-hidden />
        <DeliveryColumn
          clientRoutes={clientRoutes}
          couriers={couriers}
          orders={orders}
          now={now}
          orderStageMin={orderStageMin}
          routeStageMin={routeStageMin}
          highlightedOrderIdFromMap={highlightedOrderIdFromMap}
          recentlyMovedToActiveRouteIds={recentlyMovedToActiveRouteIds}
          focusMapOnRoute={focusMapOnRoute}
        />
      </div>
    </div>
  )
}
