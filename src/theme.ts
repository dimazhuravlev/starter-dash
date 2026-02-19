/**
 * Read a CSS custom property (design token) from the document.
 * Use for components that need token values in JS (e.g. SVG gradients, Mapbox paint).
 */
export function getColorToken(token: string): string {
  if (typeof document === 'undefined') return ''
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return value || ''
}
