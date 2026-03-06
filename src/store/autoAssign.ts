import { type Courier, type Order, type Route } from '../model/types'
import { MINUTE_MS, type OrderStageMin } from '../model/rules'
import { RESTAURANT_COORDS } from '../model/types'

/** Допустимая разница времени готовности заказов (мин) — один заказ не будет долго ждать другой */
const PREP_TIME_TOLERANCE_MIN = 5

/** Максимальное расстояние между заказами для объединения в маршрут (км) */
const MAX_ORDER_DISTANCE_KM = 2.5

/** Haversine: расстояние между двумя точками в км */
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  return R * c
}

/** Оценка времени готовности заказа (мс) */
function getOrderReadyAt(
  order: Order,
  now: number,
  orderStageMin: OrderStageMin,
): number {
  if (order.status === 'ready') {
    return now
  }
  if (order.status === 'cooking') {
    const stageMs = orderStageMin.cooking * MINUTE_MS
    const remaining = Math.max(stageMs - (now - order.statusStartedAt), 0)
    return now + remaining
  }
  if (order.status === 'waiting_cook') {
    const waitMs = orderStageMin.waiting_cook * MINUTE_MS
    const cookMs = orderStageMin.cooking * MINUTE_MS
    const elapsed = now - order.statusStartedAt
    const remainingWait = Math.max(waitMs - elapsed, 0)
    const cookingStartAt = order.statusStartedAt + waitMs
    const remainingCook =
      remainingWait > 0 ? cookMs : Math.max(cookMs - (now - cookingStartAt), 0)
    return now + remainingWait + remainingCook
  }
  return now
}

/** Сортировка заказов для маршрута: ресторан → ближайший → следующий по пути */
function buildRouteOrderIds(
  primary: Order,
  candidates: Order[],
  now: number,
  orderStageMin: OrderStageMin,
): string[] {
  const result = [primary.id]
  const used = new Set([primary.id])
  let lastCoords = primary.coords

  const primaryReadyAt = getOrderReadyAt(primary, now, orderStageMin)
  const toleranceMs = PREP_TIME_TOLERANCE_MIN * MINUTE_MS

  while (result.length < 3 && candidates.length > 0) {
    const valid = candidates.filter(
      (c) =>
        !used.has(c.id) &&
        Math.abs(getOrderReadyAt(c, now, orderStageMin) - primaryReadyAt) <= toleranceMs &&
        haversineKm(lastCoords, c.coords) <= MAX_ORDER_DISTANCE_KM,
    )
    if (valid.length === 0) break

    valid.sort((a, b) => {
      const distA = haversineKm(lastCoords, a.coords)
      const distB = haversineKm(lastCoords, b.coords)
      return distA - distB
    })
    const next = valid[0]
    result.push(next.id)
    used.add(next.id)
    lastCoords = next.coords
    candidates = candidates.filter((c) => !used.has(c.id))
  }

  return result
}

export type AutoAssignResult = {
  courierId: string
  orderIds: string[]
} | null

export function computeAutoAssign(
  couriers: Record<string, Courier>,
  orders: Record<string, Order>,
  routes: Record<string, Route>,
  now: number,
  orderStageMin: OrderStageMin,
): AutoAssignResult {
  const orderIdsInRoutes = new Set(Object.values(routes).flatMap((r) => r.orderIds))

  const freeCouriers = Object.values(couriers)
    .filter((c) => c.status === 'free')
    .sort((a, b) => (a.freeSince ?? now) - (b.freeSince ?? now))

  const availableOrders = Object.values(orders).filter(
    (o) =>
      (o.status === 'ready' || o.status === 'cooking' || o.status === 'waiting_cook') &&
      !orderIdsInRoutes.has(o.id) &&
      !o.routeId,
  )

  if (freeCouriers.length === 0 || availableOrders.length === 0) {
    return null
  }

  availableOrders.sort((a, b) => {
    const orderPriority = (o: Order) => (o.status === 'ready' ? 0 : o.status === 'cooking' ? 1 : 2)
    const pA = orderPriority(a)
    const pB = orderPriority(b)
    if (pA !== pB) return pA - pB
    const readyA = getOrderReadyAt(a, now, orderStageMin)
    const readyB = getOrderReadyAt(b, now, orderStageMin)
    return readyA - readyB
  })

  const courier = freeCouriers[0]
  const primary = availableOrders[0]
  const rest = availableOrders.slice(1)
  const orderIds = buildRouteOrderIds(primary, rest, now, orderStageMin)

  return { courierId: courier.id, orderIds }
}
