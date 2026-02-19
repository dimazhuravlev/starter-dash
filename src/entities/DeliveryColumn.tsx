import { type Courier, type Order, type Route } from '../model/types'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import { RouteDeliveryCard } from './RouteDeliveryCard'

export type DeliveryColumnProps = {
  clientRoutes: Route[]
  couriers: Record<string, Courier>
  orders: Record<string, Order>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedOrderIdFromMap: string | null
  recentlyMovedToActiveRouteIds: string[]
  focusMapOnRoute: (routeId: string) => void
}

export function DeliveryColumn({
  clientRoutes,
  couriers,
  orders,
  now,
  orderStageMin,
  routeStageMin,
  highlightedOrderIdFromMap,
  recentlyMovedToActiveRouteIds,
  focusMapOnRoute,
}: DeliveryColumnProps) {
  return (
    <section className="dashboard__column">
      <div className="column__title">Доставка{clientRoutes.length > 0 && <span className="column__title-count">{clientRoutes.length}</span>}</div>
      {clientRoutes.length > 0 ? (
        <div className="section">
          <div className="section__title">Активные</div>
          <div className="section__list">
            {clientRoutes.map((route) => (
              <RouteDeliveryCard
                key={route.id}
                route={route}
                courier={couriers[route.courierId]}
                orders={orders}
                now={now}
                orderStageMin={orderStageMin}
                routeStageMin={routeStageMin}
                highlightedOrderIdFromMap={highlightedOrderIdFromMap}
                isJustAppeared={recentlyMovedToActiveRouteIds.includes(route.id)}
                onFocusOnMap={focusMapOnRoute}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
