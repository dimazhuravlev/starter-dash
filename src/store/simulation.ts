import {
  type Courier,
  type Order,
  type OrderStatus,
  type Route,
  type RouteStepKind,
} from '../model/types'
import {
  MINUTE_MS,
  ORDER_CREATE_INTERVAL_MIN,
  ORDER_STAGE_MIN,
  ROUTE_STAGE_MIN,
} from '../model/rules'

export type DashboardState = {
  now: number
  isRunning: boolean
  speed: 1 | 5 | 20
  orders: Record<string, Order>
  couriers: Record<string, Courier>
  routes: Record<string, Route>
  lastOrderCreatedAt: number
  nextOrderId: number
  nextRouteId: number
}

const ORDER_STAGE_MS: Record<'waiting_cook' | 'cooking' | 'ready', number> = {
  waiting_cook: ORDER_STAGE_MIN.waiting_cook * MINUTE_MS,
  cooking: ORDER_STAGE_MIN.cooking * MINUTE_MS,
  ready: ORDER_STAGE_MIN.ready * MINUTE_MS,
}

const ROUTE_STAGE_MS: Record<RouteStepKind, number> = {
  pickup: ROUTE_STAGE_MIN.pickup * MINUTE_MS,
  enroute: ROUTE_STAGE_MIN.enroute * MINUTE_MS,
  handoff: ROUTE_STAGE_MIN.handoff * MINUTE_MS,
  returning: ROUTE_STAGE_MIN.returning * MINUTE_MS,
}

const ADDRESS_SEEDS = [
  'ул. Ленина, 10',
  'пр-т Мира, 32',
  'ул. Пушкина, 18',
  'ул. Гагарина, 7',
  'ул. Садовая, 41',
  'ул. Молодежная, 5',
  'ул. Советская, 22',
  'ул. Победы, 14',
  'ул. Центральная, 9',
]

const COOKING_PIPELINE: OrderStatus[] = [
  'waiting_cook',
  'cooking',
  'ready',
]

const ROUTE_PIPELINE: OrderStatus[] = [
  'pickup',
  'enroute',
  'handoff',
  'returning',
]

const isCookingStatus = (status: OrderStatus): status is 'waiting_cook' | 'cooking' | 'ready' =>
  COOKING_PIPELINE.includes(status)

const isRouteStatus = (status: OrderStatus): status is RouteStepKind =>
  ROUTE_PIPELINE.includes(status)

const createOrder = (id: string, createdAt: number, index: number): Order => ({
  id,
  address: ADDRESS_SEEDS[index % ADDRESS_SEEDS.length],
  status: 'waiting_cook',
  createdAt,
  statusStartedAt: createdAt,
  etaMin: Math.ceil(ORDER_STAGE_MS.waiting_cook / MINUTE_MS),
})

const computeEtaMin = (order: Order, now: number): number => {
  let durationMs = 0
  if (isCookingStatus(order.status)) {
    durationMs = ORDER_STAGE_MS[order.status]
  } else if (isRouteStatus(order.status)) {
    durationMs = ROUTE_STAGE_MS[order.status]
  } else {
    return 0
  }
  const remainingMs = Math.max(durationMs - (now - order.statusStartedAt), 0)
  return Math.ceil(remainingMs / MINUTE_MS)
}

const advanceCookingPipeline = (order: Order, now: number): Order => {
  if (!isCookingStatus(order.status)) {
    return order
  }

  let status: OrderStatus = order.status
  let statusStartedAt = order.statusStartedAt
  let elapsed = now - statusStartedAt

  if (status === 'waiting_cook' && elapsed >= ORDER_STAGE_MS.waiting_cook) {
    status = 'cooking'
    statusStartedAt += ORDER_STAGE_MS.waiting_cook
    elapsed = now - statusStartedAt
  }

  if (status === 'cooking' && elapsed >= ORDER_STAGE_MS.cooking) {
    status = 'ready'
    statusStartedAt += ORDER_STAGE_MS.cooking
  }

  return {
    ...order,
    status,
    statusStartedAt,
  }
}

const setOrderStatus = (
  orders: Record<string, Order>,
  orderId: string | undefined,
  status: OrderStatus,
  when: number,
) => {
  if (!orderId) return
  const order = orders[orderId]
  if (!order) return
  orders[orderId] = {
    ...order,
    status,
    statusStartedAt: when,
  }
}

const updateOrder = (
  orders: Record<string, Order>,
  orderId: string | undefined,
  update: Partial<Order>,
) => {
  if (!orderId) return
  const order = orders[orderId]
  if (!order) return
  orders[orderId] = {
    ...order,
    ...update,
  }
}

const updateCourier = (
  couriers: Record<string, Courier>,
  courierId: string | undefined,
  update: Partial<Courier>,
) => {
  if (!courierId) return
  const courier = couriers[courierId]
  if (!courier) return
  couriers[courierId] = {
    ...courier,
    ...update,
  }
}

export const step = (state: DashboardState, deltaMs: number): DashboardState => {
  if (deltaMs <= 0) {
    return state
  }

  const now = state.now + deltaMs
  const orders: Record<string, Order> = { ...state.orders }
  const couriers: Record<string, Courier> = { ...state.couriers }
  const routes: Record<string, Route> = { ...state.routes }
  let lastOrderCreatedAt = state.lastOrderCreatedAt
  let nextOrderId = state.nextOrderId

  const orderIntervalMs = ORDER_CREATE_INTERVAL_MIN * MINUTE_MS
  while (now - lastOrderCreatedAt >= orderIntervalMs) {
    lastOrderCreatedAt += orderIntervalMs
    const orderId = `order_${nextOrderId}`
    orders[orderId] = createOrder(orderId, lastOrderCreatedAt, nextOrderId)
    nextOrderId += 1
  }

  Object.values(orders).forEach((order) => {
    if (!order.routeId) {
      orders[order.id] = advanceCookingPipeline(order, now)
    }
  })

  Object.values(routes).forEach((route) => {
    if (route.status !== 'sent' || route.orderIds.length === 0) {
      return
    }

    const currentOrderId = route.orderIds[route.step.orderIndex]
    const currentOrder = orders[currentOrderId]
    if (!currentOrder) {
      return
    }

    const durationMs = ROUTE_STAGE_MS[route.step.kind]
    const elapsed = now - currentOrder.statusStartedAt
    if (elapsed < durationMs) {
      return
    }

    const stepCompletedAt = currentOrder.statusStartedAt + durationMs
    if (route.step.kind === 'pickup') {
      setOrderStatus(orders, currentOrderId, 'enroute', stepCompletedAt)
      routes[route.id] = {
        ...route,
        step: {
          ...route.step,
          kind: 'enroute',
        },
      }
      return
    }

    if (route.step.kind === 'enroute') {
      setOrderStatus(orders, currentOrderId, 'handoff', stepCompletedAt)
      routes[route.id] = {
        ...route,
        step: {
          ...route.step,
          kind: 'handoff',
        },
      }
      return
    }

    if (route.step.kind === 'handoff') {
      setOrderStatus(orders, currentOrderId, 'delivered', stepCompletedAt)

      if (route.step.orderIndex < route.orderIds.length - 1) {
        const nextStep = {
          kind: 'pickup' as const,
          orderIndex: route.step.orderIndex + 1,
        }
        routes[route.id] = {
          ...route,
          step: nextStep,
        }
        const nextOrderId = route.orderIds[nextStep.orderIndex]
        setOrderStatus(orders, nextOrderId, 'pickup', stepCompletedAt)
        updateOrder(orders, nextOrderId, {
          routeId: route.id,
          courierId: route.courierId,
        })
        return
      }

      routes[route.id] = {
        ...route,
        step: {
          kind: 'returning',
          orderIndex: route.step.orderIndex,
        },
      }

      route.orderIds.forEach((orderId) => {
        setOrderStatus(orders, orderId, 'returning', stepCompletedAt)
      })
      updateCourier(couriers, route.courierId, { status: 'returning' })
      return
    }

    if (route.step.kind === 'returning') {
      routes[route.id] = {
        ...route,
        status: 'done',
      }
      route.orderIds.forEach((orderId) => {
        setOrderStatus(orders, orderId, 'delivered', stepCompletedAt)
      })
      updateCourier(couriers, route.courierId, { status: 'free', routeId: undefined })
    }
  })

  Object.values(orders).forEach((order) => {
    orders[order.id] = {
      ...order,
      etaMin: computeEtaMin(order, now),
    }
  })

  return {
    ...state,
    now,
    orders,
    couriers,
    routes,
    lastOrderCreatedAt,
    nextOrderId,
  }
}
