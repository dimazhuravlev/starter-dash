import { Fragment, useEffect, useRef, useState, type DragEvent } from 'react'
import { type Courier, type Order, type Route } from '../model/types'
import { MINUTE_MS, type OrderStageMin, type RouteStageMin } from '../model/rules'
import crossIcon from '../assets/Cross.svg'
import deleteIcon from '../assets/Delete.svg'
import doneIcon from '../assets/Done.svg'
import plusIcon from '../assets/Plus.svg'
import {
  clearDndPayload,
  getLastDndPayload,
  getLastDropRouteId,
  hasDndPayload,
  parseDndPayload,
  setDndPayload,
  setDragImageAsCopy,
  setLastDropRouteId,
  type DndPayload,
} from '../shared/dashboardDnd'
import { getColorToken } from '../theme'
import { PrimaryButton } from '../shared/ui/PrimaryButton'
import { Tooltip } from '../shared/ui/Tooltip'
import { getOrderRiskStatus, getOrderSlaStatus } from './OrdersSection'

type RouteDraftCardProps = {
  route: Route
  couriers: Courier[]
  orders: Record<string, Order>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedOrderIdFromMap?: string | null
  onDelete: (routeId: string) => void
  onDetachCourier: (routeId: string) => void
  onAttachCourier: (routeId: string, courierId: string) => void
  onDetachOrder: (routeId: string, orderId: string) => void
  onAttachOrder: (routeId: string, orderId: string) => void
  onReorderOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  onSend: (routeId: string) => void
  /** Вызывается после анимации скрытия при назначении маршрута (перед вызовом sendRoute не вызывается) */
  onSendAfterExit?: (routeId: string) => void
  /** Id маршрута, для которого запущена анимация «назначить» — карточка скрывается, затем вызывается onSendAfterExit */
  pendingSendRouteId?: string | null
  /** Показать маршрут на карте при клике по карточке (если в черновике есть заказы) */
  onFocusOnMap?: (routeId: string) => void
  /** Вызывается, когда карточка начинает анимацию скрытия (удаление последней в секции) */
  onExiting?: () => void
  /** Карточка только что появилась в «Новый маршрут» после нажатия «Редактировать» — проигрывается анимация появления */
  isJustAppeared?: boolean
}

export function RouteDraftCard({
  route,
  couriers,
  orders,
  now,
  orderStageMin,
  routeStageMin,
  highlightedOrderIdFromMap,
  isJustAppeared,
  onDelete,
  onDetachCourier,
  onDetachOrder,
  onAttachCourier,
  onAttachOrder,
  onReorderOrders,
  onSend,
  onSendAfterExit,
  pendingSendRouteId,
  onFocusOnMap,
  onExiting,
}: RouteDraftCardProps) {
  const [dragOverKind, setDragOverKind] = useState<'courier' | 'order' | null>(null)
  const [reorderDropIndex, setReorderDropIndex] = useState<number | null>(null)
  const [isExiting, setIsExiting] = useState(false)
  const [hasPlayedEnterAnimation, setHasPlayedEnterAnimation] = useState(false)
  const [hasPlayedDraftAppearAnimation, setHasPlayedDraftAppearAnimation] = useState(false)
  const exitingForSendRef = useRef(false)

  useEffect(() => {
    if (pendingSendRouteId === route.id) {
      exitingForSendRef.current = true
      setIsExiting(true)
      onExiting?.()
    }
  }, [pendingSendRouteId, route.id, onExiting])
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
      setDragOverKind(null)
      return
    }
    setDragOverKind(null)
    setReorderDropIndex(null)
    if (payload.kind === 'courier') {
      onAttachCourier(route.id, payload.id)
    }
    if (payload.kind === 'order') {
      onAttachOrder(route.id, payload.id)
    }
    clearDndPayload()
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDndPayload(event)) return
    const payload = parseDndPayload(event) ?? getLastDndPayload()
    if (!payload || !canDropPayload(payload)) return
    if (payload.kind === 'order' && isFull) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (payload.kind === 'courier' || payload.kind === 'order') {
      setDragOverKind(payload.kind)
    }
    setLastDropRouteId(route.id)
  }

  const handleDragOverCapture = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDndPayload(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    const payload = parseDndPayload(event) ?? getLastDndPayload()
    if (payload && (payload.kind === 'courier' || payload.kind === 'order') && canDropPayload(payload)) {
      if (!(payload.kind === 'order' && isFull)) {
        setDragOverKind(payload.kind)
      }
    }
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return
    }
    setDragOverKind(null)
    setReorderDropIndex(null)
    if (getLastDropRouteId() === route.id) {
      setLastDropRouteId(null)
    }
  }

  const handleDeleteClick = () => {
    if (isExiting) return
    exitingForSendRef.current = false
    setIsExiting(true)
    onExiting?.()
  }

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.animationName === 'route-draft-appear') {
      setHasPlayedEnterAnimation(true)
      return
    }
    if (event.animationName === 'draft-card-enter') {
      setHasPlayedDraftAppearAnimation(true)
      return
    }
    if (event.animationName !== 'route-draft-disappear' || !isExiting) return
    if (exitingForSendRef.current) {
      onSendAfterExit?.(route.id)
    } else {
      onDelete(route.id)
    }
  }

  const canShowRouteOnMap = route.orderIds.length >= 1
  const handleCardClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.route-draft__remove, .route-draft__select, .route-draft__action')) return
    if (canShowRouteOnMap) onFocusOnMap?.(route.id)
  }
  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (canShowRouteOnMap) onFocusOnMap?.(route.id)
  }

  return (
    <div
      className={`card card--route card--route-empty${!hasPlayedEnterAnimation ? ' card--route-appearing' : ''}${isExiting ? ' card--route-exiting' : ''}${isJustAppeared && !hasPlayedDraftAppearAnimation ? ' card--draft-appearing' : ''}${dragOverKind === 'courier' ? ' card--drag-over-courier' : ''}${dragOverKind === 'order' ? ' card--drag-over-order' : ''}${canShowRouteOnMap && onFocusOnMap ? ' card--focus-on-map' : ''}`}
      role={canShowRouteOnMap && onFocusOnMap ? 'button' : undefined}
      tabIndex={canShowRouteOnMap && onFocusOnMap ? 0 : undefined}
      onClick={canShowRouteOnMap && onFocusOnMap ? handleCardClick : undefined}
      onKeyDown={canShowRouteOnMap && onFocusOnMap ? handleCardKeyDown : undefined}
      onDropCapture={handleDrop}
      onDragOver={handleDragOver}
      onDragOverCapture={handleDragOverCapture}
      onDragLeave={handleDragLeave}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="route-draft__header">
        <div className="route-draft__header-left">
          <div className={`route-draft__placeholder route-draft__placeholder--block route-draft__placeholder--empty`}>
            {route.courierId && selectedCourier ? (
              <>
                <Tooltip title="Удалить курьера">
                  <button
                    type="button"
                    className="route-draft__remove route-draft__remove--small"
                    onClick={() => onDetachCourier(route.id)}
                    aria-label="Удалить курьера"
                  >
                    <span className="route-draft__icon" style={{ ['--icon-src' as string]: `url(${crossIcon})` }} aria-hidden />
                  </button>
                </Tooltip>
                <span className="route-draft__courier-name">{selectedCourier.name}</span>
              </>
            ) : (
              <>
                <span className="route-draft__header-icon">
                  <span
                    className="route-draft__plus-icon"
                    style={{ ['--icon-src' as string]: `url(${plusIcon})` }}
                    aria-hidden
                  />
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
                }${orderId === highlightedOrderIdFromMap ? ' route-draft__order--highlighted-from-map' : ''}`}
                draggable
                onDragStart={(e) => {
                  setDndPayload(e, { kind: 'route-order', id: orderId, routeId: route.id })
                  e.dataTransfer.effectAllowed = 'move'
                  setDragImageAsCopy(e, e.currentTarget)
                }}
                onDragOver={(e) => {
                  const payload = parseDndPayload(e) ?? getLastDndPayload()
                  if (payload && isRouteOrderPayload(payload) && payload.routeId === route.id) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    e.stopPropagation()
                    setReorderDropIndex(index)
                  }
                }}
                onDragLeave={() => {}}
                onDrop={(e) => {
                  const payload = parseDndPayload(e)
                  if (payload && isRouteOrderPayload(payload) && payload.routeId === route.id) {
                    e.preventDefault()
                    e.stopPropagation()
                    setReorderDropIndex(null)
                    const fromIndex = route.orderIds.indexOf(payload.id)
                    if (fromIndex !== -1 && fromIndex !== index) {
                      onReorderOrders(route.id, fromIndex, index)
                    }
                  }
                }}
              >
                <div className="route-draft__order-info">
                  <Tooltip title="Удалить заказ">
                    <button
                      type="button"
                      className="route-draft__remove route-draft__remove--small"
                      onClick={() => onDetachOrder(route.id, orderId)}
                      aria-label="Удалить заказ"
                    >
                      <span className="route-draft__icon" style={{ ['--icon-src' as string]: `url(${crossIcon})` }} aria-hidden />
                    </button>
                  </Tooltip>
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
                const red = getColorToken('--danger-surface-strong')
                const topColor = aboveRed ? red : 'var(--merger-gray)'
                const bottomColor = belowRed ? red : 'var(--merger-gray)'
                const isDropTarget = reorderDropIndex === index + 1
                return (
                  <div
                    className={`route-draft__merger${isDropTarget ? ' route-draft__merger--drop-target' : ''}`}
                    aria-hidden
                  >
                    <svg width={14} height={6} viewBox="0 0 14 6" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
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
            <span
              className="route-draft__plus-icon"
              style={{ ['--icon-src' as string]: `url(${plusIcon})` }}
              aria-hidden
            />
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
        <PrimaryButton
          variant="default"
          iconStart={doneIcon}
          disabled={!canSend}
          onClick={() => onSend(route.id)}
        >
          Назначить
        </PrimaryButton>
        <Tooltip title="Удалить маршрут">
          <button
            type="button"
            className="route-draft__action route-draft__action--icon"
            onClick={handleDeleteClick}
            aria-label="Удалить маршрут"
          >
            <span className="route-draft__action-icon" style={{ ['--icon-src' as string]: `url(${deleteIcon})` }} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
