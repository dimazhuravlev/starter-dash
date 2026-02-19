import { useMemo } from 'react'
import { type Courier, type Order, type Route } from '../model/types'
import { type CourierMarkerItem } from '../components/MapboxMap'
import { getOrderRiskStatus, getOrderSlaStatus } from '../entities/OrdersSection'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'

export type OrderMarkerItem = {
  id: string
  lng: number
  lat: number
  address: string
  isOverdue: boolean
  slaLabel: string
  routePosition?: number
  isDelivered: boolean
  isDimmed: boolean
}

export function useDashboardMapData({
  orders,
  routes,
  couriers,
  orderList,
  focusedRouteId,
  now,
  orderStageMin,
  routeStageMin,
  restaurantCoords,
}: {
  orders: Record<string, Order>
  routes: Record<string, Route>
  couriers: Record<string, Courier>
  orderList: Order[]
  focusedRouteId: string | null
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  restaurantCoords: { lat: number; lng: number }
}) {
  const orderIdsInRoute = useMemo(() => {
    const ids: string[] = []
    Object.values(routes).forEach((route) => {
      route.orderIds.forEach((id) => ids.push(id))
    })
    return ids
  }, [routes])

  const orderIdsInAssignedOrActiveRoute = useMemo(() => {
    const ids: string[] = []
    Object.values(routes).forEach((r) => {
      if (r.status === 'sent') r.orderIds.forEach((id) => ids.push(id))
    })
    return ids
  }, [routes])

  const routePathCoords = useMemo((): { lng: number; lat: number }[] | null => {
    if (!focusedRouteId) return null
    const route = routes[focusedRouteId]
    const orderIds = route?.orderIds ?? []
    if (orderIds.length < 1) return null
    const allDelivered = orderIds.every((id) => orders[id]?.status === 'delivered')
    if (allDelivered) return null
    const orderCoords = orderIds
      .map((id) => orders[id]?.coords)
      .filter((c): c is { lat: number; lng: number } => c != null)
    if (orderCoords.length === 0) return null
    const fromRestaurant = [restaurantCoords, ...orderCoords].map((c) => ({ lng: c.lng, lat: c.lat }))
    return fromRestaurant.length >= 2 ? fromRestaurant : null
  }, [focusedRouteId, orders, routes, restaurantCoords])

  const orderMarkers = useMemo(
    () => {
      const routeOrderIds = focusedRouteId ? routes[focusedRouteId]?.orderIds ?? [] : []
      return orderList
        .filter((o) => {
          if (o.status !== 'delivered') return true
          if (!o.routeId) return false
          const route = routes[o.routeId]
          if (!route) return false
          const routeHasNonDelivered = route.orderIds.some((id) => orders[id]?.status !== 'delivered')
          return routeHasNonDelivered
        })
        .map((o) => {
          const isDelivered = o.status === 'delivered'
          const slaStatus = getOrderSlaStatus(o, now)
          const idx = routeOrderIds.indexOf(o.id)
          const routePosition = idx >= 0 ? idx + 1 : undefined
          const inAssignedOrActive = orderIdsInAssignedOrActiveRoute.includes(o.id)
          const inFocusedRoute = routeOrderIds.includes(o.id)
          return {
            id: o.id,
            lng: o.coords.lng,
            lat: o.coords.lat,
            address: o.address,
            isOverdue:
              !isDelivered &&
              (slaStatus.isOverdue ||
                getOrderRiskStatus(o, now, orderStageMin, routeStageMin).isBehindSchedule),
            slaLabel: slaStatus.label,
            routePosition,
            isDelivered,
            isDimmed: inAssignedOrActive && !inFocusedRoute,
          }
        })
    },
    [orderList, now, orderStageMin, routeStageMin, focusedRouteId, routes, orders, orderIdsInAssignedOrActiveRoute],
  )

  const courierMarkers = useMemo<CourierMarkerItem[]>(
    () =>
      Object.values(couriers).map((c) => ({
        id: c.id,
        lng: c.coords.lng,
        lat: c.coords.lat,
        surname: c.name.split(/\s+/)[0] ?? c.name,
        type: c.type,
      })),
    [couriers],
  )

  return {
    orderMarkers,
    courierMarkers,
    routePathCoords,
    orderIdsInRoute,
  }
}
