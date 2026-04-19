import type { MutableRefObject, RefObject } from 'react'
import { type Courier, type Order, type Route } from '../model/types'
import { type CourierMarkerItem, type MapViewMode } from '../components/MapboxMap'
import { MapWidget, type OrderMarkerItem } from '../components/MapWidget'
import dndMapIcon from '../assets/dnd-map.svg'

const RESIZER_WIDTH = 12
const MIN_RIGHT_WIDTH = 200
const MAX_RIGHT_WIDTH_RATIO = 0.8

export type DashboardMapColumnProps = {
  theme: 'dark' | 'light'
  rightColumnRef: RefObject<HTMLDivElement | null>
  resizerRef: RefObject<HTMLDivElement | null>
  mapViewMode: MapViewMode
  isResizing: boolean
  rightColumnWidth: number | null
  dashboardWidth: number | null
  onResizerPointerDown: (event: React.PointerEvent) => void
  onMapViewModeChange: (mode: MapViewMode) => void
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
  onOrderAddToRoute?: (orderId: string) => void
  orderIdsInRoute: string[]
  onCourierAddToRoute?: (courierId: string) => void
  courierIdsAssignedToDraft?: string[]
  onMarkerClick: (marker: { id: string }) => void
  onCourierMarkerClick: (marker: CourierMarkerItem) => void
  onMapBackgroundClick: () => void
  routeFlashTrigger: number | null
  mapZoomRef: MutableRefObject<number>
}

export function DashboardMapColumn({
  theme,
  rightColumnRef,
  resizerRef,
  mapViewMode,
  isResizing,
  rightColumnWidth,
  dashboardWidth,
  onResizerPointerDown,
  onMapViewModeChange,
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
  onCourierAddToRoute,
  courierIdsAssignedToDraft,
  onMarkerClick,
  onCourierMarkerClick,
  onMapBackgroundClick,
  routeFlashTrigger,
  mapZoomRef,
}: DashboardMapColumnProps) {
  const widthPx =
    mapViewMode === 'none'
      ? '44px'
      : `${RESIZER_WIDTH + (dashboardWidth != null ? Math.min(rightColumnWidth ?? 400, Math.max(MIN_RIGHT_WIDTH, Math.min(dashboardWidth - RESIZER_WIDTH, dashboardWidth * MAX_RIGHT_WIDTH_RATIO))) : (rightColumnWidth ?? 400))}px`

  return (
    <div
      ref={rightColumnRef}
      className={`dashboard__right${mapViewMode === 'none' ? ' dashboard__right--map-collapsed' : ''}${isResizing ? ' dashboard__right--resizing' : ''}`}
      style={{ width: widthPx }}
    >
      <div
        ref={resizerRef}
        className={`dashboard__resizer${isResizing ? ' dashboard__resizer--active' : ''}${mapViewMode === 'none' ? ' dashboard__resizer--no-dnd' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={mapViewMode === 'none' ? undefined : 'Изменение ширины колонки'}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onPointerDown={mapViewMode === 'none' ? undefined : onResizerPointerDown}
      >
        <div className="dashboard__resizer-hit-area" aria-hidden="true" />
        <img className="dashboard__resizer-icon" src={dndMapIcon} alt="" />
      </div>

      <section className="dashboard__column dashboard__column--map">
        <MapWidget
          theme={theme}
          orders={orders}
          orderMarkers={orderMarkers}
          courierMarkers={courierMarkers}
          restaurantCoords={restaurantCoords}
          routePathCoords={routePathCoords}
          showRouteFocus={!!focusedRouteId}
          isRouteDraft={!!(focusedRouteId && routes[focusedRouteId]?.status === 'draft')}
          focusCoords={mapFocusCoords}
          focusBounds={mapFocusBounds}
          clearFocusOnMoveEnd={!focusedRouteId}
          onClearFocus={onClearFocus}
          onOrderAddToRoute={onOrderAddToRoute}
          orderIdsInRoute={orderIdsInRoute}
          onCourierAddToRoute={onCourierAddToRoute}
          courierIdsAssignedToDraft={courierIdsAssignedToDraft}
          onMarkerClick={onMarkerClick}
          onCourierMarkerClick={onCourierMarkerClick}
          onMapBackgroundClick={onMapBackgroundClick}
          routeFlashTrigger={routeFlashTrigger}
          mapViewMode={mapViewMode}
          onMapViewModeChange={onMapViewModeChange}
          mapColumnWidthWhenVisible={rightColumnWidth ?? undefined}
          mapZoomRef={mapZoomRef}
        />
      </section>
    </div>
  )
}
