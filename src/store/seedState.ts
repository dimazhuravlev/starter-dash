import { type Courier, type CourierType, type Route } from '../model/types'
import {
  MINUTE_MS,
  ORDER_CREATE_INTERVAL_MIN,
  ORDER_SLA_OPTIONS_MIN,
  ORDER_STAGE_MIN,
  ROUTE_STAGE_MIN,
} from '../model/rules'
import { createSeedOrders, type DashboardState } from './simulation'
import courierNames from '../data/courierNames.json'

const COURIER_TYPES: CourierType[] = ['pedestrian', 'bike', 'car']

/** Случайные координаты в границах Санкт-Петербурга */
function getRandomCoordsInSpb(): { lat: number; lng: number } {
  return {
    lat: 59.85 + Math.random() * 0.15,
    lng: 30.15 + Math.random() * 0.4,
  }
}

export type DashboardSettings = Pick<
  DashboardState,
  'speed' | 'orderCreateIntervalMin' | 'orderStageMin' | 'orderSlaOptionsMin' | 'routeStageMin'
>

export const resolveSettings = (settings?: Partial<DashboardSettings>): DashboardSettings => ({
  speed: settings?.speed ?? 3,
  orderCreateIntervalMin: settings?.orderCreateIntervalMin ?? ORDER_CREATE_INTERVAL_MIN,
  orderStageMin: {
    ...ORDER_STAGE_MIN,
    ...(settings?.orderStageMin ?? {}),
  },
  orderSlaOptionsMin:
    settings?.orderSlaOptionsMin !== undefined
      ? [...settings.orderSlaOptionsMin]
      : [...ORDER_SLA_OPTIONS_MIN],
  routeStageMin: {
    ...ROUTE_STAGE_MIN,
    ...(settings?.routeStageMin ?? {}),
  },
})

const getRandomFreeSince = (now: number) => now - Math.random() * 9 * MINUTE_MS

export const buildSeedState = (settings?: Partial<DashboardSettings>): DashboardState => {
  const now = Date.now()
  const couriers: Record<string, Courier> = {}
  const resolvedSettings = resolveSettings(settings)

  courierNames.forEach((name, index) => {
    const courierId = `courier_${index + 1}`
    couriers[courierId] = {
      id: courierId,
      name,
      type: COURIER_TYPES[index % COURIER_TYPES.length],
      status: 'free',
      freeSince: getRandomFreeSince(now),
      coords: getRandomCoordsInSpb(),
    }
  })

  const { orders, nextOrderId } = createSeedOrders({
    now,
    nextOrderId: 1,
    orderStageMin: resolvedSettings.orderStageMin,
    orderSlaOptionsMin: resolvedSettings.orderSlaOptionsMin,
    routeStageMin: resolvedSettings.routeStageMin,
  })
  const routes: Record<string, Route> = {}

  return {
    now,
    isRunning: true,
    speed: resolvedSettings.speed,
    orders,
    couriers,
    routes,
    lastOrderCreatedAt: now,
    nextOrderId,
    nextRouteId: 1,
    orderCreateIntervalMin: resolvedSettings.orderCreateIntervalMin,
    orderStageMin: resolvedSettings.orderStageMin,
    orderSlaOptionsMin: resolvedSettings.orderSlaOptionsMin,
    routeStageMin: resolvedSettings.routeStageMin,
  }
}
