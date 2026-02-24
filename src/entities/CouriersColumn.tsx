import { useMemo } from 'react'
import { type Courier, type Order, type Route } from '../model/types'
import { type RouteStageMin } from '../model/rules'
import { CourierCard } from './CourierCard'

const courierSectionOrder = [
  'Свободные',
  'Возвращаются',
  'Выдают заказ',
  'В пути',
  'Забирают заказ',
] as const

const getCourierSection = (courier: Courier, routes: Record<string, Route>) => {
  if (courier.status === 'free') return 'Свободные'
  if (courier.status === 'returning') return 'Возвращаются'
  const route = courier.routeId ? routes[courier.routeId] : undefined
  if (!route) return 'Свободные'
  if (route.step.kind === 'pickup') return 'Забирают заказ'
  if (route.step.kind === 'enroute') return 'В пути'
  if (route.step.kind === 'handoff') return 'Выдают заказ'
  return 'Возвращаются'
}

export function CouriersColumn({
  couriers,
  routes,
  orders,
  now,
  routeStageMin,
  highlightedCourierIdFromMap,
  onCourierCardClick,
}: {
  couriers: Courier[]
  routes: Record<string, Route>
  orders: Record<string, Order>
  now: number
  routeStageMin: RouteStageMin
  highlightedCourierIdFromMap?: string | null
  onCourierCardClick?: (courierId: string) => void
}) {
  const courierSections = useMemo(() => {
    const grouped = new Map<string, Courier[]>()
    couriers.forEach((courier) => {
      const key = getCourierSection(courier, routes)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(courier)
    })
    return courierSectionOrder
      .map((title) => {
        const list = grouped.get(title) ?? []
        if (title !== 'Свободные') {
          return { title, list }
        }
        const sorted = [...list].sort((a, b) => {
          const aFreeSince = a.freeSince ?? now
          const bFreeSince = b.freeSince ?? now
          return aFreeSince - bFreeSince
        })
        return { title, list: sorted }
      })
      .filter(({ list }) => list.length > 0)
  }, [couriers, routes, now])

  return (
    <>
      {courierSections.map(({ title, list }) => (
        <div key={title} className="section">
          <div className="section__title">{title}</div>
          <div className="section__list">
            {list.map((courier) => (
              <CourierCard
                key={courier.id}
                courier={courier}
                routes={routes}
                orders={orders}
                now={now}
                routeStageMin={routeStageMin}
                highlightedFromMap={courier.id === highlightedCourierIdFromMap}
                onFocusOnMap={onCourierCardClick}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
