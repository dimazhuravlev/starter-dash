import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Courier, type CourierType, type Order, type Route } from '../model/types'
import { createSeedOrders, step, type DashboardState } from './simulation'
import {
  MINUTE_MS,
  ORDER_CREATE_INTERVAL_MIN,
  ORDER_SLA_OPTIONS_MIN,
  ORDER_STAGE_MIN,
  ROUTE_STAGE_MIN,
} from '../model/rules'

type DashboardActions = {
  tick: (deltaMs: number) => void
  toggleRun: () => void
  setSpeed: (speed: 1 | 3 | 5 | 20) => void
  createRouteDraft: () => string
  deleteRouteDraft: (routeId: string) => void
  detachCourierFromRoute: (routeId: string) => void
  attachCourierToRoute: (routeId: string, courierId: string) => void
  detachOrderFromRoute: (routeId: string, orderId: string) => void
  attachOrderToRoute: (routeId: string, orderId: string) => void
  reorderRouteOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  sendRoute: (routeId: string) => void
  revertRouteToDraft: (routeId: string) => void
  resetSeed: () => void
  setOrderStageMin: (stage: keyof typeof ORDER_STAGE_MIN, value: number) => void
  setOrderSlaOption: (index: number, value: number) => void
  setRouteStageMin: (stage: keyof typeof ROUTE_STAGE_MIN, value: number) => void
  setOrderCreateIntervalMin: (value: number) => void
}

const courierNames = [
  'Скороходов Павел',
  'Шалимов Пётр',
  'Егоров Александр',
  'Польский Илья',
  'Пак Константин',
  'Гринько Екатерина',
]

const COURIER_TYPES: CourierType[] = ['pedestrian', 'bike', 'car']

type DashboardSettings = Pick<
  DashboardState,
  'speed' | 'orderCreateIntervalMin' | 'orderStageMin' | 'orderSlaOptionsMin' | 'routeStageMin'
>

const resolveSettings = (settings?: Partial<DashboardSettings>): DashboardSettings => ({
  speed: settings?.speed ?? 3,
  orderCreateIntervalMin: settings?.orderCreateIntervalMin ?? ORDER_CREATE_INTERVAL_MIN,
  orderStageMin: {
    ...ORDER_STAGE_MIN,
    ...(settings?.orderStageMin ?? {}),
  },
  orderSlaOptionsMin:
    settings?.orderSlaOptionsMin !== undefined
      ? [...settings.orderSlaOptionsMin]
      : [...ORDER_SLA_OPTIONS_MIN],
  routeStageMin: {
    ...ROUTE_STAGE_MIN,
    ...(settings?.routeStageMin ?? {}),
  },
})

const getRandomFreeSince = (now: number) => now - Math.random() * 9 * MINUTE_MS

const buildSeedState = (settings?: Partial<DashboardSettings>): DashboardState => {
  const now = Date.now()
  const couriers: Record<string, Courier> = {}
  const resolvedSettings = resolveSettings(settings)

  courierNames.forEach((name, index) => {
    const courierId = `courier_${index + 1}`
    couriers[courierId] = {
      id: courierId,
      name,
      type: COURIER_TYPES[index % COURIER_TYPES.length],
      status: 'free',
      freeSince: getRandomFreeSince(now),
    }
  })

  const { orders, nextOrderId } = createSeedOrders({
    now,
    nextOrderId: 1,
    orderStageMin: resolvedSettings.orderStageMin,
    orderSlaOptionsMin: resolvedSettings.orderSlaOptionsMin,
    routeStageMin: resolvedSettings.routeStageMin,
  })
  const routes: Record<string, Route> = {}

  return {
    now,
    isRunning: true,
    speed: resolvedSettings.speed,
    orders,
    couriers,
    routes,
    lastOrderCreatedAt: now,
    nextOrderId,
    nextRouteId: 1,
    orderCreateIntervalMin: resolvedSettings.orderCreateIntervalMin,
    orderStageMin: resolvedSettings.orderStageMin,
    orderSlaOptionsMin: resolvedSettings.orderSlaOptionsMin,
    routeStageMin: resolvedSettings.routeStageMin,
  }
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  persist(
    (set, get) => ({
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
        const { nextRouteId, now } = get()
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
      deleteRouteDraft: (routeId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'draft') {
            return state
          }
          const { [routeId]: removedRoute, ...restRoutes } = state.routes
          void removedRoute
          return {
            ...state,
            routes: restRoutes,
          }
        })
      },
      detachCourierFromRoute: (routeId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'draft') {
            return state
          }
          return {
            ...state,
            routes: {
              ...state.routes,
              [routeId]: {
                ...route,
                courierId: '',
              },
            },
          }
        })
      },
      attachCourierToRoute: (routeId, courierId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route) {
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
          }
        })
      },
      detachOrderFromRoute: (routeId, orderId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'draft') {
            return state
          }
          if (!route.orderIds.includes(orderId)) {
            return state
          }
          return {
            ...state,
            routes: {
              ...state.routes,
              [routeId]: {
                ...route,
                orderIds: route.orderIds.filter((id) => id !== orderId),
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
          }
        })
      },
      reorderRouteOrders: (routeId, fromIndex, toIndex) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'draft') return state
          const ids = [...route.orderIds]
          if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return state
          if (fromIndex === toIndex) return state
          const [removed] = ids.splice(fromIndex, 1)
          ids.splice(toIndex, 0, removed)
          return {
            ...state,
            routes: {
              ...state.routes,
              [routeId]: { ...route, orderIds: ids },
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
            if (!order) return
            updatedOrders[orderId] = {
              ...order,
              status: 'pickup',
              statusStartedAt: state.now,
              routeId,
              courierId: courier.id,
            }
          })

          const sentRoute: Route = {
            ...route,
            status: 'sent',
            step: {
              kind: 'pickup',
              orderIndex: 0,
            },
          }
          const newRoutes: Record<string, Route> = {
            ...state.routes,
            [routeId]: sentRoute,
          }
          // Если после отправки не осталось ни одного черновика — создаём один пустой шаблон
          const draftCount = Object.values(newRoutes).filter((r) => r.status === 'draft').length
          let routes = newRoutes
          let nextRouteId = state.nextRouteId
          if (draftCount === 0) {
            const newRouteId = `route_${nextRouteId}`
            const newDraft: Route = {
              id: newRouteId,
              courierId: '',
              orderIds: [],
              createdAt: state.now,
              status: 'draft',
              step: { kind: 'pickup', orderIndex: 0 },
            }
            routes = { ...newRoutes, [newRouteId]: newDraft }
            nextRouteId = state.nextRouteId + 1
          }

          return {
            ...state,
            routes,
            nextRouteId,
            couriers: {
              ...state.couriers,
              [courier.id]: {
                ...courier,
                status: 'assigned',
                routeId,
              },
            },
            orders: updatedOrders,
          }
        })
      },
      revertRouteToDraft: (routeId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'sent') {
            return state
          }
          const courier = route.courierId ? state.couriers[route.courierId] : undefined
          const updatedOrders: Record<string, Order> = { ...state.orders }
          route.orderIds.forEach((orderId) => {
            const order = updatedOrders[orderId]
            if (!order) return
            updatedOrders[orderId] = {
              ...order,
              status: 'ready',
              statusStartedAt: state.now,
              routeId,
              courierId: undefined,
            }
          })
          const draftRoute: Route = {
            ...route,
            status: 'draft',
            step: { kind: 'pickup', orderIndex: 0 },
          }
          const nextCouriers = { ...state.couriers }
          if (courier) {
            nextCouriers[courier.id] = {
              ...courier,
              status: 'free',
              routeId: undefined,
            }
          }
          return {
            ...state,
            routes: {
              ...state.routes,
              [routeId]: draftRoute,
            },
            couriers: nextCouriers,
            orders: updatedOrders,
          }
        })
      },
      resetSeed: () => {
        set(() => buildSeedState())
      },
      setOrderStageMin: (stage, value) => {
        set((state) => ({
          ...state,
          orderStageMin: {
            ...state.orderStageMin,
            [stage]: value,
          },
        }))
      },
      setOrderSlaOption: (index, value) => {
        set((state) => {
          const nextOptions = [...state.orderSlaOptionsMin]
          if (index < 0 || index >= nextOptions.length) {
            return state
          }
          nextOptions[index] = value
          return {
            ...state,
            orderSlaOptionsMin: nextOptions,
          }
        })
      },
      setRouteStageMin: (stage, value) => {
        set((state) => ({
          ...state,
          routeStageMin: {
            ...state.routeStageMin,
            [stage]: value,
          },
        }))
      },
      setOrderCreateIntervalMin: (value) => {
        set((state) => ({
          ...state,
          orderCreateIntervalMin: value,
        }))
      },
    }),
    {
      name: 'dashboard-settings',
      partialize: (state) => ({
        speed: state.speed,
        orderCreateIntervalMin: state.orderCreateIntervalMin,
        orderStageMin: state.orderStageMin,
        orderSlaOptionsMin: state.orderSlaOptionsMin,
        routeStageMin: state.routeStageMin,
      }),
    },
  ),
)
