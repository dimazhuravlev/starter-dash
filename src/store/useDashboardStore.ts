import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Courier, type Order, type Route } from '../model/types'
import { routeHasUnreadyKitchenOrders } from '../model/routeBuckets'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
import { step, type AutoEditSessionBaseline, type DashboardState } from './simulation'
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

function snapshotAutoEditBaseline(state: DashboardState): AutoEditSessionBaseline {
  return {
    now: state.now,
    lastOrderCreatedAt: state.lastOrderCreatedAt,
    nextOrderId: state.nextOrderId,
    nextRouteId: state.nextRouteId,
    routes: structuredClone(state.routes),
    orders: structuredClone(state.orders),
    couriers: structuredClone(state.couriers),
  }
}

type DashboardActions = {
  tick: (deltaMs: number) => void
  toggleRun: () => void
  setSpeed: (speed: 1 | 3 | 5 | 20) => void
  setRouteMode: (mode: 'manual' | 'auto') => void
  startEditingAutoRoutes: () => void
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
  /** Редактирование sent-маршрута в авторежиме: снять курьера (освобождает курьера) */
  editSentRouteDetachCourier: (routeId: string) => void
  /** Редактирование sent-маршрута в авторежиме: назначить курьера (освобождает предыдущего) */
  editSentRouteAttachCourier: (routeId: string, courierId: string) => void
  /** Редактирование sent-маршрута в авторежиме: снять заказ (освобождает заказ) */
  editSentRouteDetachOrder: (routeId: string, orderId: string) => void
  /** Редактирование sent-маршрута в авторежиме: добавить заказ */
  editSentRouteAttachOrder: (routeId: string, orderId: string) => void
  /** Редактирование sent-маршрута в авторежиме: переставить порядок заказов */
  editSentRouteReorderOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  startEditingAutoRoutes: () => void
  /** Отменить редактирование автомаршрутов (без сохранения изменений) */
  cancelEditingAutoRoutes: () => void
  /**
   * Сохранить результаты редактирования автомаршрутов:
   * — нет курьера + нет заказов → удалить маршрут
   * — есть курьер + нет заказов → освободить курьера и удалить
   * — нет курьера + есть заказы → оставить как «Собранный вручную», курьер будет назначен автоматически
   * — есть курьер + есть заказы → пометить как manual (если был изменён)
   */
  saveEditedAutoRoutes: (allRouteIds: string[], modifiedRouteIds: string[]) => void
  resetSeed: () => void
  setOrderStageMin: (stage: keyof OrderStageMin, value: number) => void
  setOrderSlaOption: (index: number, value: number) => void
  setRouteStageMin: (stage: keyof RouteStageMin, value: number) => void
  setOrderCreateIntervalMin: (value: number) => void
  upsertCourier: (courier: Courier) => void
  removeCourier: (courierId: string) => void
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  persist(
    (set, get) => ({
      ...buildSeedState(),
      isEditingAutoRoutes: false,
      tick: (deltaMs) => {
        set((state) => {
          let current = step(state, deltaMs)
          if (current.routeMode !== 'auto') return current
          if (current.isEditingAutoRoutes) return current

          /* Pass 1: назначить свободного курьера sent-маршрутам без курьера (результат saveEditedAutoRoutes case 3) */
          const sentAwaitingCourier = Object.values(current.routes)
            .filter(
              (r) =>
                r.status === 'sent' &&
                r.step.kind === 'pickup' &&
                !r.courierId &&
                r.orderIds.length > 0,
            )
            .sort((a, b) => a.createdAt - b.createdAt)

          if (sentAwaitingCourier.length > 0) {
            const freeCouriersQ = Object.values(current.couriers)
              .filter((c) => c.status === 'free')
              .sort((a, b) => (a.freeSince ?? current.now) - (b.freeSince ?? current.now))

            for (let i = 0; i < sentAwaitingCourier.length && i < freeCouriersQ.length; i++) {
              const route = sentAwaitingCourier[i]
              const courier = freeCouriersQ[i]
              const patchedOrders: Record<string, Order> = { ...current.orders }
              for (const orderId of route.orderIds) {
                const order = patchedOrders[orderId]
                if (!order) continue
                patchedOrders[orderId] = {
                  ...order,
                  courierId: courier.id,
                  routeId: route.id,
                  ...(order.status === 'ready'
                    ? { status: 'pickup' as const, statusStartedAt: current.now }
                    : {}),
                }
              }
              current = {
                ...current,
                routes: { ...current.routes, [route.id]: { ...route, courierId: courier.id } },
                couriers: {
                  ...current.couriers,
                  [courier.id]: { ...courier, status: 'assigned', routeId: route.id },
                },
                orders: patchedOrders,
              }
            }
          }

          /* Pass 2: обычное авто-назначение — создать новый маршрут из свободных заказов */
          const result = computeAutoAssign(
            current.couriers,
            current.orders,
            current.routes,
            current.now,
            current.orderStageMin,
            current.routeStageMin,
          )
          if (!result) return current
          const draftRoutes = Object.values(current.routes).filter((r) => r.status === 'draft')
          const emptyDraft = draftRoutes.find((r) => !r.courierId && r.orderIds.length === 0)
          let routeId = emptyDraft?.id
          let routes = current.routes
          let nextRouteId = current.nextRouteId
          if (!routeId) {
            routeId = `route_${nextRouteId}`
            routes = {
              ...routes,
              [routeId]: {
                id: routeId,
                courierId: '',
                orderIds: [],
                createdAt: current.now,
                status: 'draft',
                step: { kind: 'pickup', orderIndex: 0 },
              },
            }
            nextRouteId += 1
          }
          let assign = { ...current, routes, nextRouteId }
          const attachCourier = (rid: string, cid: string) => {
            const r = assign.routes[rid]
            if (!r) return
            assign = {
              ...assign,
              routes: {
                ...assign.routes,
                [rid]: { ...r, courierId: cid },
              },
            }
          }
          const attachOrder = (rid: string, oid: string) => {
            const r = assign.routes[rid]
            const order = assign.orders[oid]
            if (!r || !order || r.status !== 'draft') return
            if (r.orderIds.includes(oid) || r.orderIds.length >= 3) return
            assign = {
              ...assign,
              routes: {
                ...assign.routes,
                [rid]: { ...r, orderIds: [...r.orderIds, oid] },
              },
            }
          }
          attachCourier(routeId, result.courierId)
          result.orderIds.forEach((oid) => attachOrder(routeId!, oid))
          const finalRoute = assign.routes[routeId]
          if (!finalRoute?.courierId || finalRoute.orderIds.length === 0 || finalRoute.orderIds.length > 3) {
            return current
          }
          const assignedCourier = assign.couriers[finalRoute.courierId]
          const firstOrder = assign.orders[finalRoute.orderIds[0]]
          if (!assignedCourier || !firstOrder) return current
          const isReturningCourier = assignedCourier.status === 'returning'
          const updatedOrders: Record<string, Order> = { ...assign.orders }
          finalRoute.orderIds.forEach((orderId) => {
            const order = updatedOrders[orderId]
            if (!order) return
            if (isReturningCourier) {
              /* Курьер ещё возвращается — резервируем заказы, но не переводим в pickup */
              updatedOrders[orderId] = {
                ...order,
                routeId,
                courierId: assignedCourier.id,
              }
            } else {
              const isReady = order.status === 'ready'
              updatedOrders[orderId] = {
                ...order,
                status: isReady ? 'pickup' : order.status,
                statusStartedAt: isReady ? assign.now : order.statusStartedAt,
                routeId,
                courierId: assignedCourier.id,
              }
            }
          })
          const sentRoute: Route = {
            ...finalRoute,
            status: 'sent',
            assembly: 'auto',
            step: { kind: 'pickup', orderIndex: 0 },
          }
          const finalRoutes = {
            ...assign.routes,
            [routeId]: sentRoute,
          }
          /* В авторежиме не держим пустой шаблон — следующий tick создаст черновик inline при необходимости */
          return {
            ...assign,
            routes: finalRoutes,
            nextRouteId,
            couriers: {
              ...assign.couriers,
              [assignedCourier.id]: isReturningCourier
                ? /* Оставляем курьера в returning — только записываем nextRouteId */
                  { ...assignedCourier, nextRouteId: routeId }
                : { ...assignedCourier, status: 'assigned', routeId },
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
            return {
              ...state,
              routeMode: mode,
              isEditingAutoRoutes: false,
              autoEditSessionBaseline: null,
              routes,
              orders,
              couriers,
            }
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
      startEditingAutoRoutes: () => {
        set((state) => ({
          ...state,
          isEditingAutoRoutes: true,
          autoEditSessionBaseline: snapshotAutoEditBaseline(state),
        }))
      },
      cancelEditingAutoRoutes: () => {
        set((state) => {
          const b = state.autoEditSessionBaseline
          if (!b) {
            return { ...state, isEditingAutoRoutes: false }
          }
          return {
            ...state,
            isEditingAutoRoutes: false,
            autoEditSessionBaseline: null,
            now: b.now,
            lastOrderCreatedAt: b.lastOrderCreatedAt,
            nextOrderId: b.nextOrderId,
            nextRouteId: b.nextRouteId,
            routes: structuredClone(b.routes),
            orders: structuredClone(b.orders),
            couriers: structuredClone(b.couriers),
          }
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
      editSentRouteDetachCourier: (routeId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route) return state
          const nextCouriers = { ...state.couriers }
          if (route.courierId && state.couriers[route.courierId]) {
            const courier = nextCouriers[route.courierId]!
            if (courier.status === 'returning') {
              /* Курьер ещё возвращается — просто снимаем nextRouteId, не трогаем статус */
              nextCouriers[route.courierId] = { ...courier, nextRouteId: undefined }
            } else {
              nextCouriers[route.courierId] = { ...courier, status: 'free', routeId: undefined }
            }
          }
          return {
            ...state,
            routes: { ...state.routes, [routeId]: { ...route, courierId: '' } },
            couriers: nextCouriers,
          }
        })
      },
      editSentRouteAttachCourier: (routeId, courierId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route) return state
          const nextCouriers = { ...state.couriers }
          /* Освободить предыдущего курьера маршрута */
          if (route.courierId && route.courierId !== courierId && nextCouriers[route.courierId]) {
            const prevCourier = nextCouriers[route.courierId]!
            if (prevCourier.status === 'returning') {
              nextCouriers[route.courierId] = { ...prevCourier, nextRouteId: undefined }
            } else {
              nextCouriers[route.courierId] = { ...prevCourier, status: 'free', routeId: undefined }
            }
          }
          /* Назначить нового курьера */
          if (courierId && nextCouriers[courierId]) {
            const newCourier = nextCouriers[courierId]!
            if (newCourier.status === 'returning') {
              nextCouriers[courierId] = { ...newCourier, nextRouteId: routeId }
            } else {
              nextCouriers[courierId] = { ...newCourier, status: 'assigned', routeId }
            }
          }
          return {
            ...state,
            routes: { ...state.routes, [routeId]: { ...route, courierId } },
            couriers: nextCouriers,
          }
        })
      },
      editSentRouteDetachOrder: (routeId, orderId) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route || !route.orderIds.includes(orderId)) return state
          const order = state.orders[orderId]
          const nextOrders = { ...state.orders }
          if (order) {
            nextOrders[orderId] = {
              ...order,
              routeId: undefined,
              courierId: undefined,
              ...(order.status === 'pickup' ? { status: 'ready' as const, statusStartedAt: state.now } : {}),
            }
          }
          return {
            ...state,
            routes: {
              ...state.routes,
              [routeId]: { ...route, orderIds: route.orderIds.filter((id) => id !== orderId) },
            },
            orders: nextOrders,
          }
        })
      },
      editSentRouteAttachOrder: (routeId, orderId) => {
        set((state) => {
          const route = state.routes[routeId]
          const order = state.orders[orderId]
          if (!route || !order) return state
          if (route.orderIds.includes(orderId) || route.orderIds.length >= 3) return state
          return {
            ...state,
            routes: {
              ...state.routes,
              [routeId]: { ...route, orderIds: [...route.orderIds, orderId] },
            },
            orders: {
              ...state.orders,
              [orderId]: {
                ...order,
                routeId,
                courierId: route.courierId || undefined,
              },
            },
          }
        })
      },
      editSentRouteReorderOrders: (routeId, fromIndex, toIndex) => {
        set((state) => {
          const route = state.routes[routeId]
          if (!route) return state
          const ids = [...route.orderIds]
          if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return state
          if (fromIndex === toIndex) return state
          const [removed] = ids.splice(fromIndex, 1)
          ids.splice(toIndex, 0, removed)
          return {
            ...state,
            routes: { ...state.routes, [routeId]: { ...route, orderIds: ids } },
          }
        })
      },
      saveEditedAutoRoutes: (allRouteIds, modifiedRouteIds) => {
        set((state) => {
          const modifiedSet = new Set(modifiedRouteIds)
          let nextRoutes = { ...state.routes }
          let nextOrders = { ...state.orders }
          let nextCouriers = { ...state.couriers }

          for (const routeId of allRouteIds) {
            const route = nextRoutes[routeId]
            if (!route) continue
            const hasCourier = Boolean(route.courierId)
            const hasOrders = route.orderIds.length > 0

            if (!hasCourier && !hasOrders) {
              /* Case 1: пустой шаблон → удалить */
              const { [routeId]: _removed, ...rest } = nextRoutes
              void _removed
              nextRoutes = rest
            } else if (hasCourier && !hasOrders) {
              /* Case 2: есть курьер, нет заказов → освободить курьера и удалить */
              const courier = nextCouriers[route.courierId]
              if (courier) {
                nextCouriers = {
                  ...nextCouriers,
                  [route.courierId]: {
                    ...courier,
                    status: 'free',
                    routeId: undefined,
                    freeSince: state.now,
                  },
                }
              }
              const { [routeId]: _removed, ...rest } = nextRoutes
              void _removed
              nextRoutes = rest
            } else if (!hasCourier && hasOrders) {
              /* Case 3: нет курьера, есть заказы → оставить как «Собранный вручную»,
                 очистить устаревший courierId у заказов, курьер будет назначен в следующем tick */
              nextRoutes = {
                ...nextRoutes,
                [routeId]: { ...route, assembly: 'manual' as const },
              }
              for (const orderId of route.orderIds) {
                const order = nextOrders[orderId]
                if (order) {
                  nextOrders = {
                    ...nextOrders,
                    [orderId]: { ...order, courierId: undefined, routeId: routeId },
                  }
                }
              }
            } else if (hasCourier && hasOrders && modifiedSet.has(routeId)) {
              /* Case 4: есть курьер и заказы, маршрут изменялся → пометить как manual */
              nextRoutes = {
                ...nextRoutes,
                [routeId]: { ...route, assembly: 'manual' as const },
              }
            }
            /* Case 4 без изменений: оставить как есть */
          }

          return {
            ...state,
            routes: nextRoutes,
            orders: nextOrders,
            couriers: nextCouriers,
            isEditingAutoRoutes: false,
            autoEditSessionBaseline: null,
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
      upsertCourier: (courier) => {
        set((state) => ({
          ...state,
          couriers: { ...state.couriers, [courier.id]: courier },
        }))
      },
      removeCourier: (courierId) => {
        set((state) => {
          if (!state.couriers[courierId]) {
            return state
          }
          let nextOrders: Record<string, Order> = { ...state.orders }
          let nextRoutes: Record<string, Route> = { ...state.routes }
          let nextCouriers: Record<string, Courier> = { ...state.couriers }

          for (const routeId of Object.keys(nextRoutes)) {
            const route = nextRoutes[routeId]
            if (!route || route.courierId !== courierId) {
              continue
            }
            if (route.status === 'draft') {
              const released = releaseOrdersAndCourierFromDraftRoute(
                state.now,
                route,
                nextOrders,
                nextCouriers,
              )
              nextOrders = released.orders
              nextCouriers = released.couriers
              nextRoutes = {
                ...nextRoutes,
                [routeId]: { ...route, courierId: '' },
              }
            } else {
              nextRoutes = {
                ...nextRoutes,
                [routeId]: { ...route, courierId: '' },
              }
            }
          }

          for (const oid of Object.keys(nextOrders)) {
            const o = nextOrders[oid]
            if (o?.courierId === courierId) {
              nextOrders[oid] = { ...o, courierId: undefined }
            }
          }

          const { [courierId]: _removed, ...restCouriers } = nextCouriers
          void _removed

          return finalizeManualDraftRoutes({
            ...state,
            orders: nextOrders,
            routes: nextRoutes,
            couriers: restCouriers,
          })
        })
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
