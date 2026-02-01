import { create } from 'zustand'
import { type Courier, type Order, type Route } from '../model/types'
import { step, type DashboardState } from './simulation'

type DashboardActions = {
  tick: (deltaMs: number) => void
  toggleRun: () => void
  setSpeed: (speed: 1 | 5 | 20) => void
  createRouteDraft: () => string
  attachCourierToRoute: (routeId: string, courierId: string) => void
  attachOrderToRoute: (routeId: string, orderId: string) => void
  sendRoute: (routeId: string) => void
  resetSeed: () => void
}

const courierNames = [
  'Алексей Смирнов',
  'Мария Иванова',
  'Дмитрий Кузнецов',
  'Анна Соколова',
  'Никита Орлов',
  'Екатерина Петрова',
]

const buildSeedState = (): DashboardState => {
  const now = Date.now()
  const couriers: Record<string, Courier> = {}

  courierNames.forEach((name, index) => {
    const courierId = `courier_${index + 1}`
    couriers[courierId] = {
      id: courierId,
      name,
      status: 'free',
    }
  })

  const orders: Record<string, Order> = {}
  const routes: Record<string, Route> = {}

  return {
    now,
    isRunning: false,
    speed: 1,
    orders,
    couriers,
    routes,
    lastOrderCreatedAt: now,
    nextOrderId: 1,
    nextRouteId: 1,
  }
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set, get) => ({
  ...buildSeedState(),
  tick: (deltaMs) => {
    set((state) => step(state, deltaMs))
  },
  toggleRun: () => {
    set((state) => ({ ...state, isRunning: !state.isRunning }))
  },
  setSpeed: (speed) => {
    set((state) => ({ ...state, speed }))
  },
  createRouteDraft: () => {
    const { nextRouteId, routes, now } = get()
    const routeId = `route_${nextRouteId}`
    const newRoute: Route = {
      id: routeId,
      courierId: '',
      orderIds: [],
      createdAt: now,
      status: 'draft',
      step: {
        kind: 'pickup',
        orderIndex: 0,
      },
    }
    set((state) => ({
      ...state,
      routes: {
        ...state.routes,
        [routeId]: newRoute,
      },
      nextRouteId: state.nextRouteId + 1,
    }))
    return routeId
  },
  attachCourierToRoute: (routeId, courierId) => {
    set((state) => {
      const route = state.routes[routeId]
      const courier = state.couriers[courierId]
      if (!route || !courier) {
        return state
      }
      return {
        ...state,
        routes: {
          ...state.routes,
          [routeId]: {
            ...route,
            courierId,
          },
        },
        couriers: {
          ...state.couriers,
          [courierId]: {
            ...courier,
            status: 'assigned',
            routeId,
          },
        },
      }
    })
  },
  attachOrderToRoute: (routeId, orderId) => {
    set((state) => {
      const route = state.routes[routeId]
      const order = state.orders[orderId]
      if (!route || !order || route.status !== 'draft') {
        return state
      }
      if (route.orderIds.includes(orderId) || route.orderIds.length >= 3) {
        return state
      }
      return {
        ...state,
        routes: {
          ...state.routes,
          [routeId]: {
            ...route,
            orderIds: [...route.orderIds, orderId],
          },
        },
        orders: {
          ...state.orders,
          [orderId]: {
            ...order,
            routeId,
          },
        },
      }
    })
  },
  sendRoute: (routeId) => {
    set((state) => {
      const route = state.routes[routeId]
      if (!route || route.status !== 'draft') {
        return state
      }
      if (!route.courierId || route.orderIds.length === 0 || route.orderIds.length > 3) {
        return state
      }
      const courier = state.couriers[route.courierId]
      const firstOrderId = route.orderIds[0]
      const firstOrder = state.orders[firstOrderId]
      if (!courier || !firstOrder) {
        return state
      }

      const updatedOrders: Record<string, Order> = { ...state.orders }
      route.orderIds.forEach((orderId) => {
        const order = updatedOrders[orderId]
        if (order) {
          updatedOrders[orderId] = {
            ...order,
            routeId,
            courierId: courier.id,
          }
        }
      })

      return {
        ...state,
        routes: {
          ...state.routes,
          [routeId]: {
            ...route,
            status: 'sent',
            step: {
              kind: 'pickup',
              orderIndex: 0,
            },
          },
        },
        couriers: {
          ...state.couriers,
          [courier.id]: {
            ...courier,
            status: 'assigned',
            routeId,
          },
        },
        orders: {
          ...updatedOrders,
          [firstOrderId]: {
            ...firstOrder,
            status: 'pickup',
            statusStartedAt: state.now,
            routeId,
            courierId: courier.id,
          },
        },
      }
    })
  },
  resetSeed: () => {
    set(() => buildSeedState())
  },
}))
