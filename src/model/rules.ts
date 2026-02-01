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
