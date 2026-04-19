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

/** Пол курьера (только в карточке / форме, не в ячейке таблицы) */
export type CourierGender = 'male' | 'female'

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
  /** Полное имя для таблицы, поиска и совместимости: «Фамилия Имя» */
  name: string
  /** Фамилия (форма курьера) */
  lastName?: string
  /** Имя (форма курьера) */
  firstName?: string
  gender?: CourierGender
  /** Логин в системе (таблица курьеров) */
  login: string
  /** Телефон для отображения */
  phone: string
  type: CourierType
  status: CourierStatus
  freeSince: number
  routeId?: string
  /** Маршрут, который ожидает курьера после возвращения (pre-assign для returning-курьера) */
  nextRouteId?: string
  /** Координаты курьера в рамках города (для отображения на карте) */
  coords: { lat: number; lng: number }
}

/** Как собран маршрут: вручную (Назначить) или автоматически */
export type RouteAssembly = 'manual' | 'auto'

export type Route = {
  id: string
  courierId: string
  orderIds: string[]
  createdAt: number
  status: RouteStatus
  step: RouteStep
  /** Для назначенных маршрутов: ручное или авто-сборка */
  assembly?: RouteAssembly
  returningStartedAt?: number
}

/** Координаты ресторана — точки, из которой доставляются заказы */
export const RESTAURANT_COORDS = { lat: 59.9559111, lng: 30.2985614 } as const

export type Restaurant = {
  id: string
  name: string
  address: string
  pickupMin: number
  handoffMin: number
  routeMode: 'auto' | 'manual'
  timezone?: string
  latitude?: string
  longitude?: string
}
