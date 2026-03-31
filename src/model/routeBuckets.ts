import type { Order, Route } from './types'

/**
 * Заказы ещё в кухонном конвейере — маршрут в pickup «ожидает получения» (как hasUnreadyOrders в simulation).
 */
export function routeHasUnreadyKitchenOrders(route: Route, orders: Record<string, Order>): boolean {
  return route.orderIds.some((id) => {
    const o = orders[id]
    return Boolean(o && (o.status === 'waiting_cook' || o.status === 'cooking'))
  })
}
