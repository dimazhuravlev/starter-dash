import { MINUTE_MS } from './rules'
import { type Order } from './types'

export type SlaConfig = {
  orderStageMin: {
    waiting_cook: number
    cooking: number
    ready: number
  }
  routeStageMin: {
    pickup: number
    enroute: number
    handoff: number
    returning: number
  }
}

export type OrderRisk = {
  speedupFactor: number
  deficitMin: number
  plannedRemainingMin: number
  remainingSlaMin: number
}

const getPlannedRemainingMin = (order: Order, now: number, config: SlaConfig) => {
  const { orderStageMin, routeStageMin } = config
  const elapsedMin = Math.max((now - order.statusStartedAt) / MINUTE_MS, 0)

  switch (order.status) {
    case 'waiting_cook': {
      const remaining = Math.max(orderStageMin.waiting_cook - elapsedMin, 0)
      return (
        remaining +
        orderStageMin.cooking +
        orderStageMin.ready +
        routeStageMin.pickup +
        routeStageMin.enroute +
        routeStageMin.handoff
      )
    }
    case 'cooking': {
      const remaining = Math.max(orderStageMin.cooking - elapsedMin, 0)
      return (
        remaining +
        orderStageMin.ready +
        routeStageMin.pickup +
        routeStageMin.enroute +
        routeStageMin.handoff
      )
    }
    case 'ready': {
      const remaining = Math.max(orderStageMin.ready - elapsedMin, 0)
      return remaining + routeStageMin.pickup + routeStageMin.enroute + routeStageMin.handoff
    }
    case 'pickup': {
      const remaining = Math.max(routeStageMin.pickup - elapsedMin, 0)
      return remaining + routeStageMin.enroute + routeStageMin.handoff
    }
    case 'enroute': {
      const remaining = Math.max(routeStageMin.enroute - elapsedMin, 0)
      return remaining + routeStageMin.handoff
    }
    case 'handoff': {
      const remaining = Math.max(routeStageMin.handoff - elapsedMin, 0)
      return remaining
    }
    case 'returning':
    case 'delivered':
      return 0
    default:
      return 0
  }
}

export const computeOrderRisk = (order: Order, now: number, slaConfig: SlaConfig): OrderRisk => {
  const plannedRemainingMin = getPlannedRemainingMin(order, now, slaConfig)
  const elapsedMin = Math.max((now - order.createdAt) / MINUTE_MS, 0)
  const remainingSlaMin = order.slaTotalMin - elapsedMin
  const speedupFactor =
    remainingSlaMin > 0 ? plannedRemainingMin / remainingSlaMin : Number.POSITIVE_INFINITY
  const deficitMin = plannedRemainingMin - remainingSlaMin

  return {
    speedupFactor,
    deficitMin,
    plannedRemainingMin,
    remainingSlaMin,
  }
}
