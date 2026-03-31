import type { RefObject } from 'react'
import { type Courier, type Order, type Route } from '../model/types'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import { CouriersColumn } from '../entities/CouriersColumn'
import { DeliveryColumn } from '../entities/DeliveryColumn'
import { OrdersSection } from '../entities/OrdersSection'
import { RoutesColumn } from '../entities/RoutesColumn'

export type DashboardLeftPanelProps = {
  routeMode: 'auto' | 'manual'
  onRouteModeChange: (mode: 'auto' | 'manual') => void
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
  onCourierCardClick: (courierId: string) => void
  draftRoutes: Route[]
  /** Отправленные pickup с неготовыми заказами — в секции «Собрать маршрут» вместе с черновиками */
  sentPickupAwaitingKitchen: Route[]
  draftSectionExiting: boolean
  setDraftSectionExiting: (value: boolean) => void
  manualAssignedRoutes: Route[]
  autoAssembledRoutes: Route[]
  recentlyRevertedToDraftRouteIds: string[]
  nextRevertedDraftId: string | null
  recentlySentRouteIds: string[]
  pendingSendRouteId: string | null
  pendingRevertRouteId: string | null
  onResetDraftTemplate: (routeId: string) => void
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
  autoTemplateShimmerRouteIds: string[]
  onAutoTemplateShimmerEnd: (routeId: string) => void
}

export function DashboardLeftPanel({
  routeMode,
  onRouteModeChange,
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
  draftRoutes,
  sentPickupAwaitingKitchen,
  draftSectionExiting,
  setDraftSectionExiting,
  manualAssignedRoutes,
  autoAssembledRoutes,
  recentlyRevertedToDraftRouteIds,
  nextRevertedDraftId,
  recentlySentRouteIds,
  pendingSendRouteId,
  pendingRevertRouteId,
  onResetDraftTemplate,
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
  autoTemplateShimmerRouteIds,
  onAutoTemplateShimmerEnd,
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
          routeMode={routeMode}
          onRouteModeChange={onRouteModeChange}
          draftRoutes={draftRoutes}
          sentPickupAwaitingKitchen={sentPickupAwaitingKitchen}
          draftSectionExiting={draftSectionExiting}
          setDraftSectionExiting={setDraftSectionExiting}
          manualAssignedRoutes={manualAssignedRoutes}
          autoAssembledRoutes={autoAssembledRoutes}
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
          onResetDraftTemplate={onResetDraftTemplate}
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
          autoTemplateShimmerRouteIds={autoTemplateShimmerRouteIds}
          onAutoTemplateShimmerEnd={onAutoTemplateShimmerEnd}
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
