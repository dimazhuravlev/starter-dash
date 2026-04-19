import { useEffect, useState } from 'react'
import crossIcon from '../assets/Cross.svg'
import doneIcon from '../assets/Done.svg'
import EditIcon from '../assets/Edit.svg'
import { PrimaryButton } from '../shared/ui/PrimaryButton'
import { RouteModeSelector } from '../shared/ui/RouteModeSelector'
import './ModeSelectorSection.css'

export type ModeSelectorSectionProps = {
  routesCount: number
  routeMode: 'auto' | 'manual'
  isEditing?: boolean
  onStartEditing?: () => void
  onSave?: () => void
  onCancelEditing?: () => void
  onRouteModeChange?: (mode: 'auto' | 'manual') => void
}

export function ModeSelectorSection({
  routesCount,
  routeMode,
  isEditing,
  onStartEditing,
  onSave,
  onCancelEditing,
  onRouteModeChange,
}: ModeSelectorSectionProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false)

  const EDIT_TIMEOUT_S = 59
  const [secondsLeft, setSecondsLeft] = useState(EDIT_TIMEOUT_S)

  useEffect(() => {
    if (!isEditing) {
      setSecondsLeft(EDIT_TIMEOUT_S)
      return
    }
    setSecondsLeft(EDIT_TIMEOUT_S)
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onCancelEditing?.()
          return EDIT_TIMEOUT_S
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isEditing])

  const formatTimer = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="mode-selector-section">
      <div className="mode-selector-section__card">
        <div className="mode-selector-section__top">
          <div className="mode-selector-section__title-row">
            <span className="mode-selector-section__title">Маршруты</span>
            {routesCount > 0 && <span className="mode-selector-section__count">{routesCount}</span>}
          </div>
          {!isEditing && onRouteModeChange && (
            <div
              className="mode-mini-toggle-wrap"
              onMouseEnter={() => setIsPopupOpen(true)}
              onMouseLeave={() => setIsPopupOpen(false)}
            >
              <span
                className={`mode-mini-toggle-label mode-mini-toggle-label--visible${routeMode === 'manual' ? ' mode-mini-toggle-label--manual' : ''}`}
                aria-hidden
              >
                {routeMode === 'auto' ? (
                  <span className="route-mode-auto-text">Автомат</span>
                ) : (
                  'Ручной'
                )}
              </span>
              <button
                type="button"
                className={`mode-mini-toggle${routeMode === 'manual' ? ' mode-mini-toggle--manual' : ''}`}
                aria-label={routeMode === 'auto' ? 'Переключить в ручной режим' : 'Переключить в автоматический режим'}
              >
                <span className="mode-mini-toggle__dot" />
              </button>
              <div className={`mode-mini-toggle-popup${isPopupOpen ? ' mode-mini-toggle-popup--visible' : ''}`}>
                <div className="mode-mini-toggle-popup__content">
                  <div className="mode-mini-toggle-popup__title">Режим создания<br />маршрутов</div>
                  <RouteModeSelector mode={routeMode} onModeChange={onRouteModeChange} />
                </div>
              </div>
            </div>
          )}
        </div>
        {routeMode === 'auto' && (
          <div className="mode-selector-section__actions">
            {isEditing ? (
              <>
                <PrimaryButton
                  variant="accent"
                  iconStart={doneIcon}
                  className="mode-selector-section__edit-btn"
                  onClick={onSave}
                >
                  Сохранить
                </PrimaryButton>
                <button
                  type="button"
                  className="mode-selector-section__cancel-btn"
                  onClick={onCancelEditing}
                  aria-label="Отменить редактирование"
                >
                  <span
                    className="mode-selector-section__cancel-icon"
                    style={{ ['--icon-src' as string]: `url(${crossIcon})` }}
                    aria-hidden
                  />
                  <span className="mode-selector-section__cancel-timer" aria-hidden>
                    {formatTimer(secondsLeft)}
                  </span>
                </button>
              </>
            ) : (
              <PrimaryButton
                variant="default"
                iconStart={EditIcon}
                className="mode-selector-section__edit-btn mode-selector-section__edit-btn--change"
                onClick={onStartEditing}
              >
                Изменить
              </PrimaryButton>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
