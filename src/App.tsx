import { useEffect, useMemo, useState, type DragEvent } from 'react'
import './App.css'
import { useDashboardStore } from './store/useDashboardStore'
import { type Courier, type Order, type Route, type RouteStepKind } from './model/types'
import { MINUTE_MS } from './model/rules'
import { computeOrderRisk } from './model/risk'

const routeStepLabel: Record<RouteStepKind, string> = {
  pickup: 'Забирают заказ',
  enroute: 'К клиенту',
  handoff: 'Выдают заказ',
  returning: 'Возвращаются',
}

const tabItems = ['Заказы', 'Смены', 'Курьеры', 'Статистика']

type OrderStageMin = {
  waiting_cook: number
  cooking: number
  ready: number
}

type RouteStageMin = {
  pickup: number
  enroute: number
  handoff: number
  returning: number
}

type DndPayload = {
  kind: 'courier' | 'order'
  id: string
}

const DND_MIME = 'application/x-dashboard-dnd'
let lastDndPayload: DndPayload | null = null
let lastDropRouteId: string | null = null
let autoDraftRouteId: string | null = null

const parseDndPayload = (event: DragEvent<HTMLElement>): DndPayload | null => {
  const transfer = event.dataTransfer
  if (!transfer) return null
  const raw = transfer.getData(DND_MIME) || transfer.getData('text/plain')
  if (!raw) return lastDndPayload
  try {
    const parsed = JSON.parse(raw) as Partial<DndPayload>
    if ((parsed.kind === 'courier' || parsed.kind === 'order') && typeof parsed.id === 'string') {
      return { kind: parsed.kind, id: parsed.id }
    }
  } catch {
    return null
  }
  return null
}

const setDndPayload = (event: DragEvent<HTMLElement>, payload: DndPayload) => {
  event.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
  event.dataTransfer.setData('text/plain', JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'copy'
  lastDndPayload = payload
}

const hasDndPayload = (event: DragEvent<HTMLElement>) => {
  const types = Array.from(event.dataTransfer.types)
  return types.includes(DND_MIME) || types.includes('text/plain') || Boolean(lastDndPayload)
}

const hasDraftRoute = (routes: Record<string, Route>) =>
  Object.values(routes).some((route) => route.status === 'draft')

const maybeCreateAutoDraftRoute = (routes: Record<string, Route>, createRouteDraft: () => string) => {
  if (hasDraftRoute(routes)) {
    autoDraftRouteId = null
    return
  }
  autoDraftRouteId = createRouteDraft()
}

const cleanupAutoDraftRouteIfEmpty = (deleteRouteDraft: (routeId: string) => void) => {
  if (!autoDraftRouteId) return
  const { routes } = useDashboardStore.getState()
  const route = routes[autoDraftRouteId]
  if (route && route.status === 'draft' && !route.courierId && route.orderIds.length === 0) {
    deleteRouteDraft(autoDraftRouteId)
  }
  autoDraftRouteId = null
}

const courierSectionOrder = [
  'Свободные',
  'Возвращаются',
  'Выдают заказ',
  'В пути',
  'Забирают заказ',
] as const

const getCourierSection = (courier: Courier, routes: Record<string, Route>) => {
  if (courier.status === 'free') return 'Свободные'
  if (courier.status === 'returning') return 'Возвращаются'
  const route = courier.routeId ? routes[courier.routeId] : undefined
  if (!route) return 'Свободные'
  if (route.step.kind === 'pickup') return 'Забирают заказ'
  if (route.step.kind === 'enroute') return 'В пути'
  if (route.step.kind === 'handoff') return 'Выдают заказ'
  return 'Возвращаются'
}

const getRouteRemainingMin = (
  route: Route | undefined,
  orders: Record<string, Order>,
  routeStageMin: RouteStageMin,
  now: number,
) => {
  if (!route || route.orderIds.length === 0) return 0
  const currentOrderId = route.orderIds[route.step.orderIndex]
  const currentOrder = currentOrderId ? orders[currentOrderId] : undefined
  const currentStepRemaining = currentOrder?.etaMin ?? 0
  const remainingOrders = Math.max(route.orderIds.length - route.step.orderIndex - 1, 0)
  const fullOrderTrip = routeStageMin.enroute + routeStageMin.handoff

  if (route.step.kind === 'returning') {
    if (!route.returningStartedAt) return 0
    const remainingMs = Math.max(routeStageMin.returning * MINUTE_MS - (now - route.returningStartedAt), 0)
    return Math.ceil(remainingMs / MINUTE_MS)
  }

  if (route.step.kind === 'pickup') {
    return (
      currentStepRemaining +
      routeStageMin.enroute +
      routeStageMin.handoff +
      remainingOrders * fullOrderTrip +
      routeStageMin.returning
    )
  }

  if (route.step.kind === 'enroute') {
    return (
      currentStepRemaining +
      routeStageMin.handoff +
      remainingOrders * fullOrderTrip +
      routeStageMin.returning
    )
  }

  return currentStepRemaining + remainingOrders * fullOrderTrip + routeStageMin.returning
}

const getOrderEtaLabel = (order: Order, now: number, orderStageMin: OrderStageMin) => {
  if (order.status === 'ready') {
    const elapsedMin = Math.max(Math.floor((now - order.statusStartedAt) / MINUTE_MS), 0)
    return elapsedMin === 0 ? 'Только что' : `${elapsedMin} мин`
  }

  if (order.status === 'waiting_cook' || order.status === 'cooking') {
    const stageMs = orderStageMin[order.status] * MINUTE_MS
    const remainingStageMs = Math.max(stageMs - (now - order.statusStartedAt), 0)
    const remainingTotalMs =
      order.status === 'waiting_cook'
        ? remainingStageMs + orderStageMin.cooking * MINUTE_MS
        : remainingStageMs
    const remainingMin = Math.ceil(remainingTotalMs / MINUTE_MS)
    return `Готов через ${remainingMin} мин`
  }

  return `${order.etaMin} мин`
}

const getOrderSlaStatus = (order: Order, now: number) => {
  const totalMs = order.slaTotalMin * MINUTE_MS
  const elapsedMs = now - order.createdAt
  const remainingMs = totalMs - elapsedMs

  if (remainingMs >= 0) {
    return { label: `${Math.ceil(remainingMs / MINUTE_MS)}`, isOverdue: false }
  }

  const overdueMin = Math.ceil(Math.abs(remainingMs) / MINUTE_MS)
  return { label: `+${overdueMin}`, isOverdue: true }
}

function App() {
  const now = useDashboardStore((state) => state.now)
  const isRunning = useDashboardStore((state) => state.isRunning)
  const speed = useDashboardStore((state) => state.speed)
  const orders = useDashboardStore((state) => state.orders)
  const couriers = useDashboardStore((state) => state.couriers)
  const routes = useDashboardStore((state) => state.routes)
  const orderCreateIntervalMin = useDashboardStore((state) => state.orderCreateIntervalMin)
  const orderStageMin = useDashboardStore((state) => state.orderStageMin)
  const orderSlaOptionsMin = useDashboardStore((state) => state.orderSlaOptionsMin)
  const routeStageMin = useDashboardStore((state) => state.routeStageMin)
  const tick = useDashboardStore((state) => state.tick)
  const toggleRun = useDashboardStore((state) => state.toggleRun)
  const setSpeed = useDashboardStore((state) => state.setSpeed)
  const resetSeed = useDashboardStore((state) => state.resetSeed)
  const createRouteDraft = useDashboardStore((state) => state.createRouteDraft)
  const deleteRouteDraft = useDashboardStore((state) => state.deleteRouteDraft)
  const detachCourierFromRoute = useDashboardStore((state) => state.detachCourierFromRoute)
  const attachCourierToRoute = useDashboardStore((state) => state.attachCourierToRoute)
  const detachOrderFromRoute = useDashboardStore((state) => state.detachOrderFromRoute)
  const attachOrderToRoute = useDashboardStore((state) => state.attachOrderToRoute)
  const sendRoute = useDashboardStore((state) => state.sendRoute)
  const setOrderCreateIntervalMin = useDashboardStore((state) => state.setOrderCreateIntervalMin)
  const setOrderStageMin = useDashboardStore((state) => state.setOrderStageMin)
  const setOrderSlaOption = useDashboardStore((state) => state.setOrderSlaOption)
  const setRouteStageMin = useDashboardStore((state) => state.setRouteStageMin)

  const [screen, setScreen] = useState<'dashboard' | 'debug'>('dashboard')

  useEffect(() => {
    if (!isRunning) {
      return
    }
    const interval = window.setInterval(() => {
      tick(1000 * speed)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isRunning, speed, tick])

  const isDebug = screen === 'debug'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__tabs">
          {tabItems.map((label, index) => (
            <button key={label} type="button" className={index === 0 ? 'tab tab--active' : 'tab'}>
              {label}
            </button>
          ))}
        </div>
        <div className="app-header__right">
          <button
            type="button"
            className={isDebug ? 'debug-toggle debug-toggle--active' : 'debug-toggle'}
            onClick={() => setScreen(isDebug ? 'dashboard' : 'debug')}
          >
            Дебаг панель
          </button>
        </div>
      </header>

      <main className="app-content">
        {screen === 'dashboard' ? (
          <DashboardScreen
            orders={orders}
            couriers={couriers}
            routes={routes}
            createRouteDraft={createRouteDraft}
            deleteRouteDraft={deleteRouteDraft}
            detachCourierFromRoute={detachCourierFromRoute}
            attachCourierToRoute={attachCourierToRoute}
            detachOrderFromRoute={detachOrderFromRoute}
            attachOrderToRoute={attachOrderToRoute}
            sendRoute={sendRoute}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
          />
        ) : (
          <DebugPanelScreen
            now={now}
            isRunning={isRunning}
            speed={speed}
            orderStageMin={orderStageMin}
            orderSlaOptionsMin={orderSlaOptionsMin}
            routeStageMin={routeStageMin}
            orderCreateIntervalMin={orderCreateIntervalMin}
            toggleRun={toggleRun}
            setSpeed={setSpeed}
            tick={tick}
            resetSeed={resetSeed}
            setOrderCreateIntervalMin={setOrderCreateIntervalMin}
            setOrderStageMin={setOrderStageMin}
            setOrderSlaOption={setOrderSlaOption}
            setRouteStageMin={setRouteStageMin}
          />
        )}
      </main>
    </div>
  )
}

type DashboardScreenProps = {
  orders: Record<string, Order>
  couriers: Record<string, Courier>
  routes: Record<string, Route>
  createRouteDraft: () => string
  deleteRouteDraft: (routeId: string) => void
  detachCourierFromRoute: (routeId: string) => void
  attachCourierToRoute: (routeId: string, courierId: string) => void
  detachOrderFromRoute: (routeId: string, orderId: string) => void
  attachOrderToRoute: (routeId: string, orderId: string) => void
  sendRoute: (routeId: string) => void
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
}

function DashboardScreen({
  orders,
  couriers,
  routes,
  createRouteDraft,
  deleteRouteDraft,
  detachCourierFromRoute,
  attachCourierToRoute,
  detachOrderFromRoute,
  attachOrderToRoute,
  sendRoute,
  now,
  orderStageMin,
  routeStageMin,
}: DashboardScreenProps) {
  const orderList = useMemo(() => Object.values(orders), [orders])
  const courierList = useMemo(() => Object.values(couriers), [couriers])
  const routeList = useMemo(() => Object.values(routes), [routes])

  const unassignedOrders = orderList.filter((order) => !order.routeId)
  const ordersWaiting = unassignedOrders.filter((order) => order.status === 'waiting_cook')
  const ordersCooking = unassignedOrders.filter((order) => order.status === 'cooking')
  const ordersReady = unassignedOrders.filter((order) => order.status === 'ready')

  const draftRoutes = routeList.filter((route) => route.status === 'draft')
  const sentRoutes = routeList.filter((route) => route.status === 'sent')
  const assignedRoutes = sentRoutes.filter((route) => route.step.kind === 'pickup')
  const clientRoutes = sentRoutes.filter(
    (route) => route.step.kind !== 'pickup' && route.step.kind !== 'returning',
  )

  const courierSections = useMemo(() => {
    const grouped = new Map<string, Courier[]>()
    courierList.forEach((courier) => {
      const key = getCourierSection(courier, routes)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(courier)
    })
    return courierSectionOrder
      .map((title) => {
        const list = grouped.get(title) ?? []
        if (title !== 'Свободные') {
          return { title, list }
        }
        const sorted = [...list].sort((a, b) => {
          const aFreeSince = a.freeSince ?? now
          const bFreeSince = b.freeSince ?? now
          return aFreeSince - bFreeSince
        })
        return { title, list: sorted }
      })
      .filter(({ list }) => list.length > 0)
  }, [courierList, routes, now])

  return (
    <div className="dashboard">
      <section className="dashboard__column">
        <div className="column__title">Курьеры</div>
        {courierSections.map(({ title, list }) => (
          <div key={title} className="section">
            <div className="section__title">{title}</div>
            <div className="section__list">
              {list.map((courier) => (
                <CardCourier
                  key={courier.id}
                  courier={courier}
                  routes={routes}
                  orders={orders}
                  now={now}
                  routeStageMin={routeStageMin}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="dashboard__column">
        <div className="column__title">Заказы</div>
        <OrdersSection
          title="Готовы"
          orders={ordersReady}
          routes={routes}
          now={now}
          orderStageMin={orderStageMin}
          routeStageMin={routeStageMin}
        />
        <OrdersSection
          title="Готовятся"
          orders={ordersCooking}
          routes={routes}
          now={now}
          orderStageMin={orderStageMin}
          routeStageMin={routeStageMin}
        />
        <OrdersSection
          title="Ожидают готовки"
          orders={ordersWaiting}
          routes={routes}
          now={now}
          orderStageMin={orderStageMin}
          routeStageMin={routeStageMin}
        />
      </section>

      <section className="dashboard__column">
        <div className="column__header">
          <div className="column__title">Назначения</div>
          <button type="button" className="route-draft__action" onClick={createRouteDraft}>
            Новый маршрут
          </button>
        </div>
        {draftRoutes.length > 0 ? (
          <div className="section__list">
            {draftRoutes.map((route) => (
              <RouteDraftCard
                key={route.id}
                route={route}
                couriers={courierList}
                orders={orders}
                now={now}
                onDelete={deleteRouteDraft}
                onDetachCourier={detachCourierFromRoute}
                onAttachCourier={attachCourierToRoute}
                onDetachOrder={detachOrderFromRoute}
                onAttachOrder={attachOrderToRoute}
                onSend={sendRoute}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="dashboard__column">
        <div className="column__title">Доставка</div>
        {assignedRoutes.length > 0 ? (
          <div className="section">
            <div className="section__title">Назначенные</div>
            <div className="section__list">
              {assignedRoutes.map((route) => (
                <RouteDeliveryCard
                  key={route.id}
                  route={route}
                  courier={couriers[route.courierId]}
                  orders={orders}
                  now={now}
                />
              ))}
            </div>
          </div>
        ) : null}
        {clientRoutes.length > 0 ? (
          <div className="section">
            <div className="section__title">К клиенту</div>
            <div className="section__list">
              {clientRoutes.map((route) => (
                <RouteDeliveryCard
                  key={route.id}
                  route={route}
                  courier={couriers[route.courierId]}
                  orders={orders}
                  now={now}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function OrdersSection({
  title,
  orders,
  routes,
  now,
  orderStageMin,
  routeStageMin,
}: {
  title: string
  orders: Order[]
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
}) {
  if (orders.length === 0) return null
  return (
    <div className="section">
      <div className="section__title">{title}</div>
      <div className="section__list">
        {orders.map((order) => (
          <CardOrder
            key={order.id}
            order={order}
            routes={routes}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
          />
        ))}
      </div>
    </div>
  )
}

function CardCourier({
  courier,
  routes,
  orders,
  now,
  routeStageMin,
}: {
  courier: Courier
  routes: Record<string, Route>
  orders: Record<string, Order>
  now: number
  routeStageMin: RouteStageMin
}) {
  const attachCourierToRoute = useDashboardStore((state) => state.attachCourierToRoute)
  const createRouteDraft = useDashboardStore((state) => state.createRouteDraft)
  const deleteRouteDraft = useDashboardStore((state) => state.deleteRouteDraft)
  const [isDragging, setIsDragging] = useState(false)
  const route = courier.routeId ? routes[courier.routeId] : undefined
  const remainingMin = getRouteRemainingMin(route, orders, routeStageMin, now)
  const freeMinutes = Math.max(Math.floor((now - (courier.freeSince ?? now)) / MINUTE_MS), 0)
  const label =
    courier.status === 'free'
      ? `${freeMinutes} мин`
      : `Вернётся через ${remainingMin} мин`
  const isAssignedToDraft = Object.values(routes).some(
    (routeItem) => routeItem.status === 'draft' && routeItem.courierId === courier.id,
  )
  const isDraggable = courier.status === 'free' && !isAssignedToDraft

  return (
    <div
      className={`card card--courier${isDraggable ? ' card--draggable' : ''}${
        isDragging ? ' card--dragging' : ''
      }`}
      draggable={isDraggable}
      onDragStart={(event) => {
        if (!isDraggable) return
        setIsDragging(true)
        document.body.classList.add('is-dragging')
        maybeCreateAutoDraftRoute(routes, createRouteDraft)
        setDndPayload(event, { kind: 'courier', id: courier.id })
      }}
      onDragEnd={() => {
        setIsDragging(false)
        document.body.classList.remove('is-dragging')
        if (lastDropRouteId && lastDndPayload?.kind === 'courier') {
          attachCourierToRoute(lastDropRouteId, lastDndPayload.id)
        }
        lastDndPayload = null
        lastDropRouteId = null
        cleanupAutoDraftRouteIfEmpty(deleteRouteDraft)
      }}
    >
      <div className="card__row">
        <div className="card__title">{courier.name}</div>
      </div>
      <div className="chip chip--ghost">{label}</div>
    </div>
  )
}

function CardOrder({
  order,
  routes,
  now,
  orderStageMin,
  routeStageMin,
}: {
  order: Order
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
}) {
  const attachOrderToRoute = useDashboardStore((state) => state.attachOrderToRoute)
  const createRouteDraft = useDashboardStore((state) => state.createRouteDraft)
  const deleteRouteDraft = useDashboardStore((state) => state.deleteRouteDraft)
  const [isDragging, setIsDragging] = useState(false)
  const [isNewWaitingOrder, setIsNewWaitingOrder] = useState(order.status === 'waiting_cook')
  const slaStatus = getOrderSlaStatus(order, now)
  const { speedupFactor, deficitMin } = computeOrderRisk(order, now, { orderStageMin, routeStageMin })
  const isBehindSchedule = speedupFactor > 1.05 || deficitMin > 0
  const isAssignedToDraft = Object.values(routes).some(
    (routeItem) => routeItem.status === 'draft' && routeItem.orderIds.includes(order.id),
  )
  const isDraggable = order.status !== 'enroute' && order.status !== 'handoff' && !order.routeId && !isAssignedToDraft

  useEffect(() => {
    if (!isNewWaitingOrder) return
    const timeout = window.setTimeout(() => {
      setIsNewWaitingOrder(false)
    }, 2400)
    return () => window.clearTimeout(timeout)
  }, [isNewWaitingOrder])
  return (
    <div
      className={`card card--order${isNewWaitingOrder ? ' card--order-new' : ''}${
        isDraggable ? ' card--draggable' : ''
      }${isDragging ? ' card--dragging' : ''}${slaStatus.isOverdue ? ' card--overdue' : ''}`}
      draggable={isDraggable}
      onDragStart={(event) => {
        if (!isDraggable) return
        setIsDragging(true)
        document.body.classList.add('is-dragging')
        maybeCreateAutoDraftRoute(routes, createRouteDraft)
        setDndPayload(event, { kind: 'order', id: order.id })
      }}
      onDragEnd={() => {
        setIsDragging(false)
        document.body.classList.remove('is-dragging')
        if (lastDropRouteId && lastDndPayload?.kind === 'order') {
          attachOrderToRoute(lastDropRouteId, lastDndPayload.id)
        }
        lastDndPayload = null
        lastDropRouteId = null
        cleanupAutoDraftRouteIfEmpty(deleteRouteDraft)
      }}
    >
      <div className="card__row">
        <div className="card__title">{order.address}</div>
        <div
          className={`sla-pill${slaStatus.isOverdue ? ' sla-pill--overdue' : ''}${
            isBehindSchedule ? ' sla-pill--risk' : ''
          }`}
        >
          {slaStatus.label}
        </div>
      </div>
      <div className="chip chip--ghost">{getOrderEtaLabel(order, now, orderStageMin)}</div>
    </div>
  )
}

type RouteDraftCardProps = {
  route: Route
  couriers: Courier[]
  orders: Record<string, Order>
  now: number
  onDelete: (routeId: string) => void
  onDetachCourier: (routeId: string) => void
  onAttachCourier: (routeId: string, courierId: string) => void
  onDetachOrder: (routeId: string, orderId: string) => void
  onAttachOrder: (routeId: string, orderId: string) => void
  onSend: (routeId: string) => void
}

function RouteDraftCard({
  route,
  couriers,
  orders,
  now,
  onDelete,
  onDetachCourier,
  onAttachCourier,
  onDetachOrder,
  onAttachOrder,
  onSend,
}: RouteDraftCardProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const availableCouriers = couriers.filter(
    (courier) => courier.status === 'free' && courier.id !== route.courierId,
  )
  const selectedOrderIds = new Set(route.orderIds)
  const availableOrders = Object.values(orders).filter(
    (order) =>
      order.status !== 'enroute' && order.status !== 'handoff' && !order.routeId && !selectedOrderIds.has(order.id),
  )
  const courierName = route.courierId
    ? couriers.find((courier) => courier.id === route.courierId)?.name ?? '—'
    : undefined

  const canAttachOrder = route.orderIds.length < 3
  const canSend = route.courierId && route.orderIds.length >= 1 && route.orderIds.length <= 3
  const isEmpty = !route.courierId && route.orderIds.length === 0
  const isFull = route.orderIds.length >= 3

  const canDropPayload = (payload: DndPayload) => {
    if (payload.kind === 'courier') {
      if (route.courierId) return false
      const courier = couriers.find((item) => item.id === payload.id)
      return Boolean(courier && courier.status === 'free' && !courier.routeId)
    }
    if (payload.kind === 'order') {
      if (!canAttachOrder || selectedOrderIds.has(payload.id)) return false
      const order = orders[payload.id]
      return Boolean(order && order.status !== 'enroute' && order.status !== 'handoff' && !order.routeId)
    }
    return false
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const payload = parseDndPayload(event)
    if (!payload || !canDropPayload(payload)) {
      setIsDragOver(false)
      return
    }
    setIsDragOver(false)
    if (payload.kind === 'courier') {
      onAttachCourier(route.id, payload.id)
    }
    if (payload.kind === 'order') {
      onAttachOrder(route.id, payload.id)
    }
    lastDndPayload = null
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDndPayload(event)) return
    if (isFull) return
    const payload = parseDndPayload(event)
    if (!payload || !canDropPayload(payload)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)
    lastDropRouteId = route.id
  }

  const handleDragOverCapture = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDndPayload(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }
    setIsDragOver(false)
    if (lastDropRouteId === route.id) {
      lastDropRouteId = null
    }
  }

  return (
    <div
      className={`${isEmpty ? 'card card--route card--route-empty' : 'card card--route'}${
        isFull ? ' card--route-full' : ''
      }${isDragOver && !isFull ? ' card--route-drop' : ''}`}
      onDropCapture={handleDrop}
      onDragOver={handleDragOver}
      onDragOverCapture={handleDragOverCapture}
      onDragLeave={handleDragLeave}
    >
      <div className="route-draft__header">
        <div className="route-draft__header-left">
          {route.courierId ? (
            <>
              <button
                type="button"
                className="route-draft__remove"
                onClick={() => onDetachCourier(route.id)}
                aria-label="Удалить курьера"
              >
                ×
              </button>
              <div className="route-draft__title">{courierName}</div>
            </>
          ) : (
            <div className="route-draft__placeholder">
              <span className="route-draft__placeholder-text">Курьер</span>
              <span className="route-draft__icon route-draft__icon--plus" aria-hidden="true" />
              <select
                className="route-draft__select"
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    onAttachCourier(route.id, event.target.value)
                  }
                }}
              >
                <option value="">Курьер +</option>
                {availableCouriers.map((courier) => (
                  <option key={courier.id} value={courier.id}>
                    {courier.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      <div className="route-draft__divider" />
      <div className="route-draft__orders">
        {route.orderIds.map((orderId) => {
          const order = orders[orderId]
          const slaStatus = order ? getOrderSlaStatus(order, now) : { label: '0', isOverdue: false }
          return (
            <div
              key={orderId}
              className={`route-draft__order${slaStatus.isOverdue ? ' route-draft__order--overdue' : ''}`}
            >
              <div className="route-draft__order-info">
                <button
                  type="button"
                  className="route-draft__remove route-draft__remove--small"
                  onClick={() => onDetachOrder(route.id, orderId)}
                  aria-label="Удалить заказ"
                >
                  ×
                </button>
                <span className="route-draft__order-title">{order?.address ?? orderId}</span>
              </div>
              <span className={`sla-pill${slaStatus.isOverdue ? ' sla-pill--overdue' : ''}`}>{slaStatus.label}</span>
            </div>
          )
        })}
        {canAttachOrder ? (
          <div className="route-draft__order route-draft__order--add">
            <div className="route-draft__order-info">
              <span className="route-draft__order-placeholder">Заказ</span>
              <span
                className="route-draft__icon route-draft__icon--plus route-draft__icon--small"
                aria-hidden="true"
              />
            </div>
            <select
              className="route-draft__select"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  onAttachOrder(route.id, event.target.value)
                }
              }}
            >
              <option value="">Заказ +</option>
              {availableOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.address}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="route-draft__footer">
        <button type="button" className="route-draft__action" onClick={() => onDelete(route.id)}>
          Удалить
        </button>
        {!isEmpty ? (
          <button
            type="button"
            className="route-draft__action route-draft__action--primary"
            disabled={!canSend}
            onClick={() => onSend(route.id)}
          >
            Отправить
          </button>
        ) : null}
      </div>
    </div>
  )
}

function RouteDeliveryCard({
  route,
  courier,
  orders,
  now,
}: {
  route: Route
  courier?: Courier
  orders: Record<string, Order>
  now: number
}) {
  const getElapsedMin = (startedAt?: number) =>
    startedAt ? Math.max(Math.floor((now - startedAt) / MINUTE_MS), 0) : 0
  const formatElapsedLabel = (label: string, startedAt?: number) => {
    const elapsed = getElapsedMin(startedAt)
    return elapsed > 0 ? `${label} ${elapsed} мин` : label
  }
  const currentOrderId = route.orderIds[route.step.orderIndex]
  const currentOrder = currentOrderId ? orders[currentOrderId] : undefined
  const headerLabel =
    route.step.kind === 'pickup'
      ? currentOrder
        ? formatElapsedLabel('Получение', currentOrder.statusStartedAt)
        : null
      : route.step.kind === 'returning'
        ? route.returningStartedAt
          ? formatElapsedLabel(routeStepLabel[route.step.kind], route.returningStartedAt)
          : null
        : null
  return (
    <div className="card card--delivery">
      <div className="card__row">
        <div className="card__title">{courier?.name ?? '—'}</div>
      </div>
      {headerLabel ? <div className="chip delivery__label">{headerLabel}</div> : null}
      <div className="delivery__orders">
        {route.orderIds.map((orderId, index) => {
          const order = orders[orderId]
          const slaStatus = order ? getOrderSlaStatus(order, now) : { label: '0', isOverdue: false }
          const orderLabel =
            order?.status === 'enroute'
              ? formatElapsedLabel('В пути', order.statusStartedAt)
              : order?.status === 'handoff'
                ? formatElapsedLabel('Выдача клиенту', order.statusStartedAt)
                : null
          return (
            <div
              key={orderId}
              className={`delivery__order${index === route.step.orderIndex ? ' delivery__order--active' : ''}${
                slaStatus.isOverdue ? ' delivery__order--overdue' : ''
              }`}
            >
              <div className="delivery__order-main">
                <div className="delivery__order-title">{order?.address ?? orderId}</div>
                {orderLabel ? <span className="chip delivery__order-label">{orderLabel}</span> : null}
              </div>
              <span className={`sla-pill${slaStatus.isOverdue ? ' sla-pill--overdue' : ''}`}>{slaStatus.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type DebugPanelScreenProps = {
  now: number
  isRunning: boolean
  speed: 1 | 3 | 5 | 20
  orderStageMin: OrderStageMin
  orderSlaOptionsMin: number[]
  routeStageMin: RouteStageMin
  orderCreateIntervalMin: number
  toggleRun: () => void
  setSpeed: (speed: 1 | 3 | 5 | 20) => void
  tick: (deltaMs: number) => void
  resetSeed: () => void
  setOrderCreateIntervalMin: (value: number) => void
  setOrderStageMin: (stage: keyof OrderStageMin, value: number) => void
  setOrderSlaOption: (index: number, value: number) => void
  setRouteStageMin: (stage: keyof RouteStageMin, value: number) => void
}

function DebugPanelScreen({
  now,
  isRunning,
  speed,
  orderStageMin,
  orderSlaOptionsMin,
  routeStageMin,
  orderCreateIntervalMin,
  toggleRun,
  setSpeed,
  tick,
  resetSeed,
  setOrderCreateIntervalMin,
  setOrderStageMin,
  setOrderSlaOption,
  setRouteStageMin,
}: DebugPanelScreenProps) {
  const setOrderStageValue = (stage: keyof OrderStageMin, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setOrderStageMin(stage, Math.max(parsed, 0))
  }

  const setRouteStageValue = (stage: keyof RouteStageMin, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setRouteStageMin(stage, Math.max(parsed, 0))
  }

  const setOrderIntervalValue = (value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setOrderCreateIntervalMin(Math.max(parsed, 0))
  }

  const setOrderSlaValue = (index: number, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return
    setOrderSlaOption(index, Math.max(parsed, 0))
  }

  return (
    <div className="debug">
      <header className="debug__header">
        <div>
          <h1>Симулятор доставки</h1>
        </div>
        <div className="debug__clock">{new Date(now).toLocaleTimeString()}</div>
      </header>

      <section className="debug__controls">
        <button type="button" className="btn" onClick={toggleRun}>
          {isRunning ? 'Пауза' : 'Старт'}
        </button>
        <div className="btn-group">
          {[1, 3, 5, 20].map((value) => (
            <button
              key={value}
              type="button"
              className={value === speed ? 'btn btn--active' : 'btn btn--ghost'}
              onClick={() => setSpeed(value as 1 | 3 | 5 | 20)}
            >
              x{value}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => tick(60_000)}>
          Шаг +1 мин
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => tick(600_000)}>
          Шаг +10 мин
        </button>
        <button type="button" className="btn btn--ghost" onClick={resetSeed}>
          Сбросить сид
        </button>
      </section>

      <section className="debug__grid">
        <div className="panel panel--stage">
          <h2>Длительности этапов</h2>
          <div className="stage-editor">
            <div className="stage-editor__group">
              <label className="stage-editor__row">
                <span>Интервал новых заказов</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderCreateIntervalMin}
                  onChange={(event) => setOrderIntervalValue(event.target.value)}
                />
              </label>
              <div className="stage-editor__title">SLA заказа</div>
              {orderSlaOptionsMin.map((value, index) => (
                <label key={`sla_${index}`} className="stage-editor__row">
                  <span>Опция {index + 1}</span>
                  <input
                    className="stage-editor__input"
                    type="number"
                    min="0"
                    step="1"
                    value={value}
                    onChange={(event) => setOrderSlaValue(index, event.target.value)}
                  />
                </label>
              ))}
              <div className="stage-editor__title">Заказы</div>
              <label className="stage-editor__row">
                <span>Ожидают готовки</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderStageMin.waiting_cook}
                  onChange={(event) => setOrderStageValue('waiting_cook', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Готовятся</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderStageMin.cooking}
                  onChange={(event) => setOrderStageValue('cooking', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Готовы</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={orderStageMin.ready}
                  onChange={(event) => setOrderStageValue('ready', event.target.value)}
                />
              </label>
            </div>
            <div className="stage-editor__group">
              <div className="stage-editor__title">Доставка</div>
              <label className="stage-editor__row">
                <span>Забор</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.pickup}
                  onChange={(event) => setRouteStageValue('pickup', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>В пути</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.enroute}
                  onChange={(event) => setRouteStageValue('enroute', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Выдача</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.handoff}
                  onChange={(event) => setRouteStageValue('handoff', event.target.value)}
                />
              </label>
              <label className="stage-editor__row">
                <span>Возврат</span>
                <input
                  className="stage-editor__input"
                  type="number"
                  min="0"
                  step="1"
                  value={routeStageMin.returning}
                  onChange={(event) => setRouteStageValue('returning', event.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}

export default App
