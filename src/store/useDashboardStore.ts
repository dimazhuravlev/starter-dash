import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Order, type Route } from '../model/types'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import { step, type DashboardState } from './simulation'
import { buildSeedState } from './seedState'
import { computeAutoAssign } from './autoAssign'

type DashboardActions = {
  tick: (deltaMs: number) => void
  toggleRun: () => void
  setSpeed: (speed: 1 | 3 | 5 | 20) => void
  setRouteMode: (mode: 'manual' | 'auto') => void
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
  setOrderStageMin: (stage: keyof OrderStageMin, value: number) => void
  setOrderSlaOption: (index: number, value: number) => void
  setRouteStageMin: (stage: keyof RouteStageMin, value: number) => void
  setOrderCreateIntervalMin: (value: number) => void
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  persist(
    (set, get) => ({
      ...buildSeedState(),
      tick: (deltaMs) => {
        set((state) => {
          const next = step(state, deltaMs)
          if (next.routeMode !== 'auto') return next
          const result = computeAutoAssign(
            next.couriers,
            next.orders,
            next.routes,
            next.now,
            next.orderStageMin,
          )
          if (!result) return next
          const draftRoutes = Object.values(next.routes).filter((r) => r.status === 'draft')
          const emptyDraft = draftRoutes.find((r) => !r.courierId && r.orderIds.length === 0)
          let routeId = emptyDraft?.id
          let routes = next.routes
          let nextRouteId = next.nextRouteId
          if (!routeId) {
            routeId = `route_${nextRouteId}`
            routes = {
              ...routes,
              [routeId]: {
                id: routeId,
                courierId: '',
                orderIds: [],
                createdAt: next.now,
                status: 'draft',
                step: { kind: 'pickup', orderIndex: 0 },
              },
            }
            nextRouteId += 1
          }
          let current = { ...next, routes, nextRouteId }
          const attachCourier = (rid: string, cid: string) => {
            const r = current.routes[rid]
            if (!r) return
            current = {
              ...current,
              routes: {
                ...current.routes,
                [rid]: { ...r, courierId: cid },
              },
            }
          }
          const attachOrder = (rid: string, oid: string) => {
            const r = current.routes[rid]
            const order = current.orders[oid]
            if (!r || !order || r.status !== 'draft') return
            if (r.orderIds.includes(oid) || r.orderIds.length >= 3) return
            current = {
              ...current,
              routes: {
                ...current.routes,
                [rid]: { ...r, orderIds: [...r.orderIds, oid] },
              },
            }
          }
          attachCourier(routeId, result.courierId)
          result.orderIds.forEach((oid) => attachOrder(routeId, oid))
          const route = current.routes[routeId]
          if (!route?.courierId || route.orderIds.length === 0 || route.orderIds.length > 3) {
            return next
          }
          const courier = current.couriers[route.courierId]
          const firstOrder = current.orders[route.orderIds[0]]
          if (!courier || !firstOrder) return next
          const updatedOrders: Record<string, Order> = { ...current.orders }
          route.orderIds.forEach((orderId) => {
            const order = updatedOrders[orderId]
            if (!order) return
            const isReady = order.status === 'ready'
            updatedOrders[orderId] = {
              ...order,
              status: isReady ? 'pickup' : order.status,
              statusStartedAt: isReady ? current.now : order.statusStartedAt,
              routeId,
              courierId: courier.id,
            }
          })
          const sentRoute: Route = {
            ...route,
            status: 'sent',
            step: { kind: 'pickup', orderIndex: 0 },
          }
          let finalRoutes = {
            ...current.routes,
            [routeId]: sentRoute,
          }
          const draftCount = Object.values(finalRoutes).filter((r) => r.status === 'draft').length
          if (draftCount === 0) {
            const newRouteId = `route_${nextRouteId}`
            finalRoutes = {
              ...finalRoutes,
              [newRouteId]: {
                id: newRouteId,
                courierId: '',
                orderIds: [],
                createdAt: current.now,
                status: 'draft',
                step: { kind: 'pickup', orderIndex: 0 },
              },
            }
            nextRouteId += 1
          }
          return {
            ...current,
            routes: finalRoutes,
            nextRouteId,
            couriers: {
              ...current.couriers,
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
      toggleRun: () => {
        set((state) => ({ ...state, isRunning: !state.isRunning }))
      },
      setSpeed: (speed) => {
        set((state) => ({ ...state, speed }))
      },
      setRouteMode: (mode) => {
        set((state) => ({ ...state, routeMode: mode }))
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
            const isReady = order.status === 'ready'
            updatedOrders[orderId] = {
              ...order,
              status: isReady ? 'pickup' : order.status,
              statusStartedAt: isReady ? state.now : order.statusStartedAt,
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
        routeMode: state.routeMode,
      }),
    },
  ),
)
