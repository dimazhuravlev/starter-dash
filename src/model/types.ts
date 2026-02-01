export type OrderStatus =
  | 'waiting_cook'
  | 'cooking'
  | 'ready'
  | 'pickup'
  | 'enroute'
  | 'handoff'
  | 'returning'
  | 'delivered'

export type CourierStatus = 'free' | 'assigned' | 'returning'

export type RouteStatus = 'draft' | 'sent' | 'done'

export type RouteStepKind = 'pickup' | 'enroute' | 'handoff' | 'returning'

export type RouteStep = {
  kind: RouteStepKind
  orderIndex: number
}

export type Order = {
  id: string
  address: string
  status: OrderStatus
  createdAt: number
  statusStartedAt: number
  etaMin: number
  routeId?: string
  courierId?: string
}

export type Courier = {
  id: string
  name: string
  status: CourierStatus
  routeId?: string
}

export type Route = {
  id: string
  courierId: string
  orderIds: string[]
  createdAt: number
  status: RouteStatus
  step: RouteStep
}
