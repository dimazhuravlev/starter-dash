import { RouteModeSelector } from '../shared/ui/RouteModeSelector'
import './ModeSelectorSection.css'

export type ModeSelectorSectionProps = {
  routesCount: number
  routeMode: 'auto' | 'manual'
  onRouteModeChange: (mode: 'auto' | 'manual') => void
}

export function ModeSelectorSection({
  routesCount,
  routeMode,
  onRouteModeChange,
}: ModeSelectorSectionProps) {
  return (
    <div className="mode-selector-section">
      <div className="mode-selector-section__card">
        <div className="mode-selector-section__top">
          <div className="mode-selector-section__title-row">
            <span className="mode-selector-section__title">Маршруты</span>
            {routesCount > 0 && <span className="mode-selector-section__count">{routesCount}</span>}
          </div>
        </div>
        <RouteModeSelector
          mode={routeMode}
          onModeChange={onRouteModeChange}
          className="mode-selector-section__selector"
        />
      </div>
    </div>
  )
}
