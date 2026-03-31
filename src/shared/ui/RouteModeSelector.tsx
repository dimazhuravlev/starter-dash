import { useCallback, useRef, type PointerEvent } from 'react'
import './RouteModeSelector.css'

export type RouteModeSelectorProps = {
  mode: 'auto' | 'manual'
  synced?: boolean
  onModeChange: (mode: 'auto' | 'manual') => void
  className?: string
}

export function RouteModeSelector({ mode, synced, onModeChange, className }: RouteModeSelectorProps) {
  const dragRef = useRef<{ startY: number; dragging: boolean } | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const handlePointerDown = useCallback((e: PointerEvent) => {
    dragRef.current = { startY: e.clientY, dragging: false }
    toggleRef.current?.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return
      const dy = e.clientY - dragRef.current.startY
      if (Math.abs(dy) > 4) {
        dragRef.current.dragging = true
        const newMode = dy > 0 ? 'manual' : 'auto'
        if (newMode !== mode) onModeChange(newMode)
      }
    },
    [mode, onModeChange],
  )

  const handlePointerUp = useCallback(() => {
    const wasDrag = dragRef.current?.dragging
    dragRef.current = null
    if (!wasDrag) {
      onModeChange(mode === 'auto' ? 'manual' : 'auto')
    }
  }, [mode, onModeChange])

  const rootClass = ['route-mode-selector', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <button
        ref={toggleRef}
        type="button"
        className={`route-mode-selector__toggle${mode === 'manual' ? ' route-mode-selector__toggle--manual' : ''}${synced === false ? ' route-mode-selector__toggle--desynced' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="route-mode-selector__thumb" />
      </button>
      <div className="route-mode-selector__labels">
        <button
          type="button"
          className={`route-mode-selector__label ${mode === 'auto' ? 'route-mode-selector__label--active' : 'route-mode-selector__label--inactive'}`}
          onClick={() => onModeChange('auto')}
        >
          Автомат
        </button>
        <button
          type="button"
          className={`route-mode-selector__label ${mode === 'manual' ? 'route-mode-selector__label--active' : 'route-mode-selector__label--inactive'}`}
          onClick={() => onModeChange('manual')}
        >
          Ручной
        </button>
      </div>
    </div>
  )
}
