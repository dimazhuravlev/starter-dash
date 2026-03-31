import { useRef, useState } from 'react'
import { useDashboardStore } from '../store/useDashboardStore'
import { type Courier, type Order, type Route } from '../model/types'
import { MINUTE_MS, type RouteStageMin } from '../model/rules'
import walkingCourierIcon from '../assets/Walking courier.svg'
import bikeCourierIcon from '../assets/Bike courier.svg'
import carCourierIcon from '../assets/Car courier 2.svg'
import {
  cleanupAutoDraftRouteIfEmpty,
  clearDndState,
  getLastDndPayload,
  getLastDropRouteId,
  maybeCreateAutoDraftRoute,
  setDndPayload,
  setDragImageAsCopy,
} from '../shared/dashboardDnd'

const courierTypeIcons = {
  pedestrian: walkingCourierIcon,
  bike: bikeCourierIcon,
  car: carCourierIcon,
} as const

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

export function CourierCard({
  courier,
  routes,
  orders,
  now,
  routeStageMin,
  highlightedFromMap,
  onFocusOnMap,
}: {
  courier: Courier
  routes: Record<string, Route>
  orders: Record<string, Order>
  now: number
  routeStageMin: RouteStageMin
  highlightedFromMap?: boolean
  onFocusOnMap?: (courierId: string) => void
}) {
  const attachCourierToRoute = useDashboardStore((state) => state.attachCourierToRoute)
  const createRouteDraft = useDashboardStore((state) => state.createRouteDraft)
  const deleteRouteDraft = useDashboardStore((state) => state.deleteRouteDraft)
  const [isDragging, setIsDragging] = useState(false)
  const dragJustEndedRef = useRef(false)
  const route = courier.routeId ? routes[courier.routeId] : undefined
  const remainingMin = getRouteRemainingMin(route, orders, routeStageMin, now)
  const freeMinutes = Math.max(Math.floor((now - (courier.freeSince ?? now)) / MINUTE_MS), 0)
  const label =
    courier.status === 'free'
      ? (freeMinutes === 0 ? 'Только что' : `${freeMinutes} мин`)
      : `Вернётся через ${remainingMin} мин`
  const isAssignedToDraft = Object.values(routes).some(
    (routeItem) => routeItem.status === 'draft' && routeItem.courierId === courier.id,
  )
  const isDraggable = !isAssignedToDraft

  const handleFocusOnMap = () => {
    if (isDragging || dragJustEndedRef.current || !onFocusOnMap) return
    onFocusOnMap(courier.id)
  }

  return (
    <div
      className={`card card--courier${isDraggable ? ' card--draggable' : ''}${
        isDragging ? ' card--dragging' : ''
      }${onFocusOnMap ? ' card--focus-on-map' : ''}${
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
        setDndPayload(event, { kind: 'courier', id: courier.id })
        setDragImageAsCopy(event, event.currentTarget)
      }}
      onDragEnd={() => {
        dragJustEndedRef.current = true
        setIsDragging(false)
        document.body.classList.remove('is-dragging')
        if (getLastDropRouteId() && getLastDndPayload()?.kind === 'courier') {
          attachCourierToRoute(getLastDropRouteId()!, getLastDndPayload()!.id)
        }
        clearDndState()
        cleanupAutoDraftRouteIfEmpty(deleteRouteDraft)
        window.setTimeout(() => {
          dragJustEndedRef.current = false
        })
      }}
    >
      <div className="card__row">
        <span
          className="card__courier-icon"
          style={{ ['--icon-src' as string]: `url("${courierTypeIcons[courier.type]}")` }}
          aria-hidden
        />
        <div className="card__title">{courier.name}</div>
      </div>
      <div className="chip chip--ghost">{label}</div>
    </div>
  )
}
