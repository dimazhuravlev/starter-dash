import { type Order } from '../model/types'
import { MapboxMap, type CourierMarkerItem, type MapViewMode } from './MapboxMap'

export type OrderMarkerItem = {
  id: string
  lng: number
  lat: number
  address: string
  isOverdue: boolean
  /** Текст остатка времени (минуты), как в карточке заказа */
  slaLabel: string
  routePosition?: number
}

const DEFAULT_MAP_COLUMN_WIDTH = 400

export function MapWidget({
  orders: _orders,
  orderMarkers,
  courierMarkers = [],
  restaurantCoords,
  routePathCoords,
  isRouteDraft,
  focusCoords,
  focusBounds,
  onClearFocus,
  onOrderAddToRoute,
  orderIdsInRoute,
  onMarkerClick,
  onCourierMarkerClick,
  onMapBackgroundClick,
  routeFlashTrigger,
  mapViewMode,
  onMapViewModeChange,
  mapColumnWidthWhenVisible,
  hideViewSelector,
}: {
  orders: Record<string, Order>
  orderMarkers: OrderMarkerItem[]
  courierMarkers?: CourierMarkerItem[]
  restaurantCoords?: { lat: number; lng: number } | null
  routePathCoords: { lng: number; lat: number }[] | null
  isRouteDraft?: boolean
  focusCoords: { lat: number; lng: number } | null
  focusBounds: { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null
  onClearFocus: () => void
  onOrderAddToRoute?: (orderId: string) => void
  orderIdsInRoute?: string[]
  onMarkerClick?: (marker: OrderMarkerItem) => void
  onCourierMarkerClick?: (marker: CourierMarkerItem) => void
  onMapBackgroundClick?: () => void
  routeFlashTrigger?: number | null
  mapViewMode?: MapViewMode
  onMapViewModeChange?: (mode: MapViewMode) => void
  mapColumnWidthWhenVisible?: number
  /** Скрыть селектор вида карты (для фулскрин-оверлея на мобильных) */
  hideViewSelector?: boolean
}) {
  void _orders
  const isCollapsed = mapViewMode === 'none'
  const innerWidth = isCollapsed ? (mapColumnWidthWhenVisible ?? DEFAULT_MAP_COLUMN_WIDTH) : undefined
  return (
    <div
      className={`map-widget__container${isCollapsed ? ' map-widget__container--collapsed' : ''}`}
      style={isCollapsed ? { overflow: 'hidden' } : undefined}
    >
      <div
        className="map-widget__inner"
        style={
          isCollapsed && innerWidth != null
            ? { position: 'absolute', right: 0, top: 0, bottom: 0, width: innerWidth }
            : undefined
        }
      >
        <MapboxMap
          markers={orderMarkers}
          courierMarkers={courierMarkers}
          restaurantCoords={restaurantCoords ?? null}
          routePathCoords={routePathCoords}
          isRouteDraft={isRouteDraft ?? false}
          focusCoords={focusCoords}
          focusBounds={focusBounds}
          onClearFocus={onClearFocus}
          onOrderAddToRoute={onOrderAddToRoute}
          orderIdsInRoute={orderIdsInRoute}
          onMarkerClick={onMarkerClick}
          onCourierMarkerClick={onCourierMarkerClick}
          onMapBackgroundClick={onMapBackgroundClick}
          routeFlashTrigger={routeFlashTrigger ?? null}
          mapViewMode={mapViewMode}
          onMapViewModeChange={onMapViewModeChange}
          hideViewSelector={hideViewSelector}
        />
      </div>
    </div>
  )
}
