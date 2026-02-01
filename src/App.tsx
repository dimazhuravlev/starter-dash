import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { useDashboardStore } from './store/useDashboardStore'
import {
  type Courier,
  type CourierStatus,
  type Order,
  type OrderStatus,
  type Route,
  type RouteStatus,
  type RouteStepKind,
} from './model/types'

const orderStatuses: OrderStatus[] = [
  'waiting_cook',
  'cooking',
  'ready',
  'pickup',
  'enroute',
  'handoff',
  'returning',
  'delivered',
]

const courierStatuses: CourierStatus[] = ['free', 'assigned', 'returning']

const routeStatuses: RouteStatus[] = ['draft', 'sent', 'done']

const shortId = (id: string) => id.replace(/^(order|route|courier)_/, '').slice(0, 6)

const statusLabel: Record<OrderStatus, string> = {
  waiting_cook: 'Ожидает готовки',
  cooking: 'Готовится',
  ready: 'Готов',
  pickup: 'Получение',
  enroute: 'В пути',
  handoff: 'Выдача',
  returning: 'Возврат',
  delivered: 'Доставлен',
}

const routeStepLabel: Record<RouteStepKind, string> = {
  pickup: 'Забирают заказ',
  enroute: 'К клиенту',
  handoff: 'Выдают заказ',
  returning: 'Возвращаются',
}

const tabItems = ['Заказы', 'Смены', 'Курьеры', 'Статистика']

const getEtaTone = (etaMin: number) => {
  if (etaMin <= 2) return 'good'
  if (etaMin >= 8) return 'bad'
  return 'warn'
}

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

function App() {
  const now = useDashboardStore((state) => state.now)
  const isRunning = useDashboardStore((state) => state.isRunning)
  const speed = useDashboardStore((state) => state.speed)
  const orders = useDashboardStore((state) => state.orders)
  const couriers = useDashboardStore((state) => state.couriers)
  const routes = useDashboardStore((state) => state.routes)
  const tick = useDashboardStore((state) => state.tick)
  const toggleRun = useDashboardStore((state) => state.toggleRun)
  const setSpeed = useDashboardStore((state) => state.setSpeed)
  const resetSeed = useDashboardStore((state) => state.resetSeed)
  const createRouteDraft = useDashboardStore((state) => state.createRouteDraft)
  const attachCourierToRoute = useDashboardStore((state) => state.attachCourierToRoute)
  const attachOrderToRoute = useDashboardStore((state) => state.attachOrderToRoute)
  const sendRoute = useDashboardStore((state) => state.sendRoute)

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

  const orderStats = useMemo(() => {
    const stats: Record<OrderStatus, number> = {
      waiting_cook: 0,
      cooking: 0,
      ready: 0,
      pickup: 0,
      enroute: 0,
      handoff: 0,
      returning: 0,
      delivered: 0,
    }
    Object.values(orders).forEach((order) => {
      stats[order.status] += 1
    })
    return stats
  }, [orders])

  const courierStats = useMemo(() => {
    const stats: Record<CourierStatus, number> = {
      free: 0,
      assigned: 0,
      returning: 0,
    }
    Object.values(couriers).forEach((courier) => {
      stats[courier.status] += 1
    })
    return stats
  }, [couriers])

  const routeStats = useMemo(() => {
    const stats: Record<RouteStatus, number> = {
      draft: 0,
      sent: 0,
      done: 0,
    }
    Object.values(routes).forEach((route) => {
      stats[route.status] += 1
    })
    return stats
  }, [routes])

  const newestOrders = useMemo(() => {
    return Object.values(orders)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
  }, [orders])

  const routeList = useMemo(() => Object.values(routes), [routes])

  const isDebug = screen === 'debug'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__tabs">
          {tabItems.map((label) => (
            <button key={label} type="button" className="tab">
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
            attachCourierToRoute={attachCourierToRoute}
            attachOrderToRoute={attachOrderToRoute}
            sendRoute={sendRoute}
          />
        ) : (
          <DebugPanelScreen
            now={now}
            isRunning={isRunning}
            speed={speed}
            orders={orders}
            routes={routes}
            couriers={couriers}
            orderStats={orderStats}
            courierStats={courierStats}
            routeStats={routeStats}
            newestOrders={newestOrders}
            routeList={routeList}
            toggleRun={toggleRun}
            setSpeed={setSpeed}
            tick={tick}
            resetSeed={resetSeed}
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
  attachCourierToRoute: (routeId: string, courierId: string) => void
  attachOrderToRoute: (routeId: string, orderId: string) => void
  sendRoute: (routeId: string) => void
}

function DashboardScreen({
  orders,
  couriers,
  routes,
  createRouteDraft,
  attachCourierToRoute,
  attachOrderToRoute,
  sendRoute,
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

  const courierSections = useMemo(() => {
    const grouped = new Map<string, Courier[]>()
    courierList.forEach((courier) => {
      const key = getCourierSection(courier, routes)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(courier)
    })
    return grouped
  }, [courierList, routes])

  return (
    <div className="dashboard">
      <section className="dashboard__column">
        <div className="column__title">Курьеры</div>
        {Array.from(courierSections.entries()).map(([title, list]) => (
          <div key={title} className="section">
            <div className="section__title">{title}</div>
            <div className="section__list">
              {list.map((courier) => (
                <CardCourier key={courier.id} courier={courier} routes={routes} orders={orders} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="dashboard__column">
        <div className="column__title">Заказы</div>
        <OrdersSection title="Ожидают готовки" orders={ordersWaiting} />
        <OrdersSection title="Готовятся" orders={ordersCooking} />
        <OrdersSection title="Готовы" orders={ordersReady} />
      </section>

      <section className="dashboard__column">
        <div className="column__title">Назначения</div>
        <button type="button" className="primary-button" onClick={createRouteDraft}>
          Новый маршрут +
        </button>
        <div className="section__list">
          {draftRoutes.length === 0 ? (
            <div className="empty-state">Нет черновиков маршрутов.</div>
          ) : (
            draftRoutes.map((route) => (
              <RouteDraftCard
                key={route.id}
                route={route}
                couriers={courierList}
                orders={orders}
                onAttachCourier={attachCourierToRoute}
                onAttachOrder={attachOrderToRoute}
                onSend={sendRoute}
              />
            ))
          )}
        </div>
      </section>

      <section className="dashboard__column">
        <div className="column__title">Доставка</div>
        <div className="section__list">
          {sentRoutes.length === 0 ? (
            <div className="empty-state">Активных маршрутов пока нет.</div>
          ) : (
            sentRoutes.map((route) => (
              <RouteDeliveryCard
                key={route.id}
                route={route}
                courier={couriers[route.courierId]}
                orders={orders}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function OrdersSection({ title, orders }: { title: string; orders: Order[] }) {
  return (
    <div className="section">
      <div className="section__title">{title}</div>
      <div className="section__list">
        {orders.length === 0 ? (
          <div className="empty-state">Нет заказов</div>
        ) : (
          orders.map((order) => <CardOrder key={order.id} order={order} />)
        )}
      </div>
    </div>
  )
}

function CardCourier({
  courier,
  routes,
  orders,
}: {
  courier: Courier
  routes: Record<string, Route>
  orders: Record<string, Order>
}) {
  const route = courier.routeId ? routes[courier.routeId] : undefined
  const currentOrder =
    route && route.orderIds.length > 0 ? orders[route.orderIds[route.step.orderIndex]] : undefined
  const label =
    courier.status === 'free'
      ? 'Свободен'
      : route?.step.kind === 'returning'
        ? `Вернется через ${currentOrder?.etaMin ?? 0} мин`
        : `${currentOrder?.etaMin ?? 0} мин`

  return (
    <div className="card card--courier">
      <div className="card__row">
        <div className="card__title">{courier.name}</div>
        <div className="card__meta">i</div>
      </div>
      <div className="chip chip--ghost">{label}</div>
    </div>
  )
}

function CardOrder({ order }: { order: Order }) {
  return (
    <div className="card card--order">
      <div className="card__title">{order.address}</div>
      <div className={`chip chip--${getEtaTone(order.etaMin)}`}>{order.etaMin} мин</div>
    </div>
  )
}

type RouteDraftCardProps = {
  route: Route
  couriers: Courier[]
  orders: Record<string, Order>
  onAttachCourier: (routeId: string, courierId: string) => void
  onAttachOrder: (routeId: string, orderId: string) => void
  onSend: (routeId: string) => void
}

function RouteDraftCard({
  route,
  couriers,
  orders,
  onAttachCourier,
  onAttachOrder,
  onSend,
}: RouteDraftCardProps) {
  const [selectedCourierId, setSelectedCourierId] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')

  const availableCouriers = couriers.filter((courier) => courier.status === 'free')
  const availableOrders = Object.values(orders).filter(
    (order) => order.status === 'ready' && !order.routeId,
  )

  const canAttachOrder = route.orderIds.length < 3
  const canSend = route.courierId && route.orderIds.length >= 1 && route.orderIds.length <= 3

  return (
    <div className="card card--route">
      <div className="route-draft__row">
        <div className="route-draft__label">Курьер</div>
        {route.courierId ? (
          <div className="route-draft__value">
            {couriers.find((courier) => courier.id === route.courierId)?.name ?? '—'}
          </div>
        ) : (
          <div className="route-draft__control">
            <select
              className="select"
              value={selectedCourierId}
              onChange={(event) => setSelectedCourierId(event.target.value)}
            >
              <option value="">Курьер +</option>
              {availableCouriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              disabled={!selectedCourierId}
              onClick={() => {
                onAttachCourier(route.id, selectedCourierId)
                setSelectedCourierId('')
              }}
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="route-draft__row">
        <div className="route-draft__label">Заказы</div>
        <div className="route-draft__list">
          {route.orderIds.map((orderId) => {
            const order = orders[orderId]
            return (
              <div key={orderId} className="route-draft__order">
                <span>{order?.address ?? orderId}</span>
                <span className="chip chip--ghost">{order?.etaMin ?? 0}</span>
              </div>
            )
          })}
        </div>
        {canAttachOrder ? (
          <div className="route-draft__control">
            <select
              className="select"
              value={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
            >
              <option value="">Заказ +</option>
              {availableOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.address}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button"
              disabled={!selectedOrderId}
              onClick={() => {
                onAttachOrder(route.id, selectedOrderId)
                setSelectedOrderId('')
              }}
            >
              +
            </button>
          </div>
        ) : null}
      </div>

      <div className="route-draft__footer">
        <button type="button" className="ghost-button" disabled={!canSend} onClick={() => onSend(route.id)}>
          Отправить
        </button>
      </div>
    </div>
  )
}

function RouteDeliveryCard({
  route,
  courier,
  orders,
}: {
  route: Route
  courier?: Courier
  orders: Record<string, Order>
}) {
  const currentOrderId = route.orderIds[route.step.orderIndex]
  const currentOrder = currentOrderId ? orders[currentOrderId] : undefined
  return (
    <div className="card card--delivery">
      <div className="card__row">
        <div className="card__title">{courier?.name ?? '—'}</div>
        <div className="card__meta">i</div>
      </div>
      <div className="delivery__step">
        {routeStepLabel[route.step.kind]}
        {currentOrder ? ` через ${currentOrder.etaMin} мин` : ''}
      </div>
      <div className="delivery__orders">
        {route.orderIds.map((orderId, index) => {
          const order = orders[orderId]
          return (
            <div
              key={orderId}
              className={index === route.step.orderIndex ? 'delivery__order delivery__order--active' : 'delivery__order'}
            >
              <span>{order?.address ?? orderId}</span>
              <span className="chip chip--ghost">{order?.etaMin ?? 0}</span>
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
  speed: 1 | 5 | 20
  orders: Record<string, Order>
  routes: Record<string, Route>
  couriers: Record<string, Courier>
  orderStats: Record<OrderStatus, number>
  courierStats: Record<CourierStatus, number>
  routeStats: Record<RouteStatus, number>
  newestOrders: Order[]
  routeList: Route[]
  toggleRun: () => void
  setSpeed: (speed: 1 | 5 | 20) => void
  tick: (deltaMs: number) => void
  resetSeed: () => void
}

function DebugPanelScreen({
  now,
  isRunning,
  speed,
  orders,
  routes,
  couriers,
  orderStats,
  courierStats,
  routeStats,
  newestOrders,
  routeList,
  toggleRun,
  setSpeed,
  tick,
  resetSeed,
}: DebugPanelScreenProps) {
  return (
    <div className="debug">
      <header className="debug__header">
        <div>
          <p className="debug__eyebrow">Dispatcher Simulation</p>
          <h1>Debug Panel</h1>
        </div>
        <div className="debug__clock">{new Date(now).toLocaleTimeString()}</div>
      </header>

      <section className="debug__controls">
        <button type="button" className="btn" onClick={toggleRun}>
          {isRunning ? 'Pause' : 'Play'}
        </button>
        <div className="btn-group">
          {[1, 5, 20].map((value) => (
            <button
              key={value}
              type="button"
              className={value === speed ? 'btn btn--active' : 'btn btn--ghost'}
              onClick={() => setSpeed(value as 1 | 5 | 20)}
            >
              x{value}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => tick(60_000)}>
          Tick +1min
        </button>
        <button type="button" className="btn btn--ghost" onClick={resetSeed}>
          Reset seed
        </button>
      </section>

      <section className="debug__grid">
        <div className="panel">
          <h2>Orders</h2>
          <div className="panel__summary">
            <span>Total: {Object.keys(orders).length}</span>
          </div>
          <ul className="panel__list">
            {orderStatuses.map((status) => (
              <li key={status}>
                <span>{statusLabel[status]}</span>
                <strong>{orderStats[status]}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>Routes</h2>
          <div className="panel__summary">
            <span>Total: {Object.keys(routes).length}</span>
          </div>
          <ul className="panel__list">
            {routeStatuses.map((status) => (
              <li key={status}>
                <span>{status}</span>
                <strong>{routeStats[status]}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>Couriers</h2>
          <div className="panel__summary">
            <span>Total: {Object.keys(couriers).length}</span>
          </div>
          <ul className="panel__list">
            {courierStatuses.map((status) => (
              <li key={status}>
                <span>{status}</span>
                <strong>{courierStats[status]}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="debug__grid debug__grid--wide">
        <div className="panel">
          <h2>Newest orders</h2>
          <div className="panel__summary">Latest 10 by creation time</div>
          <div className="table">
            <div className="table__row table__row--head">
              <span>ID</span>
              <span>Status</span>
              <span>ETA</span>
              <span>Route</span>
            </div>
            {newestOrders.length === 0 ? (
              <div className="table__empty">Orders will appear every 3 minutes.</div>
            ) : (
              newestOrders.map((order) => (
                <div key={order.id} className="table__row">
                  <span>{shortId(order.id)}</span>
                  <span>{statusLabel[order.status]}</span>
                  <span>{order.etaMin} мин</span>
                  <span>{order.routeId ? shortId(order.routeId) : '—'}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <h2>Routes</h2>
          <div className="panel__summary">Draft and active routes</div>
          <div className="table">
            <div className="table__row table__row--head">
              <span>ID</span>
              <span>Status</span>
              <span>Courier</span>
              <span>Orders</span>
              <span>Step</span>
            </div>
            {routeList.length === 0 ? (
              <div className="table__empty">No routes yet.</div>
            ) : (
              routeList.map((route) => {
                const courier = route.courierId ? couriers[route.courierId] : undefined
                return (
                  <div key={route.id} className="table__row">
                    <span>{shortId(route.id)}</span>
                    <span>{route.status}</span>
                    <span>{courier ? courier.name : '—'}</span>
                    <span>
                      {route.orderIds.length === 0
                        ? '—'
                        : route.orderIds.map((id) => shortId(id)).join(', ')}
                    </span>
                    <span>
                      {route.step.kind} #{route.step.orderIndex + 1}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
