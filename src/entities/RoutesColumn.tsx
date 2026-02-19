import { type Courier, type Order, type Route } from '../model/types'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import plusIcon from '../assets/Plus.svg'
import { RouteDeliveryCard } from './RouteDeliveryCard'
import { RouteDraftCard } from './RouteDraftCard'

export type RoutesColumnProps = {
  createRouteDraft: () => void
  draftRoutes: Route[]
  draftSectionExiting: boolean
  setDraftSectionExiting: (value: boolean) => void
  assignedRoutes: Route[]
  courierList: Courier[]
  couriers: Record<string, Courier>
  orders: Record<string, Order>
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedOrderIdFromMap: string | null
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
  focusMapOnRoute: (routeId: string) => void
  onSendRouteClick: (routeId: string) => void
  onSendAfterExit: (routeId: string) => void
  onRevertClick: (routeId: string) => void
  onRevertAfterExit: (routeId: string) => void
}

export function RoutesColumn({
  createRouteDraft,
  draftRoutes,
  draftSectionExiting,
  setDraftSectionExiting,
  assignedRoutes,
  courierList,
  couriers,
  orders,
  routes,
  now,
  orderStageMin,
  routeStageMin,
  highlightedOrderIdFromMap,
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
  focusMapOnRoute,
  onSendRouteClick,
  onSendAfterExit,
  onRevertClick,
  onRevertAfterExit,
}: RoutesColumnProps) {
  return (
    <section className="dashboard__column">
      <button
        type="button"
        className="column__title column__title--with-action column__title--button"
        onClick={createRouteDraft}
        aria-label="Новый маршрут"
      >
        <span className="column__title-with-count">
          <span>Маршруты</span>
          {assignedRoutes.length > 0 && <span className="column__title-count">{assignedRoutes.length}</span>}
        </span>
        <img src={plusIcon} alt="" width={16} height={16} />
      </button>
      {(draftRoutes.length > 0 || draftSectionExiting) ? (
        <div
          className={`section${draftSectionExiting ? ' section--route-exiting' : ''}`}
          onAnimationEnd={(e) => {
            if (e.animationName === 'route-draft-disappear') setDraftSectionExiting(false)
          }}
        >
          <div className="section__title">Новый маршрут</div>
          <div className="section__list">
            {draftRoutes.map((route) => (
              <RouteDraftCard
                key={route.id}
                route={route}
                couriers={courierList}
                orders={orders}
                now={now}
                orderStageMin={orderStageMin}
                routeStageMin={routeStageMin}
                highlightedOrderIdFromMap={highlightedOrderIdFromMap}
                isJustAppeared={recentlyRevertedToDraftRouteIds.includes(route.id) || nextRevertedDraftId === route.id}
                onDelete={onDeleteDraft}
                onDetachCourier={detachCourierFromRoute}
                onAttachCourier={attachCourierToRoute}
                onDetachOrder={detachOrderFromRoute}
                onAttachOrder={(routeId, orderId) => {
                  attachOrderToRoute(routeId, orderId)
                  focusMapOnRoute(routeId)
                }}
                onReorderOrders={reorderRouteOrders}
                onSend={onSendRouteClick}
                onSendAfterExit={onSendAfterExit}
                pendingSendRouteId={pendingSendRouteId}
                onFocusOnMap={focusMapOnRoute}
                onExiting={draftRoutes.length === 1 ? () => setDraftSectionExiting(true) : undefined}
              />
            ))}
          </div>
        </div>
      ) : null}
      {assignedRoutes.length > 0 ? (
        <div className="section">
          <div className="section__title">Назначенные</div>
          <div className="section__list">
            {assignedRoutes.map((route) => (
              <RouteDeliveryCard
                key={route.id}
                route={route}
                courier={couriers[route.courierId]}
                orders={orders}
                now={now}
                orderStageMin={orderStageMin}
                routeStageMin={routeStageMin}
                highlightedOrderIdFromMap={highlightedOrderIdFromMap}
                isJustAppeared={recentlySentRouteIds.includes(route.id)}
                onRevertToDraft={onRevertClick}
                onRevertAfterExit={onRevertAfterExit}
                pendingRevertRouteId={pendingRevertRouteId}
                onFocusOnMap={focusMapOnRoute}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
