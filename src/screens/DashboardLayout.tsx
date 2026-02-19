import type { RefObject } from 'react'

type DashboardLayoutProps = {
  dashboardRef: RefObject<HTMLDivElement | null>
  isMobileMapOpen: boolean
  resizerJustInteractedRef: RefObject<boolean>
  children: React.ReactNode
}

export function DashboardLayout({
  dashboardRef,
  isMobileMapOpen,
  resizerJustInteractedRef,
  children,
}: DashboardLayoutProps) {
  return (
    <div
      className={`dashboard${isMobileMapOpen ? ' dashboard--map-overlay-open' : ''}`}
      ref={dashboardRef}
      onClickCapture={(e) => {
        if (resizerJustInteractedRef.current) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      {children}
    </div>
  )
}
