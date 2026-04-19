import {
  type Courier,
  type CourierGender,
  type CourierType,
  type Route,
  RESTAURANT_COORDS,
} from '../model/types'
import {
  MINUTE_MS,
  ORDER_CREATE_INTERVAL_MIN,
  ORDER_SLA_OPTIONS_MIN,
  ORDER_STAGE_MIN,
  ROUTE_STAGE_MIN,
} from '../model/rules'
import { translitToLatinCompact } from '../utils/translitLogin'
import { createSeedOrders, type DashboardState } from './simulation'
import courierNames from '../data/courierNames.json'

const COURIER_TYPES: CourierType[] = ['pedestrian', 'bike', 'car']

function splitDisplayName(full: string): { lastName: string; firstName: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { lastName: parts[0] ?? '', firstName: '' }
  }
  return { lastName: parts[0]!, firstName: parts.slice(1).join(' ') }
}

function seedPhone(index: number): string {
  const n = 700 + index * 111
  const s = String(n).padStart(4, '0')
  return `+7 960 349 ${s.slice(0, 2)}${s.slice(2)}`
}

/** Координаты свободного курьера в районе ресторана — разные для каждого, чтобы маркеры не накладывались */
function getFreeCourierCoordsNearRestaurant(index: number, total: number): { lat: number; lng: number } {
  const radiusDeg = 0.00072 // ~80 м от ресторана
  const angle = (index / total) * 2 * Math.PI
  const jitter = 0.0003 // небольшой разброс
  return {
    lat: RESTAURANT_COORDS.lat + radiusDeg * Math.cos(angle) + (Math.random() - 0.5) * jitter,
    lng: RESTAURANT_COORDS.lng + radiusDeg * Math.sin(angle) + (Math.random() - 0.5) * jitter,
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

  const courierCount = courierNames.length
  courierNames.forEach((name, index) => {
    const courierId = `courier_${index + 1}`
    const { lastName, firstName } = splitDisplayName(name)
    const gender: CourierGender = index % 2 === 0 ? 'male' : 'female'
    couriers[courierId] = {
      id: courierId,
      name,
      lastName,
      firstName,
      gender,
      login: translitToLatinCompact(name) || `courier${index + 1}`,
      phone: seedPhone(index),
      type: COURIER_TYPES[index % COURIER_TYPES.length],
      status: 'free',
      freeSince: getRandomFreeSince(now),
      coords: getFreeCourierCoordsNearRestaurant(index, courierCount),
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
    routeMode: 'manual',
    isEditingAutoRoutes: false,
    autoEditSessionBaseline: null,
  }
}
