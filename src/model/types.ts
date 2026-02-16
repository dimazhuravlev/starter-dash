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

/** Тип курьера: пеший, велокурьер, авто */
export type CourierType = 'pedestrian' | 'bike' | 'car'

export type RouteStatus = 'draft' | 'sent' | 'done'

export type RouteStepKind = 'pickup' | 'enroute' | 'handoff' | 'returning'

export type RouteStep = {
  kind: RouteStepKind
  orderIndex: number
}

export type Order = {
  id: string
  address: string
  /** Номер заказа (для отображения) */
  orderNumber: number
  /** Стоимость заказа в рублях */
  totalRub: number
  coords: { lat: number; lng: number }
  status: OrderStatus
  createdAt: number
  statusStartedAt: number
  etaMin: number
  slaTotalMin: number
  routeId?: string
  courierId?: string
}

export type Courier = {
  id: string
  name: string
  type: CourierType
  status: CourierStatus
  freeSince: number
  routeId?: string
}

export type Route = {
  id: string
  courierId: string
  orderIds: string[]
  createdAt: number
  status: RouteStatus
  step: RouteStep
  returningStartedAt?: number
}
