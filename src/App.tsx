import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import './App.css'
import { useDashboardStore } from './store/useDashboardStore'
import { type Courier, type Order, type Route, type RouteStepKind, RESTAURANT_COORDS } from './model/types'
import { MINUTE_MS } from './model/rules'
import { computeOrderRisk } from './model/risk'
import burgerMenuIcon from './assets/burger-menu.svg'
import dndMapIcon from './assets/dnd-map.svg'
import walkingCourierIcon from './assets/Walking courier.svg'
import bikeCourierIcon from './assets/Bike courier.svg'
import carCourierIcon from './assets/Car courier 2.svg'
import crossIcon from './assets/Cross.svg'
import deleteIcon from './assets/Delete.svg'
import editIcon from './assets/Edit.svg'
import plusIcon from './assets/Plus.svg'
import { MapboxMap } from './components/MapboxMap'

const routeStepLabel: Record<RouteStepKind, string> = {
  pickup: 'Забирают заказ',
  enroute: 'К клиенту',
  handoff: 'Выдают заказ',
  returning: 'Возвращаются',
}

const courierTypeIcons = {
  pedestrian: walkingCourierIcon,
  bike: bikeCourierIcon,
  car: carCourierIcon,
} as const

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

type DndPayload =
  | { kind: 'courier'; id: string }
  | { kind: 'order'; id: string }
  | { kind: 'route-order'; id: string; routeId: string }

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
    const parsed = JSON.parse(raw) as { kind?: string; id?: string; routeId?: string }
    if (parsed.kind === 'route-order' && typeof parsed.id === 'string' && typeof parsed.routeId === 'string') {
      return { kind: 'route-order', id: parsed.id, routeId: parsed.routeId }
    }
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
  event.dataTransfer.effectAllowed = payload.kind === 'route-order' ? 'move' : 'copy'
  lastDndPayload = payload
}

const hasDndPayload = (event: DragEvent<HTMLElement>) => {
  const types = Array.from(event.dataTransfer.types)
  return types.includes(DND_MIME) || types.includes('text/plain') || Boolean(lastDndPayload)
}

function setDragImageAsCopy(event: DragEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const mouseEvent = event as unknown as { offsetX: number; offsetY: number }
  const offsetX = mouseEvent.offsetX ?? rect.width / 2
  const offsetY = mouseEvent.offsetY ?? rect.height / 2
  const dragEl = element.cloneNode(true) as HTMLElement
  dragEl.style.cssText = `position: absolute; left: -9999px; top: 0; width: ${rect.width}px; height: ${rect.height}px; opacity: 0.9; pointer-events: none; box-sizing: border-box;`
  document.body.appendChild(dragEl)
  event.dataTransfer.setDragImage(dragEl, offsetX, offsetY)
  setTimeout(() => dragEl.remove(), 0)
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

const getOrderRiskStatus = (
  order: Order,
  now: number,
  orderStageMin: OrderStageMin,
  routeStageMin: RouteStageMin,
) => {
  const { speedupFactor, deficitMin } = computeOrderRisk(order, now, {
    orderStageMin,
    routeStageMin,
  })
  return {
    isBehindSchedule: speedupFactor > 1.05 || deficitMin > 0,
  }
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
  const reorderRouteOrders = useDashboardStore((state) => state.reorderRouteOrders)
  const sendRoute = useDashboardStore((state) => state.sendRoute)
  const revertRouteToDraft = useDashboardStore((state) => state.revertRouteToDraft)
  const setOrderCreateIntervalMin = useDashboardStore((state) => state.setOrderCreateIntervalMin)
  const setOrderStageMin = useDashboardStore((state) => state.setOrderStageMin)
  const setOrderSlaOption = useDashboardStore((state) => state.setOrderSlaOption)
  const setRouteStageMin = useDashboardStore((state) => state.setRouteStageMin)

  const [screen, setScreen] = useState<'dashboard' | 'debug'>('dashboard')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
      <header className={`app-header${isMenuOpen ? ' app-header--menu-open' : ''}`}>
        <button
          type="button"
          className="app-header__burger"
          aria-label="Открыть меню"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <img src={burgerMenuIcon} alt="" />
        </button>
        <div className="app-header__tabs">
          {tabItems.map((label, index) => (
            <button
              key={label}
              type="button"
              className={index === 0 ? 'tab tab--active' : 'tab'}
              onClick={() => setIsMenuOpen(false)}
            >
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
            reorderRouteOrders={reorderRouteOrders}
            sendRoute={sendRoute}
            revertRouteToDraft={revertRouteToDraft}
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
  reorderRouteOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  sendRoute: (routeId: string) => void
  revertRouteToDraft: (routeId: string) => void
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
  reorderRouteOrders,
  sendRoute,
  revertRouteToDraft,
  now,
  orderStageMin,
  routeStageMin,
}: DashboardScreenProps) {
  const orderList = useMemo(() => Object.values(orders), [orders])
  const courierList = useMemo(() => Object.values(couriers), [couriers])
  const routeList = useMemo(() => Object.values(routes), [routes])
  const dashboardRef = useRef<HTMLDivElement | null>(null)
  const resizerRef = useRef<HTMLDivElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [rightColumnWidth, setRightColumnWidth] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [isUserResized, setIsUserResized] = useState(false)
  const [mapFocusCoords, setMapFocusCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [mapFocusBounds, setMapFocusBounds] = useState<{
    sw: { lat: number; lng: number }
    ne: { lat: number; lng: number }
  } | null>(null)
  const [focusedRouteId, setFocusedRouteId] = useState<string | null>(null)

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

  /** Маршрут всегда строится от ресторана: ресторан → заказ 1 → заказ 2 → заказ 3 */
  const routePathCoords = useMemo((): { lng: number; lat: number }[] | null => {
    if (!focusedRouteId) return null
    const route = routes[focusedRouteId]
    const orderIds = route?.orderIds ?? []
    if (orderIds.length < 1) return null
    const orderCoords = orderIds
      .map((id) => orders[id]?.coords)
      .filter((c): c is { lat: number; lng: number } => c != null)
    if (orderCoords.length === 0) return null
    const fromRestaurant = [RESTAURANT_COORDS, ...orderCoords].map((c) => ({ lng: c.lng, lat: c.lat }))
    return fromRestaurant.length >= 2 ? fromRestaurant : null
  }, [focusedRouteId, orders, routes])

  const orderMarkers = useMemo(
    () => {
      const routeOrderIds = focusedRouteId ? routes[focusedRouteId]?.orderIds ?? [] : []
      return orderList
        .filter((o) => o.status !== 'delivered')
        .map((o) => {
          const idx = routeOrderIds.indexOf(o.id)
          const routePosition = idx >= 0 ? idx + 1 : undefined
          return {
            id: o.id,
            lng: o.coords.lng,
            lat: o.coords.lat,
            address: o.address,
            isOverdue:
              getOrderSlaStatus(o, now).isOverdue ||
              getOrderRiskStatus(o, now, orderStageMin, routeStageMin).isBehindSchedule,
            routePosition,
          }
        })
    },
    [orderList, now, orderStageMin, routeStageMin, focusedRouteId, routes],
  )

  const focusMapOnRoute = useCallback((routeId: string) => {
    const state = useDashboardStore.getState()
    const route = state.routes[routeId]
    if (!route?.orderIds.length) return
    setFocusedRouteId(routeId)
    const orderCoords = route.orderIds
      .map((id) => state.orders[id]?.coords)
      .filter((c): c is { lat: number; lng: number } => c != null)
    if (orderCoords.length === 0) return
    const coords = [RESTAURANT_COORDS, ...orderCoords]
    setMapFocusCoords(null)
    const lngs = coords.map((c) => c.lng)
    const lats = coords.map((c) => c.lat)
    setMapFocusBounds({
      sw: { lng: Math.min(...lngs), lat: Math.min(...lats) },
      ne: { lng: Math.max(...lngs), lat: Math.max(...lats) },
    })
  }, [])

  useEffect(() => {
    if (isUserResized) return
    const updateDefaultWidth = () => {
      const dashboard = dashboardRef.current
      if (!dashboard) return
      const totalWidth = dashboard.getBoundingClientRect().width
      if (!totalWidth) return
      const resizerWidth = 12
      const baseColumnWidth = (totalWidth - resizerWidth) / 6
      setRightColumnWidth(Math.floor(baseColumnWidth * 2))
    }
    updateDefaultWidth()
    window.addEventListener('resize', updateDefaultWidth)
    return () => window.removeEventListener('resize', updateDefaultWidth)
  }, [isUserResized])

  useEffect(() => {
    if (!isResizing) return
    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeStateRef.current
      const dashboard = dashboardRef.current
      if (!state || !dashboard) return
      const totalWidth = dashboard.getBoundingClientRect().width
      const resizerWidth = 12
      const maxRightWidth = totalWidth - resizerWidth
      const nextWidth = Math.min(
        maxRightWidth,
        Math.max(0, state.startWidth - (event.clientX - state.startX)),
      )
      setRightColumnWidth(Math.floor(nextWidth))
    }
    const handlePointerUp = () => {
      setIsResizing(false)
      resizeStateRef.current = null
      document.body.classList.remove('is-resizing')
      if (activePointerIdRef.current !== null) {
        resizerRef.current?.releasePointerCapture(activePointerIdRef.current)
        activePointerIdRef.current = null
      }
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isResizing])

  return (
    <div className="dashboard" ref={dashboardRef}>
      <div className="dashboard__left">
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
        <div className="dashboard__divider" aria-hidden />
        <section className="dashboard__column">
          <div className="column__title">Заказы</div>
          <OrdersSection
            title="Готовы"
            orders={ordersReady}
            routes={routes}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
            onOrderCardClick={(coords) => {
              setFocusedRouteId(null)
              setMapFocusBounds(null)
              setMapFocusCoords(coords)
            }}
            onOrderAttachedToRoute={focusMapOnRoute}
          />
          <OrdersSection
            title="Готовятся"
            orders={ordersCooking}
            routes={routes}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
            onOrderCardClick={(coords) => {
              setFocusedRouteId(null)
              setMapFocusBounds(null)
              setMapFocusCoords(coords)
            }}
            onOrderAttachedToRoute={focusMapOnRoute}
          />
          <OrdersSection
            title="Ожидают готовки"
            orders={ordersWaiting}
            routes={routes}
            now={now}
            orderStageMin={orderStageMin}
            routeStageMin={routeStageMin}
            onOrderCardClick={(coords) => {
              setFocusedRouteId(null)
              setMapFocusBounds(null)
              setMapFocusCoords(coords)
            }}
            onOrderAttachedToRoute={focusMapOnRoute}
          />
        </section>
        <div className="dashboard__divider" aria-hidden />
        <section className="dashboard__column">
          <div className="column__title">Маршруты</div>
          <div className="section">
            <button type="button" className="section__title-row section__title-row--action" onClick={createRouteDraft} aria-label="Новый маршрут">
              <span className="section__title">Новый маршрут</span>
              <img src={plusIcon} alt="" width={12} height={12} />
            </button>
            <div className="section__list">
              {draftRoutes.map((route) => (
                <RouteDraftCard
                  key={route.id}
                  route={route}
                  couriers={courierList}
                  orders={orders}
                  now={now}
                  orderStageMin={orderStageMin}
                  routeStageMin={routeStageMin}
                  onDelete={deleteRouteDraft}
                  onDetachCourier={detachCourierFromRoute}
                  onAttachCourier={attachCourierToRoute}
                  onDetachOrder={detachOrderFromRoute}
                  onAttachOrder={(routeId, orderId) => {
                    attachOrderToRoute(routeId, orderId)
                    focusMapOnRoute(routeId)
                  }}
                  onReorderOrders={reorderRouteOrders}
                  onSend={sendRoute}
                />
              ))}
            </div>
          </div>
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
                    orderStageMin={orderStageMin}
                    routeStageMin={routeStageMin}
                    onRevertToDraft={revertRouteToDraft}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
        <div className="dashboard__divider" aria-hidden />
        <section className="dashboard__column">
          <div className="column__title">Доставка</div>
          {clientRoutes.length > 0 ? (
            <div className="section">
              <div className="section__title">Активные</div>
              <div className="section__list">
                {clientRoutes.map((route) => (
                  <RouteDeliveryCard
                    key={route.id}
                    route={route}
                    courier={couriers[route.courierId]}
                    orders={orders}
                    now={now}
                    orderStageMin={orderStageMin}
                    routeStageMin={routeStageMin}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div
        ref={resizerRef}
        className={`dashboard__resizer${isResizing ? ' dashboard__resizer--active' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменение ширины колонки"
        onPointerDown={(event) => {
          const width = rightColumnWidth ?? 0
          resizeStateRef.current = { startX: event.clientX, startWidth: width }
          setIsUserResized(true)
          setIsResizing(true)
          document.body.classList.add('is-resizing')
          activePointerIdRef.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          event.preventDefault()
        }}
      >
        <img className="dashboard__resizer-icon" src={dndMapIcon} alt="" />
      </div>

      <section
        className="dashboard__column dashboard__column--map"
        style={rightColumnWidth ? { width: `${rightColumnWidth}px` } : undefined}
      >
        <MapWidget
          orders={orders}
          orderMarkers={orderMarkers}
          restaurantCoords={RESTAURANT_COORDS}
          routePathCoords={routePathCoords}
          isRouteDraft={!!(focusedRouteId && routes[focusedRouteId]?.status === 'draft')}
          focusCoords={mapFocusCoords}
          focusBounds={mapFocusBounds}
          onClearFocus={() => {
            setMapFocusCoords(null)
            setMapFocusBounds(null)
            // Не сбрасываем focusedRouteId при движении карты — маршрут остаётся до клика по заказу/другой карточке
          }}
        />
      </section>
    </div>
  )
}

export type OrderMarkerItem = {
  id: string
  lng: number
  lat: number
  address: string
  isOverdue: boolean
  routePosition?: number
}

export function MapWidget({
  orders: _orders,
  orderMarkers,
  restaurantCoords,
  routePathCoords,
  isRouteDraft,
  focusCoords,
  focusBounds,
  onClearFocus,
}: {
  orders: Record<string, Order>
  orderMarkers: OrderMarkerItem[]
  restaurantCoords?: { lat: number; lng: number } | null
  routePathCoords: { lng: number; lat: number }[] | null
  isRouteDraft?: boolean
  focusCoords: { lat: number; lng: number } | null
  focusBounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null
  onClearFocus: () => void
}) {
  void _orders
  return (
    <div className="map-widget__container">
      <MapboxMap
        markers={orderMarkers}
        restaurantCoords={restaurantCoords ?? null}
        routePathCoords={routePathCoords}
        isRouteDraft={isRouteDraft ?? false}
        focusCoords={focusCoords}
        focusBounds={focusBounds}
        onClearFocus={onClearFocus}
      />
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
  onOrderCardClick,
  onOrderAttachedToRoute,
}: {
  title: string
  orders: Order[]
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  onOrderCardClick?: (coords: { lat: number; lng: number }) => void
  onOrderAttachedToRoute?: (routeId: string) => void
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
            onFocusOnMap={onOrderCardClick}
            onOrderAttachedToRoute={onOrderAttachedToRoute}
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
  const isDraggable = !isAssignedToDraft

  return (
    <div
      className={`card card--courier${isDraggable ? ' card--draggable' : ''}${
        isDragging ? ' card--dragging' : ''
      }${isAssignedToDraft ? ' card--in-draft' : ''}`}
      draggable={isDraggable}
      onDragStart={(event) => {
        if (!isDraggable) return
        setIsDragging(true)
        document.body.classList.add('is-dragging')
        maybeCreateAutoDraftRoute(routes, createRouteDraft)
        setDndPayload(event, { kind: 'courier', id: courier.id })
        setDragImageAsCopy(event, event.currentTarget)
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
        <img
          src={courierTypeIcons[courier.type]}
          alt=""
          className="card__courier-icon"
          aria-hidden
        />
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
  onFocusOnMap,
  onOrderAttachedToRoute,
}: {
  order: Order
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  onFocusOnMap?: (coords: { lat: number; lng: number }) => void
  onOrderAttachedToRoute?: (routeId: string) => void
}) {
  const attachOrderToRoute = useDashboardStore((state) => state.attachOrderToRoute)
  const createRouteDraft = useDashboardStore((state) => state.createRouteDraft)
  const deleteRouteDraft = useDashboardStore((state) => state.deleteRouteDraft)
  const [isDragging, setIsDragging] = useState(false)
  const dragJustEndedRef = useRef(false)
  const [isNewWaitingOrder, setIsNewWaitingOrder] = useState(order.status === 'waiting_cook')
  const slaStatus = getOrderSlaStatus(order, now)
  const { isBehindSchedule } = getOrderRiskStatus(order, now, orderStageMin, routeStageMin)
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

  const handleFocusOnMap = () => {
    if (isDragging || dragJustEndedRef.current || !onFocusOnMap) return
    onFocusOnMap({ ...order.coords })
  }

  return (
    <div
      className={`card card--order${isNewWaitingOrder ? ' card--order-new' : ''}${
        isDraggable ? ' card--draggable' : ''
      }${isDragging ? ' card--dragging' : ''}${
        slaStatus.isOverdue || isBehindSchedule ? ' card--overdue' : ''
      }${isAssignedToDraft ? ' card--in-draft' : ''}${onFocusOnMap ? ' card--focus-on-map' : ''}`}
      role={onFocusOnMap ? 'button' : undefined}
      tabIndex={onFocusOnMap ? 0 : undefined}
      onClick={handleFocusOnMap}
      onKeyDown={(e) => {
        if (onFocusOnMap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleFocusOnMap()
        }
      }}
      draggable={isDraggable}
      onDragStart={(event) => {
        if (!isDraggable) return
        setIsDragging(true)
        document.body.classList.add('is-dragging')
        maybeCreateAutoDraftRoute(routes, createRouteDraft)
        setDndPayload(event, { kind: 'order', id: order.id })
        setDragImageAsCopy(event, event.currentTarget)
      }}
      onDragEnd={() => {
        dragJustEndedRef.current = true
        setIsDragging(false)
        document.body.classList.remove('is-dragging')
        if (lastDropRouteId && lastDndPayload?.kind === 'order') {
          attachOrderToRoute(lastDropRouteId, lastDndPayload.id)
          onOrderAttachedToRoute?.(lastDropRouteId)
        }
        lastDndPayload = null
        lastDropRouteId = null
        cleanupAutoDraftRouteIfEmpty(deleteRouteDraft)
        requestAnimationFrame(() => {
          dragJustEndedRef.current = false
        })
      }}
    >
      <div className="card__row">
        <div className="card__title">{order.address}</div>
        <div
          className={`sla-pill${slaStatus.isOverdue || isBehindSchedule ? ' sla-pill--overdue' : ''}`}
        >
          {slaStatus.label}
        </div>
      </div>
      <div className="card__order-details">
        <span className="card__order-number">{order.orderNumber}</span>
        <span className="card__order-dot" aria-hidden />
        <span className="card__order-cost">{order.totalRub.toLocaleString('ru-RU', { useGrouping: false })} ₽</span>
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
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  onDelete: (routeId: string) => void
  onDetachCourier: (routeId: string) => void
  onAttachCourier: (routeId: string, courierId: string) => void
  onDetachOrder: (routeId: string, orderId: string) => void
  onAttachOrder: (routeId: string, orderId: string) => void
  onReorderOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  onSend: (routeId: string) => void
}

function RouteDraftCard({
  route,
  couriers,
  orders,
  now,
  orderStageMin,
  routeStageMin,
  onDelete,
  onDetachCourier,
  onDetachOrder,
  onAttachCourier,
  onAttachOrder,
  onReorderOrders,
  onSend,
}: RouteDraftCardProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const selectedCourier = route.courierId ? couriers.find((c) => c.id === route.courierId) : undefined
  const availableCouriers = couriers.filter((courier) => courier.id !== route.courierId)
  const selectedOrderIds = new Set(route.orderIds)
  const availableOrders = Object.values(orders).filter(
    (order) =>
      order.status !== 'enroute' && order.status !== 'handoff' && !order.routeId && !selectedOrderIds.has(order.id),
  )
  const canAttachOrder = route.orderIds.length < 3
  const canSend = route.courierId && route.orderIds.length >= 1 && route.orderIds.length <= 3
  const isFull = route.orderIds.length >= 3

  const canDropPayload = (payload: DndPayload) => {
    if (payload.kind === 'courier') {
      if (route.courierId) return false
      const courier = couriers.find((item) => item.id === payload.id)
      return Boolean(courier)
    }
    if (payload.kind === 'order') {
      if (!canAttachOrder || selectedOrderIds.has(payload.id)) return false
      const order = orders[payload.id]
      return Boolean(order && order.status !== 'enroute' && order.status !== 'handoff' && !order.routeId)
    }
    return false
  }

  const isRouteOrderPayload = (p: DndPayload): p is { kind: 'route-order'; id: string; routeId: string } =>
    p.kind === 'route-order'

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

  const handleDeleteClick = () => {
    if (isExiting) return
    setIsExiting(true)
  }

  const handleExitingAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === 'route-draft-disappear' && isExiting) {
      onDelete(route.id)
    }
  }

  return (
    <div
      className={`card card--route card--route-empty${isExiting ? ' card--route-exiting' : ''}`}
      onDropCapture={handleDrop}
      onDragOver={handleDragOver}
      onDragOverCapture={handleDragOverCapture}
      onDragLeave={handleDragLeave}
      onAnimationEnd={handleExitingAnimationEnd}
    >
      <div className="route-draft__header">
        <div className="route-draft__header-left">
          <div className={`route-draft__placeholder route-draft__placeholder--block route-draft__placeholder--empty`}>
            {route.courierId && selectedCourier ? (
              <>
                <button
                  type="button"
                  className="route-draft__remove route-draft__remove--small"
                  onClick={() => onDetachCourier(route.id)}
                  aria-label="Удалить курьера"
                >
                  <img src={crossIcon} alt="" width={16} height={16} aria-hidden />
                </button>
                <span className="route-draft__courier-name">{selectedCourier.name}</span>
              </>
            ) : (
              <>
                <span className="route-draft__header-icon">
                  <img src={plusIcon} alt="" className="route-draft__plus-icon" width={16} height={16} aria-hidden />
                </span>
                <span className="route-draft__placeholder-text">Выберите курьера</span>
                <select
                  className="route-draft__select"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) {
                      onAttachCourier(route.id, event.target.value)
                    }
                  }}
                >
                  <option value="">Выберите курьера</option>
                  {availableCouriers.map((courier) => {
                    const freeMinutes = Math.max(
                      Math.floor((now - (courier.freeSince ?? now)) / MINUTE_MS),
                      0,
                    )
                    return (
                      <option key={courier.id} value={courier.id}>
                        {courier.name} — {freeMinutes} мин
                      </option>
                    )
                  })}
                </select>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="route-draft__orders">
        {route.orderIds.map((orderId, index) => {
          const order = orders[orderId]
          const slaStatus = order ? getOrderSlaStatus(order, now) : { label: '0', isOverdue: false }
          const riskStatus =
            order && orderStageMin && routeStageMin
              ? getOrderRiskStatus(order, now, orderStageMin, routeStageMin)
              : { isBehindSchedule: false }
          return (
            <Fragment key={orderId}>
              <div
                className={`route-draft__order${
                  slaStatus.isOverdue || riskStatus.isBehindSchedule ? ' route-draft__order--overdue' : ''
                }`}
                draggable
                onDragStart={(e) => {
                  setDndPayload(e, { kind: 'route-order', id: orderId, routeId: route.id })
                  e.dataTransfer.effectAllowed = 'move'
                  setDragImageAsCopy(e, e.currentTarget)
                }}
                onDragOver={(e) => {
                  const payload = parseDndPayload(e)
                  if (payload && isRouteOrderPayload(payload) && payload.routeId === route.id) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    e.stopPropagation()
                  }
                }}
                onDragLeave={() => {}}
                onDrop={(e) => {
                  const payload = parseDndPayload(e)
                  if (payload && isRouteOrderPayload(payload) && payload.routeId === route.id) {
                    e.preventDefault()
                    e.stopPropagation()
                    const fromIndex = route.orderIds.indexOf(payload.id)
                    if (fromIndex !== -1 && fromIndex !== index) {
                      onReorderOrders(route.id, fromIndex, index)
                    }
                  }
                }}
              >
                <div className="route-draft__order-info">
                  <button
                    type="button"
                    className="route-draft__remove route-draft__remove--small"
                    onClick={() => onDetachOrder(route.id, orderId)}
                    aria-label="Удалить заказ"
                  >
                    <img src={crossIcon} alt="" width={16} height={16} aria-hidden />
                  </button>
                  <span className="route-draft__order-title">
                    {order ? order.address : orderId}
                  </span>
                </div>
                <span
                  className={`sla-pill${
                    slaStatus.isOverdue || riskStatus.isBehindSchedule ? ' sla-pill--overdue' : ''
                  }`}
                >
                  {slaStatus.label}
                </span>
              </div>
              {index < route.orderIds.length - 1 ? (() => {
                const aboveRed = slaStatus.isOverdue || riskStatus.isBehindSchedule
                const nextOrderId = route.orderIds[index + 1]
                const nextOrder = orders[nextOrderId]
                const nextSla = nextOrder ? getOrderSlaStatus(nextOrder, now) : { isOverdue: false }
                const nextRisk = nextOrder && orderStageMin && routeStageMin
                  ? getOrderRiskStatus(nextOrder, now, orderStageMin, routeStageMin)
                  : { isBehindSchedule: false }
                const belowRed = nextSla.isOverdue || nextRisk.isBehindSchedule
                const gradientId = `merger-${route.id}-${index}`
                const gray = '#282A2E'
                const red = '#570F27'
                const topColor = aboveRed ? red : gray
                const bottomColor = belowRed ? red : gray
                return (
                  <div className="route-draft__merger" aria-hidden>
                    <svg width={14} height={6} viewBox="0 0 14 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id={gradientId} x1="7" y1="0" x2="7" y2="6" gradientUnits="userSpaceOnUse">
                          <stop stopColor={topColor} />
                          <stop offset={1} stopColor={bottomColor} />
                        </linearGradient>
                      </defs>
                      <path d="M14 0C12.4149 0.080308 10 0.73824 10 3C10 5.26176 12.3431 6 14 6H0C1.65685 6 4 5.26176 4 3C4 0.73824 1.65685 0 0 0H14Z" fill={`url(#${gradientId})`} />
                    </svg>
                  </div>
                )
              })() : null}
            </Fragment>
          )
        })}
        {canAttachOrder ? (
          <div className="route-draft__placeholder route-draft__placeholder--block route-draft__placeholder--empty">
            <img src={plusIcon} alt="" className="route-draft__plus-icon" width={16} height={16} aria-hidden />
            <span className="route-draft__placeholder-text">Добавьте заказы</span>
            <select
              className="route-draft__select"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  onAttachOrder(route.id, event.target.value)
                }
              }}
            >
              <option value="">Добавьте заказы</option>
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
        <button
          type="button"
          className="route-draft__action route-draft__action--primary"
          disabled={!canSend}
          onClick={() => onSend(route.id)}
        >
          Назначить
        </button>
        <button
          type="button"
          className="route-draft__action route-draft__action--icon"
          onClick={handleDeleteClick}
          aria-label="Удалить маршрут"
        >
          <img src={deleteIcon} alt="" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function RouteDeliveryCard({
  route,
  courier,
  orders,
  now,
  orderStageMin,
  routeStageMin,
  onRevertToDraft,
}: {
  route: Route
  courier?: Courier
  orders: Record<string, Order>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  onRevertToDraft?: (routeId: string) => void
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
  const showEditButton = onRevertToDraft && route.step.kind === 'pickup'

  return (
    <div className="card card--delivery">
      {showEditButton ? (
        <button
          type="button"
          className="delivery__edit-btn"
          onClick={() => onRevertToDraft(route.id)}
          aria-label="Редактировать маршрут"
        >
          <img src={editIcon} alt="" width={16} height={16} aria-hidden />
        </button>
      ) : null}
      <div className="card__row">
        {courier ? (
          <img
            src={courierTypeIcons[courier.type]}
            alt=""
            className="card__courier-icon"
            aria-hidden
          />
        ) : null}
        <div className="card__title">{courier?.name ?? '—'}</div>
      </div>
      {headerLabel ? <div className="chip delivery__label">{headerLabel}</div> : null}
      <div className="delivery__orders">
        {route.orderIds.map((orderId, index) => {
          const order = orders[orderId]
          const slaStatus = order ? getOrderSlaStatus(order, now) : { label: '0', isOverdue: false }
          const riskStatus =
            order && orderStageMin && routeStageMin
              ? getOrderRiskStatus(order, now, orderStageMin, routeStageMin)
              : { isBehindSchedule: false }
          const orderLabel =
            order?.status === 'enroute'
              ? formatElapsedLabel('В пути', order.statusStartedAt)
              : order?.status === 'handoff'
                ? formatElapsedLabel('Выдача', order.statusStartedAt)
                : null
          const isLast = index === route.orderIds.length - 1
          let mergerNode: React.ReactNode = null
          if (!isLast) {
            const aboveRed = slaStatus.isOverdue || riskStatus.isBehindSchedule
            const nextOrderId = route.orderIds[index + 1]
            const nextOrder = orders[nextOrderId]
            const nextSla = nextOrder ? getOrderSlaStatus(nextOrder, now) : { isOverdue: false }
            const nextRisk =
              nextOrder && orderStageMin && routeStageMin
                ? getOrderRiskStatus(nextOrder, now, orderStageMin, routeStageMin)
                : { isBehindSchedule: false }
            const belowRed = nextSla.isOverdue || nextRisk.isBehindSchedule
            const gradientId = `delivery-merger-${route.id}-${index}`
            const gray = '#282A2E'
            const red = '#570F27'
            const topColor = aboveRed ? red : gray
            const bottomColor = belowRed ? red : gray
            mergerNode = (
              <div className="delivery__merger" aria-hidden>
                <svg width={14} height={6} viewBox="0 0 14 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id={gradientId} x1="7" y1="0" x2="7" y2="6" gradientUnits="userSpaceOnUse">
                      <stop stopColor={topColor} />
                      <stop offset={1} stopColor={bottomColor} />
                    </linearGradient>
                  </defs>
                  <path d="M14 0C12.4149 0.080308 10 0.73824 10 3C10 5.26176 12.3431 6 14 6H0C1.65685 6 4 5.26176 4 3C4 0.73824 1.65685 0 0 0H14Z" fill={`url(#${gradientId})`} />
                </svg>
              </div>
            )
          }
          return (
            <Fragment key={orderId}>
              <div
                className={`delivery__order${
                  order?.status !== 'delivered' && (slaStatus.isOverdue || riskStatus.isBehindSchedule)
                    ? ' delivery__order--overdue'
                    : ''
                }${order?.status === 'delivered' ? ' delivery__order--delivered' : ''}`}
              >
                <div className="delivery__order-main">
                  <div className="delivery__order-title">
                    {order ? order.address : orderId}
                  </div>
                  {order ? (
                    <div className="card__order-details delivery__order-details">
                      <span className="card__order-number">{order.orderNumber}</span>
                      <span className="card__order-dot" aria-hidden />
                      <span className="card__order-cost">{order.totalRub.toLocaleString('ru-RU', { useGrouping: false })} ₽</span>
                    </div>
                  ) : null}
                  {orderLabel ? <span className="chip delivery__order-label">{orderLabel}</span> : null}
                </div>
                <span
                  className={`sla-pill${
                    slaStatus.isOverdue || riskStatus.isBehindSchedule ? ' sla-pill--overdue' : ''
                  }${order?.status === 'delivered' ? ' sla-pill--done' : ''}`}
                >
                  {order?.status === 'delivered' ? (
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="sla-pill__done-icon" aria-hidden>
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.83 4.49946C11.4433 4.21746 10.9012 4.30237 10.6192 4.68911L7.1748 9.41286L5.43878 7.42883C5.1236 7.06862 4.57609 7.03212 4.21589 7.3473C3.85568 7.66248 3.81918 8.20999 4.13436 8.57019L6.58419 11.37C6.75762 11.5682 7.01176 11.6768 7.27486 11.6651C7.53797 11.6534 7.78148 11.5227 7.93665 11.3099L12.0197 5.7103C12.3017 5.32356 12.2168 4.78145 11.83 4.49946L11.5944 4.82264L11.83 4.49946Z" fill="#03AB00" />
                    </svg>
                  ) : (
                    slaStatus.label
                  )}
                </span>
              </div>
              {mergerNode}
            </Fragment>
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
