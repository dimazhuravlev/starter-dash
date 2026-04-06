import { useRef, useState } from 'react'
import { useDashboardStore } from '../store/useDashboardStore'
import { type Courier, type Order, type Route } from '../model/types'
import { MINUTE_MS, type OrderStageMin, type RouteStageMin } from '../model/rules'
import { ModeSelectorSection } from './ModeSelectorSection'
import { RouteDeliveryCard } from './RouteDeliveryCard'
import { RouteDraftCard } from './RouteDraftCard'

export type RoutesColumnProps = {
  routeMode: 'auto' | 'manual'
  onRouteModeChange: (mode: 'auto' | 'manual') => void
  draftRoutes: Route[]
  /** Отправленные pickup, пока заказы готовятся — в «Собрать маршрут» */
  sentPickupAwaitingKitchen: Route[]
  draftSectionExiting: boolean
  setDraftSectionExiting: (value: boolean) => void
  courierList: Courier[]
  couriers: Record<string, Courier>
  orders: Record<string, Order>
  routes: Record<string, Route>
  now: number
  orderStageMin: OrderStageMin
  routeStageMin: RouteStageMin
  highlightedOrderIdFromMap: string | null
  recentlyRevertedToDraftRouteIds: string[]
  nextRevertedDraftId: string | null
  recentlySentRouteIds: string[]
  pendingSendRouteId: string | null
  pendingRevertRouteId: string | null
  onResetDraftTemplate: (routeId: string) => void
  detachCourierFromRoute: (routeId: string) => void
  detachOrderFromRoute: (routeId: string, orderId: string) => void
  attachCourierToRoute: (routeId: string, courierId: string) => void
  attachOrderToRoute: (routeId: string, orderId: string) => void
  reorderRouteOrders: (routeId: string, fromIndex: number, toIndex: number) => void
  focusMapOnRoute: (routeId: string) => void
  onSendRouteClick: (routeId: string) => void
  onSendAfterExit: (routeId: string) => void
  onRevertClick: (routeId: string) => void
  onRevertAfterExit: (routeId: string) => void
  /** Ручной режим: после «Назначить» (ручная сборка, pickup) */
  manualAssignedRoutes: Route[]
  /** Авторежим: только pickup (без шаблонов-черновиков) */
  autoAssembledRoutes: Route[]
  /** Авторежим: маршруты, собранные вручную в ручном режиме */
  manualAssembledInAutoRoutes: Route[]
  /** Одноразовый металлический блик на карточках авторежима */
  autoTemplateShimmerRouteIds: string[]
  onAutoTemplateShimmerEnd: (routeId: string) => void
}

export function RoutesColumn({
  routeMode,
  onRouteModeChange,
  draftRoutes,
  sentPickupAwaitingKitchen,
  draftSectionExiting,
  setDraftSectionExiting,
  manualAssignedRoutes,
  autoAssembledRoutes,
  manualAssembledInAutoRoutes,
  autoTemplateShimmerRouteIds,
  onAutoTemplateShimmerEnd,
  courierList,
  couriers,
  orders,
  routes,
  now,
  orderStageMin,
  routeStageMin,
  highlightedOrderIdFromMap,
  recentlyRevertedToDraftRouteIds,
  nextRevertedDraftId,
  recentlySentRouteIds,
  pendingSendRouteId,
  pendingRevertRouteId,
  onResetDraftTemplate,
  detachCourierFromRoute,
  detachOrderFromRoute,
  attachCourierToRoute,
  attachOrderToRoute,
  reorderRouteOrders,
  focusMapOnRoute,
  onSendRouteClick,
  onSendAfterExit,
  onRevertClick,
  onRevertAfterExit,
}: RoutesColumnProps) {
  const isEditingAutoRoutes = useDashboardStore((s) => s.isEditingAutoRoutes)
  const startEditingAutoRoutes = useDashboardStore((s) => s.startEditingAutoRoutes)
  const cancelEditingAutoRoutes = useDashboardStore((s) => s.cancelEditingAutoRoutes)
  const saveEditedAutoRoutes = useDashboardStore((s) => s.saveEditedAutoRoutes)
  const editSentRouteDetachCourier = useDashboardStore((s) => s.editSentRouteDetachCourier)
  const editSentRouteAttachCourier = useDashboardStore((s) => s.editSentRouteAttachCourier)
  const editSentRouteDetachOrder = useDashboardStore((s) => s.editSentRouteDetachOrder)
  const editSentRouteAttachOrder = useDashboardStore((s) => s.editSentRouteAttachOrder)
  const editSentRouteReorderOrders = useDashboardStore((s) => s.editSentRouteReorderOrders)

  const [returnedFromEditIds, setReturnedFromEditIds] = useState<string[]>([])
  const modifiedRouteIdsRef = useRef<Set<string>>(new Set())

  const trackEdit = (routeId: string) => { modifiedRouteIdsRef.current.add(routeId) }

  const handleStartEditing = () => {
    modifiedRouteIdsRef.current = new Set()
    startEditingAutoRoutes()
  }
  const handleSaveEditing = () => {
    const allIds = [...autoAssembledRoutes, ...manualAssembledInAutoRoutes].map((r) => r.id)
    saveEditedAutoRoutes(allIds, [...modifiedRouteIdsRef.current])
    modifiedRouteIdsRef.current = new Set()
    setReturnedFromEditIds(allIds)
    window.setTimeout(() => setReturnedFromEditIds([]), 520)
  }
  const handleCancelEditing = () => {
    modifiedRouteIdsRef.current = new Set()
    const ids = [...autoAssembledRoutes, ...manualAssembledInAutoRoutes].map((r) => r.id)
    setReturnedFromEditIds(ids)
    cancelEditingAutoRoutes()
    window.setTimeout(() => setReturnedFromEditIds([]), 520)
  }

  const routesHeaderCount =
    routeMode === 'manual'
      ? manualAssignedRoutes.length
      : autoAssembledRoutes.length + manualAssembledInAutoRoutes.length
  const manualTemplateCardCount = draftRoutes.length + sentPickupAwaitingKitchen.length

  const getCourierReturnMin = (route: Route): number => {
    const courier = couriers[route.courierId]
    if (!courier || courier.status !== 'returning') return 0
    const courierRoute = courier.routeId ? routes[courier.routeId] : undefined
    if (!courierRoute?.returningStartedAt) return 0
    const remainingMs = Math.max(
      routeStageMin.returning * MINUTE_MS - (now - courierRoute.returningStartedAt),
      0,
    )
    return Math.ceil(remainingMs / MINUTE_MS)
  }

  const deliveryCardProps = (route: Route, showRevert: boolean) => ({
    route,
    courier: couriers[route.courierId],
    courierReturnMin: getCourierReturnMin(route),
    orders,
    now,
    orderStageMin,
    routeStageMin,
    highlightedOrderIdFromMap,
    isJustAppeared: recentlySentRouteIds.includes(route.id) || returnedFromEditIds.includes(route.id),
    canEditRoute: showRevert,
    onRevertToDraft: showRevert ? onRevertClick : undefined,
    onRevertAfterExit: showRevert ? onRevertAfterExit : undefined,
    pendingRevertRouteId: showRevert ? pendingRevertRouteId : undefined,
    onFocusOnMap: focusMapOnRoute,
    playAutoTemplateShimmer: !showRevert && autoTemplateShimmerRouteIds.includes(route.id),
    onAutoTemplateShimmerEnd: !showRevert ? onAutoTemplateShimmerEnd : undefined,
  })

  const draftCardProps = (route: Route, templateCount: number) => ({
    route,
    couriers: courierList,
    orders,
    now,
    orderStageMin,
    routeStageMin,
    highlightedOrderIdFromMap,
    isJustAppeared: recentlyRevertedToDraftRouteIds.includes(route.id) || nextRevertedDraftId === route.id,
    onClearDraftContent: onResetDraftTemplate,
    onDetachCourier: detachCourierFromRoute,
    onAttachCourier: attachCourierToRoute,
    onDetachOrder: detachOrderFromRoute,
    onAttachOrder: (rid: string, oid: string) => {
      attachOrderToRoute(rid, oid)
      focusMapOnRoute(rid)
    },
    onReorderOrders: reorderRouteOrders,
    onMoveOrderHere: (fromRouteId: string, orderId: string) => {
      detachOrderFromRoute(fromRouteId, orderId)
      attachOrderToRoute(route.id, orderId)
      focusMapOnRoute(route.id)
    },
    onMoveCourierHere: (fromRouteId: string, courierId: string) => {
      detachCourierFromRoute(fromRouteId)
      attachCourierToRoute(route.id, courierId)
    },
    onSend: onSendRouteClick,
    onSendAfterExit: onSendAfterExit,
    pendingSendRouteId,
    onFocusOnMap: focusMapOnRoute,
    onExiting: templateCount === 1 ? () => setDraftSectionExiting(true) : undefined,
  })

  return (
    <section className="dashboard__column">
      <ModeSelectorSection
        routesCount={routesHeaderCount}
        routeMode={routeMode}
        isEditing={isEditingAutoRoutes}
        onStartEditing={handleStartEditing}
        onSave={handleSaveEditing}
        onCancelEditing={handleCancelEditing}
        onRouteModeChange={onRouteModeChange}
      />
      {routeMode === 'manual' ? (
        <>
          {(manualTemplateCardCount > 0 || draftSectionExiting) ? (
            <div
              className={`section${draftSectionExiting ? ' section--route-exiting' : ''}`}
              onAnimationEnd={(e) => {
                if (e.animationName === 'route-draft-disappear') setDraftSectionExiting(false)
              }}
            >
              <div className="section__title">Собрать маршрут</div>
              <div className="section__list">
                {draftRoutes.map((route) => (
                  <RouteDraftCard key={route.id} {...draftCardProps(route, manualTemplateCardCount)} />
                ))}
                {sentPickupAwaitingKitchen.map((route) => (
                  <RouteDeliveryCard key={route.id} {...deliveryCardProps(route, true)} />
                ))}
              </div>
            </div>
          ) : null}
          {manualAssignedRoutes.length > 0 ? (
            <div className="section">
              <div className="section__title">Назначенные</div>
              <div className="section__list">
                {manualAssignedRoutes.map((route) => (
                  <RouteDeliveryCard key={route.id} {...deliveryCardProps(route, true)} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : isEditingAutoRoutes ? (
        <>
          {(autoAssembledRoutes.length > 0 || manualAssembledInAutoRoutes.length > 0) ? (
            <div className="section">
              <div className="section__title">Изменить маршруты</div>
              <div className="section__list">
                {[...autoAssembledRoutes, ...manualAssembledInAutoRoutes].map((route) => (
                  <RouteDraftCard
                    key={route.id}
                    route={route}
                    couriers={courierList}
                    orders={orders}
                    now={now}
                    orderStageMin={orderStageMin}
                    routeStageMin={routeStageMin}
                    highlightedOrderIdFromMap={highlightedOrderIdFromMap}
                    onClearDraftContent={() => {}}
                    onDetachCourier={(rid) => { trackEdit(rid); editSentRouteDetachCourier(rid) }}
                    onAttachCourier={(rid, cid) => { trackEdit(rid); editSentRouteAttachCourier(rid, cid) }}
                    onDetachOrder={(rid, oid) => { trackEdit(rid); editSentRouteDetachOrder(rid, oid) }}
                    onAttachOrder={(rid, oid) => { trackEdit(rid); editSentRouteAttachOrder(rid, oid); focusMapOnRoute(rid) }}
                    onReorderOrders={(rid, fi, ti) => { trackEdit(rid); editSentRouteReorderOrders(rid, fi, ti) }}
                    onMoveOrderHere={(fromRouteId, orderId) => {
                      trackEdit(fromRouteId); trackEdit(route.id)
                      editSentRouteDetachOrder(fromRouteId, orderId)
                      editSentRouteAttachOrder(route.id, orderId)
                      focusMapOnRoute(route.id)
                    }}
                    onMoveCourierHere={(fromRouteId, courierId) => {
                      trackEdit(fromRouteId); trackEdit(route.id)
                      editSentRouteDetachCourier(fromRouteId)
                      editSentRouteAttachCourier(route.id, courierId)
                    }}
                    onSend={() => {}}
                    onFocusOnMap={focusMapOnRoute}
                    hideActions
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {autoAssembledRoutes.length > 0 ? (
            <div className="section">
              <div className="section__title">Собранные автоматически</div>
              <div className="section__list">
                {autoAssembledRoutes.map((route) => (
                  <RouteDeliveryCard
                    key={route.id}
                    {...deliveryCardProps(route, false)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {manualAssembledInAutoRoutes.length > 0 ? (
            <div className="section">
              <div className="section__title">Собранные вручную</div>
              <div className="section__list">
                {manualAssembledInAutoRoutes.map((route) => (
                  <RouteDeliveryCard
                    key={route.id}
                    {...deliveryCardProps(route, false)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
