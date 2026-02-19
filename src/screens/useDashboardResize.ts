import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const RESIZE_DRAG_THRESHOLD_PX = 5
const MIN_RIGHT_WIDTH = 200
const RESIZER_WIDTH = 12
const MAX_RIGHT_WIDTH_RATIO = 0.8
const RIGHT_COLUMN_MARGIN = 16

export function useDashboardResize(isMobileMapOpen: boolean) {
  const dashboardRef = useRef<HTMLDivElement | null>(null)
  const leftWrapperRef = useRef<HTMLDivElement | null>(null)
  const rightColumnRef = useRef<HTMLDivElement | null>(null)
  const resizerRef = useRef<HTMLDivElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const resizerJustInteractedRef = useRef(false)
  const resizeDragStartedRef = useRef(false)
  const resizerInitialListenersCleanupRef = useRef<(() => void) | null>(null)

  const [rightColumnWidth, setRightColumnWidth] = useState<number | null>(null)
  const [dashboardWidth, setDashboardWidth] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [isUserResized, setIsUserResized] = useState(false)

  const syncLeftWrapperScroll = useCallback(() => {
    const wrapper = leftWrapperRef.current
    if (!wrapper) return
    const contentWidth = wrapper.scrollWidth
    const viewWidth = wrapper.clientWidth
    if (contentWidth > viewWidth) {
      wrapper.scrollLeft = contentWidth - viewWidth
    }
  }, [])

  useLayoutEffect(() => {
    syncLeftWrapperScroll()
  }, [rightColumnWidth, dashboardWidth, syncLeftWrapperScroll])

  useLayoutEffect(() => {
    if (isMobileMapOpen) return
    const wrapper = leftWrapperRef.current
    if (!wrapper) return
    void wrapper.offsetWidth
    syncLeftWrapperScroll()
  }, [isMobileMapOpen, syncLeftWrapperScroll])

  useEffect(() => {
    const dashboard = dashboardRef.current
    if (!dashboard) return
    const updateWidth = () => {
      setDashboardWidth(dashboard.getBoundingClientRect().width)
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(dashboard)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (isUserResized) return
    const updateDefaultWidth = () => {
      const dashboard = dashboardRef.current
      if (!dashboard) return
      const totalWidth = dashboard.getBoundingClientRect().width
      if (!totalWidth) return
      const baseColumnWidth = (totalWidth - RESIZER_WIDTH - RIGHT_COLUMN_MARGIN) / 6
      const defaultRight = Math.floor(baseColumnWidth * 2)
      const maxRight = Math.min(totalWidth - RESIZER_WIDTH, totalWidth * MAX_RIGHT_WIDTH_RATIO)
      setRightColumnWidth(Math.max(MIN_RIGHT_WIDTH, Math.min(defaultRight, maxRight)))
    }
    updateDefaultWidth()
    window.addEventListener('resize', updateDefaultWidth)
    return () => window.removeEventListener('resize', updateDefaultWidth)
  }, [isUserResized])

  useEffect(() => {
    if (!isResizing) return
    const rightEl = rightColumnRef.current
    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeStateRef.current
      const dashboard = dashboardRef.current
      if (!state || !dashboard || !rightEl) return
      event.preventDefault()
      const totalWidth = dashboard.getBoundingClientRect().width
      const maxRight = Math.max(
        MIN_RIGHT_WIDTH,
        Math.min(totalWidth - RESIZER_WIDTH, totalWidth * MAX_RIGHT_WIDTH_RATIO),
      )
      const nextWidth = Math.min(
        maxRight,
        Math.max(MIN_RIGHT_WIDTH, state.startWidth - (event.clientX - state.startX)),
      )
      const widthPx = Math.round(nextWidth) + RESIZER_WIDTH
      rightEl.style.width = `${widthPx}px`
      requestAnimationFrame(() => syncLeftWrapperScroll())
    }
    const handlePointerUp = () => {
      const rightEl = rightColumnRef.current
      if (rightEl) {
        const currentWidth = rightEl.getBoundingClientRect().width - RESIZER_WIDTH
        const width = Math.round(Math.max(MIN_RIGHT_WIDTH, currentWidth))
        setRightColumnWidth(width)
        rightEl.style.width = ''
      }
      setIsResizing(false)
      resizeStateRef.current = null
      resizeDragStartedRef.current = false
      document.body.classList.remove('is-resizing')
      if (activePointerIdRef.current !== null && resizerRef.current) {
        try {
          resizerRef.current.releasePointerCapture(activePointerIdRef.current)
        } catch {
          // ignore if already released
        }
        activePointerIdRef.current = null
      }
      window.setTimeout(() => {
        resizerJustInteractedRef.current = false
      }, 200)
    }
    const opts: AddEventListenerOptions = { capture: true }
    window.addEventListener('pointermove', handlePointerMove, opts)
    window.addEventListener('pointerup', handlePointerUp, opts)
    window.addEventListener('pointercancel', handlePointerUp, opts)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove, opts)
      window.removeEventListener('pointerup', handlePointerUp, opts)
      window.removeEventListener('pointercancel', handlePointerUp, opts)
    }
  }, [isResizing, syncLeftWrapperScroll])

  const handleResizerPointerDown = useCallback(
    (event: React.PointerEvent) => {
      resizerJustInteractedRef.current = true
      resizeDragStartedRef.current = false
      let startWidth = rightColumnWidth ?? null
      if (startWidth === null) {
        const rightEl = (event.currentTarget as HTMLElement).parentElement
        if (rightEl) {
          startWidth = Math.max(0, rightEl.getBoundingClientRect().width - 12)
        }
      }
      startWidth = startWidth ?? 400
      const startX = event.clientX
      resizeStateRef.current = { startX, startWidth }
      setIsUserResized(true)
      activePointerIdRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
      event.stopPropagation()

      const opts: AddEventListenerOptions = { capture: true }
      const handlePointerMove = (e: PointerEvent) => {
        if (!resizeDragStartedRef.current) {
          if (Math.abs(e.clientX - startX) >= RESIZE_DRAG_THRESHOLD_PX) {
            resizeDragStartedRef.current = true
            setIsResizing(true)
            document.body.classList.add('is-resizing')
            resizerInitialListenersCleanupRef.current?.()
            resizerInitialListenersCleanupRef.current = null
          }
        }
      }
      const handlePointerUp = () => {
        resizerInitialListenersCleanupRef.current?.()
        resizerInitialListenersCleanupRef.current = null
        if (activePointerIdRef.current !== null && resizerRef.current) {
          try {
            resizerRef.current.releasePointerCapture(activePointerIdRef.current)
          } catch {
            // ignore
          }
          activePointerIdRef.current = null
        }
        resizeStateRef.current = null
        if (!resizeDragStartedRef.current) {
          window.setTimeout(() => {
            resizerJustInteractedRef.current = false
          }, 200)
        }
      }
      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove, opts)
        window.removeEventListener('pointerup', handlePointerUp, opts)
        window.removeEventListener('pointercancel', handlePointerUp, opts)
      }
      resizerInitialListenersCleanupRef.current = cleanup
      window.addEventListener('pointermove', handlePointerMove, opts)
      window.addEventListener('pointerup', handlePointerUp, opts)
      window.addEventListener('pointercancel', handlePointerUp, opts)
    },
    [rightColumnWidth],
  )

  return {
    dashboardRef,
    leftWrapperRef,
    rightColumnRef,
    resizerRef,
    rightColumnWidth,
    dashboardWidth,
    isResizing,
    isUserResized,
    syncLeftWrapperScroll,
    handleResizerPointerDown,
    resizerJustInteractedRef,
  }
}
