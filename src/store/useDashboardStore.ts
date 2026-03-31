import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Courier, type Order, type Route } from '../model/types'
import { routeHasUnreadyKitchenOrders } from '../model/routeBuckets'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import { step, type DashboardState } from './simulation'
import { buildSeedState } from './seedState'
import { computeAutoAssign } from './autoAssign'

function isDraftTemplateEmpty(route: Route): boolean {
  return route.status === 'draft' && !route.courierId && route.orderIds.length === 0
}

/** В ручном режиме — ровно один пустой шаблон: лишние пустые удаляются, при отсутствии создаётся. */
function finalizeManualDraftRoutes(state: DashboardState): DashboardState {
  if (state.routeMode !== 'manual') return state
  const drafts = Object.values(state.routes).filter((r) => r.status === 'draft')
  const empty = drafts.filter(isDraftTemplateEmpty)
  if (empty.length === 0) {
    const routeId = `route_${state.nextRouteId}`
    const newRoute: Route = {
      id: routeId,
      courierId: '',
      orderIds: [],
      createdAt: state.now,
      status: 'draft',
      assembly: 'manual',
      step: { kind: 'pickup', orderIndex: 0 },
    }
    return {
      ...state,
      routes: { ...state.routes, [routeId]: newRoute },
      nextRouteId: state.nextRouteId + 1,
    }
  }
  if (empty.length > 1) {
    const sorted = [...empty].sort((a, b) => a.createdAt - b.createdAt)
    const toRemove = sorted.slice(1).map((r) => r.id)
    let nextRoutes = { ...state.routes }
    for (const id of toRemove) {
      const { [id]: removed, ...rest } = nextRoutes
      void removed
      nextRoutes = rest
    }
    return { ...state, routes: nextRoutes }
  }
  return state
}

/** Sent pickup (авто, ждём кухню) → draft-шаблон: курьер свободен, стадии заказов на кухне и таймеры не трогаем */
function sentAutoUnreadyPickupToDraftTemplate(
  route: Route,
  orders: Record<string, Order>,
  couriers: Record<string, Courier>,
): {
  orders: Record<string, Order>
  couriers: Record<string, Courier>
  draftRoute: Route
} {
  const courier = route.courierId ? couriers[route.courierId] : undefined
  const updatedOrders: Record<string, Order> = { ...orders }
  route.orderIds.forEach((orderId) => {
    const order = updatedOrders[orderId]
    if (!order) return
    updatedOrders[orderId] = {
      ...order,
      routeId: route.id,
      courierId: undefined,
    }
  })
  const draftRoute: Route = {
    ...route,
    status: 'draft',
    assembly: 'manual',
    step: { kind: 'pickup', orderIndex: 0 },
  }
  const nextCouriers = { ...couriers }
  if (courier) {
    nextCouriers[courier.id] = {
      ...courier,
      status: 'free',
      routeId: undefined,
    }
  }
  return { orders: updatedOrders, couriers: nextCouriers, draftRoute }
}

/** Снять с заказов привязку к черновику и освободить курьера (как при расформировании в авто-режиме). */
function releaseOrdersAndCourierFromDraftRoute(
  now: number,
  route: Route,
  orders: Record<string, Order>,
  couriers: Record<string, Courier>,
): { orders: Record<string, Order>; couriers: Record<string, Courier> } {
  let nextOrders = { ...orders }
  let nextCouriers = { ...couriers }
  const routeId = route.id

  for (const orderId of Object.keys(nextOrders)) {
    const order = nextOrders[orderId]
    if (!order) continue
    const belongs =
      order.routeId === routeId || (!order.routeId && route.orderIds.includes(orderId))
    if (!belongs) continue
    nextOrders[orderId] = {
      ...order,
      routeId: undefined,
      courierId: undefined,
      ...(order.status === 'pickup'
        ? { status: 'ready' as const, statusStartedAt: now }
        : {}),
    }
  }

  if (route.courierId) {
    const c = nextCouriers[route.courierId]
    if (c?.routeId === routeId) {
      nextCouriers[route.courierId] = {
        ...c,
        status: 'free',
        routeId: undefined,
        freeSince: now,
      }
    }
  }

  return { orders: nextOrders, couriers: nextCouriers }
}

/** Ручной → авто: расформировать все несабмиченные черновики — заказы и курьер отвязаны, маршруты удалены */
function disassembleAllDraftRoutes(
  now: number,
  routes: Record<string, Route>,
  orders: Record<string, Order>,
  couriers: Record<string, Courier>,
): {
  routes: Record<string, Route>
  orders: Record<string, Order>
  couriers: Record<string, Courier>
} {
  let nextOrders = { ...orders }
  let nextCouriers = { ...couriers }
  const draftIds = Object.keys(routes).filter((id) => routes[id]?.status === 'draft')

  for (const routeId of draftIds) {
    const route = routes[routeId]
    if (!route) continue
    const released = releaseOrdersAndCourierFromDraftRoute(now, route, nextOrders, nextCouriers)
    nextOrders = released.orders
    nextCouriers = released.couriers
  }

  let nextRoutes = { ...routes }
  for (const routeId of draftIds) {
    const { [routeId]: removed, ...rest } = nextRoutes
    void removed
    nextRoutes = rest
  }

  return { routes: nextRoutes, orders: nextOrders, couriers: nextCouriers }
}

type DashboardActions = {
  tick: (deltaMs: number) => void
  toggleRun: () => void
  setSpeed: (speed: 1 | 3 | 5 | 20) => void
  setRouteMode: (mode: 'manual' | 'auto') => void
  createRouteDraft: () => string
  deleteRouteDraft: (routeId: string) => void
  /** Сбросить курьера и заказы в черновике; шаблон (id) сохраняется */
  resetRouteDraft: (routeId: string) => void
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
            assembly: 'auto',
            step: { kind: 'pickup', orderIndex: 0 },
          }
          const finalRoutes = {
            ...current.routes,
            [routeId]: sentRoute,
          }
          /* В авторежиме не держим пустой шаблон — следующий tick создаст черновик inline при необходимости */
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
        set((state) => {
          if (mode === 'auto') {
            const { routes, orders, couriers } = disassembleAllDraftRoutes(
              state.now,
              state.routes,
              state.orders,
              state.couriers,
            )
            return { ...state, routeMode: mode, routes, orders, couriers }
          }
          if (mode === 'manual') {
            let routes: Record<string, Route> = { ...state.routes }
            let orders: Record<string, Order> = { ...state.orders }
            let couriers: Record<string, Courier> = { ...state.couriers }
            let nextRouteId = state.nextRouteId

            if (state.routeMode === 'auto') {
              const idsToConvert = Object.keys(routes).filter((id) => {
                const r = routes[id]
                return (
                  r &&
                  r.status === 'sent' &&
                  r.step.kind === 'pickup' &&
                  r.assembly === 'auto' &&
                  routeHasUnreadyKitchenOrders(r, orders)
                )
              })
              for (const routeId of idsToConvert) {
                const route = routes[routeId]
                if (!route) continue
                const { orders: nextOrders, couriers: nextCouriers, draftRoute } =
                  sentAutoUnreadyPickupToDraftTemplate(route, orders, couriers)
                orders = nextOrders
                couriers = nextCouriers
                routes = { ...routes, [routeId]: draftRoute }
              }
            }

            return finalizeManualDraftRoutes({
              ...state,
              routeMode: mode,
              routes,
              orders,
              couriers,
              nextRouteId,
            })
          }
          return { ...state, routeMode: mode }
        })
      },
      createRouteDraft: () => {
        if (get().routeMode === 'auto') {
          return ''
        }
        const before = get()
        const existingEmpty = Object.values(before.routes).find(
          (r) => r.status === 'draft' && !r.courierId && r.orderIds.length === 0,
        )
        if (existingEmpty) {
          return existingEmpty.id
        }
        const { nextRouteId, now } = before
        const routeId = `route_${nextRouteId}`
        const newRoute: Route = {
          id: routeId,
          courierId: '',
          orderIds: [],
          createdAt: now,
          status: 'draft',
          assembly: 'manual',
          step: {
            kind: 'pickup',
            orderIndex: 0,
          },
        }
        set((state) =>
          finalizeManualDraftRoutes({
            ...state,
            routes: {
              ...state.routes,
              [routeId]: newRoute,
            },
            nextRouteId: state.nextRouteId + 1,
          }),
        )
        return routeId
      },
      deleteRouteDraft: (routeId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'draft') {
            return state
          }
          const { orders: nextOrders, couriers: nextCouriers } = releaseOrdersAndCourierFromDraftRoute(
            state.now,
            route,
            state.orders,
            state.couriers,
          )
          const { [routeId]: removedRoute, ...restRoutes } = state.routes
          void removedRoute
          return finalizeManualDraftRoutes({
            ...state,
            routes: restRoutes,
            orders: nextOrders,
            couriers: nextCouriers,
          })
        })
      },
      resetRouteDraft: (routeId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'draft') {
            return state
          }
          return finalizeManualDraftRoutes({
            ...state,
            routes: {
              ...state.routes,
              [routeId]: {
                ...route,
                courierId: '',
                orderIds: [],
                step: { kind: 'pickup', orderIndex: 0 },
              },
            },
          })
        })
      },
      detachCourierFromRoute: (routeId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || route.status !== 'draft') {
            return state
          }
          return finalizeManualDraftRoutes({
            ...state,
            routes: {
              ...state.routes,
              [routeId]: {
                ...route,
                courierId: '',
              },
            },
          })
        })
      },
      attachCourierToRoute: (routeId, courierId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route) {
            return state
          }
          return finalizeManualDraftRoutes({
            ...state,
            routes: {
              ...state.routes,
              [routeId]: {
                ...route,
                courierId,
              },
            },
          })
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
          return finalizeManualDraftRoutes({
            ...state,
            routes: {
              ...state.routes,
              [routeId]: {
                ...route,
                orderIds: route.orderIds.filter((id) => id !== orderId),
              },
            },
          })
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
          return finalizeManualDraftRoutes({
            ...state,
            routes: {
              ...state.routes,
              [routeId]: {
                ...route,
                orderIds: [...route.orderIds, orderId],
              },
            },
          })
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
            assembly: 'manual',
            step: {
              kind: 'pickup',
              orderIndex: 0,
            },
          }
          const newRoutes: Record<string, Route> = {
            ...state.routes,
            [routeId]: sentRoute,
          }

          return finalizeManualDraftRoutes({
            ...state,
            routes: newRoutes,
            couriers: {
              ...state.couriers,
              [courier.id]: {
                ...courier,
                status: 'assigned',
                routeId,
              },
            },
            orders: updatedOrders,
          })
        })
      },
      revertRouteToDraft: (routeId) => {
        set((state) => {
          if (state.routeMode === 'auto') {
            return state
          }
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
          return finalizeManualDraftRoutes({
            ...state,
            routes: {
              ...state.routes,
              [routeId]: draftRoute,
            },
            couriers: nextCouriers,
            orders: updatedOrders,
          })
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
