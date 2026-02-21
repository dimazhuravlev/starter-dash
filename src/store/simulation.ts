import {
  type Courier,
  type Order,
  type OrderStatus,
  type Route,
  type RouteStepKind,
} from '../model/types'
import { MINUTE_MS, type OrderStageMin, type RouteStageMin } from '../model/rules'
import addressSeeds from '../data/addressSeeds.json'

export type DashboardState = {
  now: number
  isRunning: boolean
  speed: 1 | 3 | 5 | 20
  orders: Record<string, Order>
  couriers: Record<string, Courier>
  routes: Record<string, Route>
  lastOrderCreatedAt: number
  nextOrderId: number
  nextRouteId: number
  orderCreateIntervalMin: number
  orderStageMin: OrderStageMin
  orderSlaOptionsMin: number[]
  routeStageMin: RouteStageMin
}

const getOrderStageMs = (orderStageMin: OrderStageMin) => ({
  waiting_cook: orderStageMin.waiting_cook * MINUTE_MS,
  cooking: orderStageMin.cooking * MINUTE_MS,
  ready: orderStageMin.ready * MINUTE_MS,
})

const getRouteStageMs = (routeStageMin: RouteStageMin): Record<RouteStepKind, number> => ({
  pickup: routeStageMin.pickup * MINUTE_MS,
  enroute: routeStageMin.enroute * MINUTE_MS,
  handoff: routeStageMin.handoff * MINUTE_MS,
  returning: routeStageMin.returning * MINUTE_MS,
})

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

const createOrder = (
  id: string,
  createdAt: number,
  index: number,
  orderStageMin: OrderStageMin,
  orderSlaOptionsMin: number[],
): Order => {
  const seed = addressSeeds[index % addressSeeds.length]
  const orderNumber = 30000 + index + Math.floor(Math.random() * 20000)
  const totalRub = 400 + Math.floor(Math.random() * 2600)
  return {
    id,
    address: seed.address,
    orderNumber,
    totalRub,
    coords: seed.coords,
    status: 'waiting_cook',
    createdAt,
    statusStartedAt: createdAt,
    etaMin: Math.ceil(orderStageMin.waiting_cook),
    slaTotalMin:
      orderSlaOptionsMin.length > 0
        ? orderSlaOptionsMin[Math.floor(Math.random() * orderSlaOptionsMin.length)]
        : 40,
  }
}

const shuffle = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5)

/** Выбирает count случайных неповторяющихся индексов из [0, max) */
const pickRandomIndices = (max: number, count: number): number[] => {
  const pool = Array.from({ length: max }, (_, i) => i)
  const result: number[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const j = Math.floor(Math.random() * pool.length)
    result.push(pool[j])
    pool.splice(j, 1)
  }
  return result
}

export const createSeedOrders = ({
  now,
  nextOrderId,
  orderStageMin,
  orderSlaOptionsMin,
  routeStageMin,
}: {
  now: number
  nextOrderId: number
  orderStageMin: OrderStageMin
  orderSlaOptionsMin: number[]
  routeStageMin: RouteStageMin
}): { orders: Record<string, Order>; nextOrderId: number } => {
  const orderStageMs = getOrderStageMs(orderStageMin)
  const routeStageMs = getRouteStageMs(routeStageMin)
  const statuses = shuffle<OrderStatus>(['cooking', 'cooking', 'waiting_cook'])
  const orders: Record<string, Order> = {}
  const seedCount = 3
  const randomAddressIndices = pickRandomIndices(addressSeeds.length, seedCount)

  statuses.forEach((status, index) => {
    const orderId = `order_${nextOrderId + index}`
    let createdAt = now
    let statusStartedAt = now

    if (status === 'waiting_cook') {
      const elapsedWaiting = Math.random() * orderStageMs.waiting_cook
      statusStartedAt = now - elapsedWaiting
      createdAt = statusStartedAt
    } else {
      const elapsedCooking = Math.random() * orderStageMs.cooking
      statusStartedAt = now - elapsedCooking
      createdAt = statusStartedAt - orderStageMs.waiting_cook
    }

    const baseOrder = createOrder(
      orderId,
      createdAt,
      randomAddressIndices[index],
      orderStageMin,
      orderSlaOptionsMin,
    )
    const seededOrder: Order = {
      ...baseOrder,
      status,
      statusStartedAt,
    }
    seededOrder.etaMin = computeEtaMin(seededOrder, now, orderStageMs, routeStageMs)
    orders[orderId] = seededOrder
  })

  return {
    orders,
    nextOrderId: nextOrderId + statuses.length,
  }
}

const computeEtaMin = (
  order: Order,
  now: number,
  orderStageMs: ReturnType<typeof getOrderStageMs>,
  routeStageMs: Record<RouteStepKind, number>,
): number => {
  let durationMs = 0
  if (isCookingStatus(order.status)) {
    durationMs = orderStageMs[order.status]
  } else if (isRouteStatus(order.status)) {
    durationMs = routeStageMs[order.status]
  } else {
    return 0
  }
  const remainingMs = Math.max(durationMs - (now - order.statusStartedAt), 0)
  return Math.ceil(remainingMs / MINUTE_MS)
}

const advanceCookingPipeline = (
  order: Order,
  now: number,
  orderStageMs: ReturnType<typeof getOrderStageMs>,
): Order => {
  if (!isCookingStatus(order.status)) {
    return order
  }

  let status: OrderStatus = order.status
  let statusStartedAt = order.statusStartedAt
  let elapsed = now - statusStartedAt

  if (status === 'waiting_cook' && elapsed >= orderStageMs.waiting_cook) {
    status = 'cooking'
    statusStartedAt += orderStageMs.waiting_cook
    elapsed = now - statusStartedAt
  }

  if (status === 'cooking' && elapsed >= orderStageMs.cooking) {
    status = 'ready'
    statusStartedAt += orderStageMs.cooking
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
  const orderStageMs = getOrderStageMs(state.orderStageMin)
  const routeStageMs = getRouteStageMs(state.routeStageMin)

  const orderIntervalMs = state.orderCreateIntervalMin * MINUTE_MS
  while (now - lastOrderCreatedAt >= orderIntervalMs) {
    lastOrderCreatedAt += orderIntervalMs
    const orderId = `order_${nextOrderId}`
    orders[orderId] = createOrder(
      orderId,
      lastOrderCreatedAt,
      nextOrderId,
      state.orderStageMin,
      state.orderSlaOptionsMin,
    )
    nextOrderId += 1
  }

  Object.values(orders).forEach((order) => {
    if (!order.routeId) {
      orders[order.id] = advanceCookingPipeline(order, now, orderStageMs)
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

    const durationMs = routeStageMs[route.step.kind]
    const stepStartedAt =
      route.step.kind === 'returning'
        ? route.returningStartedAt ?? currentOrder.statusStartedAt
        : currentOrder.statusStartedAt
    const elapsed = now - stepStartedAt
    if (elapsed < durationMs) {
      return
    }

    const stepCompletedAt = stepStartedAt + durationMs
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
          kind: 'enroute' as const,
          orderIndex: route.step.orderIndex + 1,
        }
        routes[route.id] = {
          ...route,
          step: nextStep,
        }
        const nextOrderId = route.orderIds[nextStep.orderIndex]
        setOrderStatus(orders, nextOrderId, 'enroute', stepCompletedAt)
        updateOrder(orders, nextOrderId, {
          routeId: route.id,
          courierId: route.courierId,
        })
        return
      }

      routes[route.id] = {
        ...route,
        step: {
          ...route.step,
          kind: 'returning',
        },
        returningStartedAt: stepCompletedAt,
      }
      updateCourier(couriers, route.courierId, {
        status: 'returning',
      })
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
      updateCourier(couriers, route.courierId, {
        status: 'free',
        routeId: undefined,
        freeSince: stepCompletedAt,
      })
    }
  })

  Object.values(orders).forEach((order) => {
    orders[order.id] = {
      ...order,
      etaMin: computeEtaMin(order, now, orderStageMs, routeStageMs),
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
