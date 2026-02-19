import { Fragment, useEffect, useState } from 'react'
import { type Courier, type Order, type Route, type RouteStepKind } from '../model/types'
import { MINUTE_MS, type OrderStageMin, type RouteStageMin } from '../model/rules'
import editIcon from '../assets/Edit.svg'
import walkingCourierIcon from '../assets/Walking courier.svg'
import bikeCourierIcon from '../assets/Bike courier.svg'
import carCourierIcon from '../assets/Car courier 2.svg'
import { getOrderRiskStatus, getOrderSlaStatus } from './OrdersSection'

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

export function RouteDeliveryCard({
  route,
  courier,
  orders,
  now,
  orderStageMin,
  routeStageMin,
  highlightedOrderIdFromMap,
  isJustAppeared,
  onRevertToDraft,
  onRevertAfterExit,
  pendingRevertRouteId,
  onFocusOnMap,
}: {
  route: Route
  courier?: Courier
  orders: Record<string, Order>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedOrderIdFromMap?: string | null
  /** Карточка только что появилась в «Назначенные» после нажатия «Назначить» — проигрывается анимация появления */
  isJustAppeared?: boolean
  onRevertToDraft?: (routeId: string) => void
  /** Вызывается после анимации скрытия при нажатии «Редактировать» — затем вызывается revertRouteToDraft */
  onRevertAfterExit?: (routeId: string) => void
  /** Id маршрута, для которого запущена анимация «редактировать» — карточка скрывается, затем вызывается onRevertAfterExit */
  pendingRevertRouteId?: string | null
  onFocusOnMap?: (routeId: string) => void
}) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (pendingRevertRouteId === route.id) {
      setIsExiting(true)
    }
  }, [pendingRevertRouteId, route.id])

  const handleRevertAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === 'delivery-card-exit' && isExiting) {
      onRevertAfterExit?.(route.id)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.delivery__edit-btn')) return
    onFocusOnMap?.(route.id)
  }
  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onFocusOnMap?.(route.id)
  }
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
    <div
      className={`card card--delivery${onFocusOnMap ? ' card--focus-on-map' : ''}${isJustAppeared ? ' card--delivery-appearing' : ''}${isExiting ? ' card--delivery-exiting' : ''}`}
      role={onFocusOnMap ? 'button' : undefined}
      tabIndex={onFocusOnMap ? 0 : undefined}
      onClick={onFocusOnMap ? handleCardClick : undefined}
      onKeyDown={onFocusOnMap ? handleCardKeyDown : undefined}
      onAnimationEnd={handleRevertAnimationEnd}
    >
      {showEditButton ? (
        <button
          type="button"
          className="delivery__edit-btn"
          onClick={(e) => {
            e.stopPropagation()
            onRevertToDraft(route.id)
          }}
          aria-label="Редактировать маршрут"
        >
          <img src={editIcon} alt="" width={12} height={12} aria-hidden />
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
            const aboveDelivered = order?.status === 'delivered'
            const aboveRed = !aboveDelivered && (slaStatus.isOverdue || riskStatus.isBehindSchedule)
            const nextOrderId = route.orderIds[index + 1]
            const nextOrder = orders[nextOrderId]
            const belowDelivered = nextOrder?.status === 'delivered'
            const nextSla = nextOrder ? getOrderSlaStatus(nextOrder, now) : { isOverdue: false }
            const nextRisk =
              nextOrder && orderStageMin && routeStageMin
                ? getOrderRiskStatus(nextOrder, now, orderStageMin, routeStageMin)
                : { isBehindSchedule: false }
            const belowRed = !belowDelivered && (nextSla.isOverdue || nextRisk.isBehindSchedule)
            const gradientId = `delivery-merger-${route.id}-${index}`
            const gray = '#34373C'
            const red = '#570F27'
            const topColor = aboveDelivered ? gray : aboveRed ? red : gray
            const bottomColor = belowDelivered ? gray : belowRed ? red : gray
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
                }${order?.status === 'delivered' ? ' delivery__order--delivered' : ''}${
                  orderId === highlightedOrderIdFromMap ? ' delivery__order--highlighted-from-map' : ''
                }`}
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
