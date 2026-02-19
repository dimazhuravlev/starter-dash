# Step 1 — Styling audit: colors and typography

## Colors (repeated values → semantic tokens)

| Raw value | Occurrences | Semantic token |
|-----------|-------------|----------------|
| #0F1215 | index.css | --bg-app |
| #ffffff / #fff / #FFF | many | --text-primary |
| rgba(255,255,255,0.4) / 0.40 | many | --text-muted |
| rgba(255,255,255,0.20) | Card, ColumnSection | --text-tertiary |
| rgba(255,255,255,0.5) / 0.6 / 0.7 / 0.8 | Card, RouteDraft | --text-placeholder, etc. |
| #292d32 | index, Card | --card-bg (existing) |
| #22262B | Card, MapboxMap | --bg-surface |
| #34373C | RouteDraft, RouteDelivery, MapboxMap, TSX | --bg-elevated |
| #212428 | Card, DebugPanel | --bg-input |
| #570F27 | Card, RouteDraft, RouteDelivery, TSX | --danger-surface |
| #03ab00 / #03AB00 | many | --accent |
| #E8306E, hsla(340,80%,55%,1) | Card, MapboxMap | --danger |
| #47d37a | Card | --success-text |
| #7b85a5 | DebugPanel | --text-caption |
| #131415 | AppHeader | --bg-popover |
| #282A2E | MapboxMap | --bg-popover-surface |
| #111827 | utilities | --bg-neutral-900 |
| #292929 | MapWidget | --bg-map-container |
| #7B00DF | MapboxMap | --accent-purple |
| #a78bfa | MapboxMap | --link |
| #272725, #1a1a1a | RouteDraft, DashboardMobileMap | --text-on-primary |
| #FAFAFA, #FFF (light surfaces) | RouteDraft, DashboardMobileMap | --bg-primary-btn (light) |
| rgba(255,255,255,0.04) | many borders | --border-default |
| rgba(255,255,255,0.06) | many | --border-subtle |
| rgba(255,255,255,0.08) | many | --border-strong |
| rgba(255,255,255,0.10) | Card, RouteDraft | --border-dashed |
| rgba(255,255,255,0.12) | DebugPanel | --border-input |
| rgba(255,255,255,0.15) | Card, DebugPanel, RouteDraft | --border-hover |
| rgba(255,255,255,0.08) bg | many | --bg-chip |
| rgba(255,255,255,0.06) bg | many | --bg-hover-subtle |
| rgba(255,255,255,0.10) bg | many | --bg-ghost |
| rgba(255,255,255,0.1) bg | many | same |
| rgba(3,171,0,0.1) | Card, RouteDelivery | --success-surface-subtle |
| rgba(232,48,110,0.20) | Card | --danger-surface-subtle |
| rgba(46,204,113,0.18/0.4) | Card | --success-surface, --success-border |
| #B8FFB7 | MapboxMap (line gradient) | --accent-glow |

## Typography (unified text-style variables)

| Style | Token | Shorthand value |
|-------|--------|-----------------|
| Subtitle | --type-subtitle | 600 12px/14px var(--font-family) |
| Text | --type-text | 600 14px/16px var(--font-family) |
| Title | --type-title | 600 18px/20px var(--font-family) |

Usage: `font: var(--type-subtitle);`, `font: var(--type-text);`, `font: var(--type-title);`.  
Base font stack: `--font-family` (used in :root and form elements).
