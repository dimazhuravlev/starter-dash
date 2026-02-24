import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

const TOOLTIP_OFFSET_X = 12
const TOOLTIP_OFFSET_Y = 12
const VIEWPORT_MARGIN = 4
const SHOW_DELAY_MS = 150

type TooltipProps = {
  children: ReactNode
  /** Текст тултипа — показывается при ховере. Пустая строка = тултип отключён */
  title: string
  /** Обёртка занимает 100% ширины и высоты родителя (для панелей) */
  fill?: boolean
}

function clampToViewport(
  left: number,
  top: number,
  width: number,
  height: number,
): { left: number; top: number } {
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN
  const maxTop = window.innerHeight - height - VIEWPORT_MARGIN
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(left, maxLeft)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(top, maxTop)),
  }
}

export function Tooltip({ children, title, fill }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateCoords = useCallback((clientX: number, clientY: number) => {
    setCoords({
      top: clientY + TOOLTIP_OFFSET_Y,
      left: clientX + TOOLTIP_OFFSET_X,
    })
  }, [])

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!title) return
    updateCoords(e.clientX, e.clientY)
    showTimeoutRef.current = setTimeout(() => {
      showTimeoutRef.current = null
      setVisible(true)
    }, SHOW_DELAY_MS)
  }, [updateCoords, title])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!title) return
    updateCoords(e.clientX, e.clientY)
  }, [updateCoords, title])

  const handleMouseLeave = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    setVisible(false)
  }, [])

  useLayoutEffect(() => {
    const el = tooltipRef.current
    if (!el || !visible) return
    const rect = el.getBoundingClientRect()
    const { left, top } = clampToViewport(
      coords.left,
      coords.top,
      rect.width,
      rect.height,
    )
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [visible, coords])

  return (
    <>
      <span
        className={`tooltip-wrapper${fill ? ' tooltip-wrapper--fill' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <span
            ref={tooltipRef}
            className="tooltip tooltip--portal"
            role="tooltip"
            style={{
              top: coords.top,
              left: coords.left,
            }}
          >
            {title}
          </span>,
          document.body,
        )}
    </>
  )
}
