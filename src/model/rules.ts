export const MINUTE_MS = 60_000

export const ORDER_CREATE_INTERVAL_MIN = 3

export const ORDER_STAGE_MIN = {
  waiting_cook: 1,
  cooking: 10,
  ready: 2,
} as const

export const ROUTE_STAGE_MIN = {
  pickup: 1,
  enroute: 7,
  handoff: 2,
  returning: 5,
} as const

export type OrderStageMin = { [K in keyof typeof ORDER_STAGE_MIN]: number }
export type RouteStageMin = { [K in keyof typeof ROUTE_STAGE_MIN]: number }

export const ORDER_SLA_OPTIONS_MIN = [30, 40, 50] as const
