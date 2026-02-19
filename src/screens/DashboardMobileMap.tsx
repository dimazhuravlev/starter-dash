import { type Courier, type Order, type Route } from '../model/types'
import { type CourierMarkerItem } from '../components/MapboxMap'
import { MapWidget, type OrderMarkerItem } from '../components/MapWidget'

export type DashboardMobileMapProps = {
  isOpen: boolean
  onToggle: () => void
  orders: Record<string, Order>
  orderMarkers: OrderMarkerItem[]
  courierMarkers: CourierMarkerItem[]
  restaurantCoords: { lat: number; lng: number }
  routePathCoords: { lng: number; lat: number }[] | null
  focusedRouteId: string | null
  routes: Record<string, Route>
  mapFocusCoords: { lat: number; lng: number } | null
  mapFocusBounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null
  onClearFocus: () => void
  onOrderAddToRoute: (orderId: string) => void
  orderIdsInRoute: string[]
  onMarkerClick: (marker: { id: string }) => void
  onCourierMarkerClick: (marker: CourierMarkerItem) => void
  onMapBackgroundClick: () => void
  routeFlashTrigger: number | null
}

export function DashboardMobileMap({
  isOpen,
  onToggle,
  orders,
  orderMarkers,
  courierMarkers,
  restaurantCoords,
  routePathCoords,
  focusedRouteId,
  routes,
  mapFocusCoords,
  mapFocusBounds,
  onClearFocus,
  onOrderAddToRoute,
  orderIdsInRoute,
  onMarkerClick,
  onCourierMarkerClick,
  onMapBackgroundClick,
  routeFlashTrigger,
}: DashboardMobileMapProps) {
  return (
    <>
      <div className="map-floating-btn" aria-hidden="true">
        <button
          type="button"
          className="map-floating-btn__btn"
          onClick={onToggle}
          aria-label={isOpen ? 'Показать карточки' : 'Показать карту'}
        >
          {isOpen ? 'Карточки' : 'Карта'}
        </button>
      </div>
      {isOpen ? (
        <div className="mobile-map-overlay" role="dialog" aria-modal="true" aria-label="Карта">
          <div className="mobile-map-overlay__map">
            <MapWidget
              orders={orders}
              orderMarkers={orderMarkers}
              courierMarkers={courierMarkers}
              restaurantCoords={restaurantCoords}
              routePathCoords={routePathCoords}
              isRouteDraft={!!(focusedRouteId && routes[focusedRouteId]?.status === 'draft')}
              focusCoords={mapFocusCoords}
              focusBounds={mapFocusBounds}
              onClearFocus={onClearFocus}
              onOrderAddToRoute={onOrderAddToRoute}
              orderIdsInRoute={orderIdsInRoute}
              onMarkerClick={onMarkerClick}
              onCourierMarkerClick={onCourierMarkerClick}
              onMapBackgroundClick={onMapBackgroundClick}
              routeFlashTrigger={routeFlashTrigger}
              mapViewMode="half"
              mapColumnWidthWhenVisible={undefined}
              hideViewSelector
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
