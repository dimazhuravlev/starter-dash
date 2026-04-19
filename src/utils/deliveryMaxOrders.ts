import type { CourierType } from '../model/types'

/** Ключ совпадает с экраном настроек «Доставка» */
export const DELIVERY_MAX_ORDERS_STORAGE_KEY = 'deliveryMaxOrdersPerCourier'

export type DeliveryMaxOrdersByType = {
  walk: number
  bike: number
  car: number
}

const FALLBACK: DeliveryMaxOrdersByType = { walk: 3, bike: 3, car: 5 }

function parseKey(p: Record<string, unknown>, key: keyof DeliveryMaxOrdersByType, def: number): number {
  const v = Number(p[key])
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : def
}

/** Читает лимиты заказов в одном маршруте по типу курьера из localStorage */
export function readDeliveryMaxOrdersFromStorage(): DeliveryMaxOrdersByType {
  if (typeof localStorage === 'undefined') return { ...FALLBACK }
  try {
    const raw = localStorage.getItem(DELIVERY_MAX_ORDERS_STORAGE_KEY)
    if (!raw) return { ...FALLBACK }
    const p = JSON.parse(raw) as Record<string, unknown>
    return {
      walk: parseKey(p, 'walk', FALLBACK.walk),
      bike: parseKey(p, 'bike', FALLBACK.bike),
      car: parseKey(p, 'car', FALLBACK.car),
    }
  } catch {
    return { ...FALLBACK }
  }
}

/** Лимит для типа курьера из модели (пеший → walk в настройках) */
export function maxOrdersForCourierType(
  courierType: CourierType,
  limits: DeliveryMaxOrdersByType,
): number {
  const key = courierType === 'pedestrian' ? 'walk' : courierType
  return limits[key]
}
