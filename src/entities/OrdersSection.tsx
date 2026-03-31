import { useEffect, useRef, useState } from 'react'
import { formatAddress } from '../shared/formatAddress'
import { useDashboardStore } from '../store/useDashboardStore'
import { type Order, type Route } from '../model/types'
import { MINUTE_MS, type OrderStageMin, type RouteStageMin } from '../model/rules'
import { computeOrderRisk } from '../model/risk'
import {
  cleanupAutoDraftRouteIfEmpty,
  clearDndState,
  getLastDndPayload,
  getLastDropRouteId,
  maybeCreateAutoDraftRoute,
  setDndPayload,
  setDragImageAsCopy,
} from '../shared/dashboardDnd'

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

/* eslint-disable react-refresh/only-export-components */
export const getOrderSlaStatus = (order: Order, now: number) => {
  const totalMs = order.slaTotalMin * MINUTE_MS
  const elapsedMs = now - order.createdAt
  const remainingMs = totalMs - elapsedMs

  if (remainingMs >= 0) {
    return { label: `${Math.ceil(remainingMs / MINUTE_MS)}`, isOverdue: false }
  }

  const overdueMin = Math.ceil(Math.abs(remainingMs) / MINUTE_MS)
  return { label: `+${overdueMin}`, isOverdue: true }
}

export const getOrderRiskStatus = (
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

function CardOrder({
  order,
  routes,
  now,
  orderStageMin,
  routeStageMin,
  highlightedFromMap,
  onFocusOnMap,
  onOrderAttachedToRoute,
}: {
  order: Order
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedFromMap?: boolean
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
  /** В шаблоне (draft), отправленном или авто-собранном (sent) маршруте — карточка в колонке «Заказы» только с подсветкой, без dnd */
  const isOrderLockedToRoute = Object.values(routes).some(
    (routeItem) =>
      routeItem.orderIds.includes(order.id) &&
      (routeItem.status === 'draft' || routeItem.status === 'sent'),
  )
  const isDraggable =
    order.status !== 'enroute' && order.status !== 'handoff' && !isOrderLockedToRoute

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
      }${isOrderLockedToRoute ? ' card--order-in-route' : ''}${onFocusOnMap ? ' card--focus-on-map' : ''}${
        highlightedFromMap ? ' card--highlighted-from-map' : ''
      }`}
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
        if (getLastDropRouteId() && getLastDndPayload()?.kind === 'order') {
          attachOrderToRoute(getLastDropRouteId()!, getLastDndPayload()!.id)
          onOrderAttachedToRoute?.(getLastDropRouteId()!)
        }
        clearDndState()
        cleanupAutoDraftRouteIfEmpty(deleteRouteDraft)
        requestAnimationFrame(() => {
          dragJustEndedRef.current = false
        })
      }}
    >
      <div className="card__row">
        <div className="card__title">{formatAddress(order.address)}</div>
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

export function OrdersSection({
  title,
  orders,
  routes,
  now,
  orderStageMin,
  routeStageMin,
  highlightedOrderIdFromMap,
  onOrderCardClick,
  onOrderAttachedToRoute,
}: {
  title: string
  orders: Order[]
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedOrderIdFromMap?: string | null
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
            highlightedFromMap={order.id === highlightedOrderIdFromMap}
            onFocusOnMap={onOrderCardClick}
            onOrderAttachedToRoute={onOrderAttachedToRoute}
          />
        ))}
      </div>
    </div>
  )
}
