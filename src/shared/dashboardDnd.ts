import type { DragEvent } from 'react'
import { useDashboardStore } from '../store/useDashboardStore'
import type { Route } from '../model/types'

export type DndPayload =
  | { kind: 'courier'; id: string }
  | { kind: 'order'; id: string }
  | { kind: 'route-order'; id: string; routeId: string }
  | { kind: 'route-courier'; id: string; routeId: string }

const DND_MIME = 'application/x-dashboard-dnd'
let lastDndPayload: DndPayload | null = null
let lastDropRouteId: string | null = null
let autoDraftRouteId: string | null = null

export const parseDndPayload = (event: DragEvent<HTMLElement>): DndPayload | null => {
  const transfer = event.dataTransfer
  if (!transfer) return null
  const raw = transfer.getData(DND_MIME) || transfer.getData('text/plain')
  if (!raw) return lastDndPayload
  try {
    const parsed = JSON.parse(raw) as { kind?: string; id?: string; routeId?: string }
    if (parsed.kind === 'route-order' && typeof parsed.id === 'string' && typeof parsed.routeId === 'string') {
      return { kind: 'route-order', id: parsed.id, routeId: parsed.routeId }
    }
    if (parsed.kind === 'route-courier' && typeof parsed.id === 'string' && typeof parsed.routeId === 'string') {
      return { kind: 'route-courier', id: parsed.id, routeId: parsed.routeId }
    }
    if ((parsed.kind === 'courier' || parsed.kind === 'order') && typeof parsed.id === 'string') {
      return { kind: parsed.kind, id: parsed.id }
    }
  } catch {
    return null
  }
  return null
}

export const setDndPayload = (event: DragEvent<HTMLElement>, payload: DndPayload) => {
  event.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
  event.dataTransfer.setData('text/plain', JSON.stringify(payload))
  event.dataTransfer.effectAllowed = (payload.kind === 'route-order' || payload.kind === 'route-courier') ? 'move' : 'copy'
  lastDndPayload = payload
}

export const hasDndPayload = (event: DragEvent<HTMLElement>) => {
  const types = Array.from(event.dataTransfer.types)
  return types.includes(DND_MIME) || types.includes('text/plain') || Boolean(lastDndPayload)
}

export function setDragImageAsCopy(event: DragEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  const dragEl = element.cloneNode(true) as HTMLElement
  dragEl.style.cssText = `position: absolute; left: -9999px; top: 0; width: ${rect.width}px; height: ${rect.height}px; opacity: 0.9; pointer-events: none; box-sizing: border-box;`
  document.body.appendChild(dragEl)
  event.dataTransfer.setDragImage(dragEl, offsetX, offsetY)
  setTimeout(() => dragEl.remove(), 0)
}

const hasDraftRoute = (routes: Record<string, Route>) =>
  Object.values(routes).some((route) => route.status === 'draft')

export const maybeCreateAutoDraftRoute = (routes: Record<string, Route>, createRouteDraft: () => string) => {
  if (useDashboardStore.getState().routeMode === 'auto') {
    autoDraftRouteId = null
    return
  }
  if (hasDraftRoute(routes)) {
    autoDraftRouteId = null
    return
  }
  autoDraftRouteId = createRouteDraft()
}

export const cleanupAutoDraftRouteIfEmpty = (deleteRouteDraft: (routeId: string) => void) => {
  if (!autoDraftRouteId) return
  const { routes } = useDashboardStore.getState()
  const route = routes[autoDraftRouteId]
  if (route && route.status === 'draft' && !route.courierId && route.orderIds.length === 0) {
    deleteRouteDraft(autoDraftRouteId)
  }
  autoDraftRouteId = null
}

export const getLastDndPayload = (): DndPayload | null => lastDndPayload
export const getLastDropRouteId = (): string | null => lastDropRouteId
export const setLastDropRouteId = (id: string | null) => {
  lastDropRouteId = id
}
export const clearDndPayload = () => {
  lastDndPayload = null
}
export const clearDndState = () => {
  lastDndPayload = null
  lastDropRouteId = null
}
