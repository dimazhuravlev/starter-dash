import { type Courier, type Order, type Route } from '../model/types'
import { type OrderStageMin, type RouteStageMin } from '../model/rules'
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
  const routesHeaderCount =
    routeMode === 'manual' ? manualAssignedRoutes.length : autoAssembledRoutes.length
  const manualTemplateCardCount = draftRoutes.length + sentPickupAwaitingKitchen.length

  const deliveryCardProps = (route: Route, showRevert: boolean) => ({
    route,
    courier: couriers[route.courierId],
    orders,
    now,
    orderStageMin,
    routeStageMin,
    highlightedOrderIdFromMap,
    isJustAppeared: recentlySentRouteIds.includes(route.id),
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
      ) : (
        autoAssembledRoutes.length > 0 ? (
          <div className="section">
            <div className="section__title">Собранные автоматически</div>
            <div className="section__list">
              {autoAssembledRoutes.map((route) => (
                <RouteDeliveryCard key={route.id} {...deliveryCardProps(route, false)} />
              ))}
            </div>
          </div>
        ) : null
      )}
    </section>
  )
}
