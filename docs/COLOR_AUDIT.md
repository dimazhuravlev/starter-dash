# Color Audit Report

**Scope:** Color tokens only (no typography).  
**Source of truth:** `src/index.css` `:root` (lines 16–89).  
**No code changes** — audit only.

---

## 1. Token inventory

Resolved values: hex as-is; rgba/hsl normalized to a canonical form where helpful.  
Usage count = number of `var(--token)` usages in CSS + JS/TS (e.g. `getColorToken('--token')`).  
Role guess: inferred from property (background, color, border, etc.).

| Token | Resolved value | Usage count | Role guess | First occurrences (file:line) |
|-------|----------------|-------------|------------|--------------------------------|
| **Backgrounds** |
| `--bg-app` | `#0F1215` | 1 | bg | src/index.css:98 |
| `--bg` | `#0F1215` | 6 | bg | src/index.css:139, src/screens/DashboardMobileMap.css:11, src/entities/ColumnSection.css:7, src/AppLayout.css:6, src/screens/DashboardScreen.css:36, src/screens/DashboardScreen.css:47 |
| `--column-bg` | `rgba(255,255,255,0.04)` | 1 | bg | src/screens/DebugPanelScreen.css:99 |
| `--card-bg` | `#292d32` | 2 | bg | src/screens/DebugPanelScreen.css:32, src/screens/DebugPanelScreen.css:81 |
| `--bg-surface` | `#22262B` | 2 | bg | src/shared/ui/Card.css:29, src/components/MapboxMap.css:59 |
| `--bg-elevated` | `#34373C` | 3 (+2 JS) | bg | src/entities/RouteDeliveryCard.css:90, src/entities/RouteDraftCard.css:198, src/components/MapboxMap.css:76; RouteDraftCard.tsx:326, RouteDeliveryCard.tsx:160 |
| `--bg-input` | `#212428` | 2 | bg | src/screens/DebugPanelScreen.css:139, src/shared/ui/Card.css:476 |
| `--bg-popover` | `#131415` | 1 | bg | src/shared/ui/AppHeader.css:129 |
| `--bg-popover-surface` | `#282A2E` | 1 | bg | src/components/MapboxMap.css:416 |
| `--bg-map-container` | `#292929` | 1 | bg | src/components/MapWidget.css:13 |
| `--bg-neutral-900` | `#111827` | 1 | bg | src/shared/ui/utilities.css:30 |
| `--bg-chip` | `rgba(255,255,255,0.08)` | 9 | bg | src/entities/RouteDeliveryCard.css:50, Card.css:283, 457, AppSubheader.css:51, RouteDraftCard.css:32, 250, MapboxMap.css:454, etc. |
| `--bg-hover-subtle` | `rgba(255,255,255,0.06)` | 10 | bg | Card.css:307, RouteDraftCard.css:307, 316, MapboxMap.css:130, 141, 192, 196, AppHeader.css:67, 78, 93, DashboardScreen.css:182 |
| `--bg-ghost` | `rgba(255,255,255,0.1)` | 14 | bg | DebugPanelScreen.css:153, Card.css:298, 412, 418, 423, 428, 433, 492, RouteDraftCard.css:316, 223, MapboxMap.css:130, 166, 192, 196, 223, AppHeader.css:67 |
| `--bg-ghost-hover` | `rgba(255,255,255,0.12)` | 2 | bg | src/screens/DebugPanelScreen.css:157, src/shared/ui/AppHeader.css:89 |
| `--bg-primary-btn` | `linear-gradient(0deg, #FAFAFA 0%, #FFF 100%)` | 2 | bg (gradient) | src/screens/DashboardMobileMap.css:44, src/entities/RouteDraftCard.css:361 |
| `--bg-card-hover` | `rgba(32,35,39,0.98)` | 2 | bg | src/shared/ui/Card.css:16, src/shared/ui/Card.css:75 |
| `--bg-card-hover-alt` | `rgba(28,31,35,0.98)` | 1 | bg | src/shared/ui/Card.css:49 |
| `--bg-empty-route` | `rgba(34,38,43,0.30)` | 1 | bg | src/shared/ui/Card.css:121 |
| `--bg-empty-route-hover` | `rgba(28,32,37,0.5)` | 1 | bg | src/shared/ui/Card.css:128 |
| `--bg-overlay-highlight` | `rgba(255,255,255,0.3)` | 4 | bg | src/entities/RouteDeliveryCard.css:98, src/shared/ui/Card.css:37, 236, src/entities/RouteDraftCard.css:206 |
| `--bg-overdue-hover` | `rgba(58,10,26,0.98)` | 1 | bg (state) | src/shared/ui/Card.css:228 |
| **Text** |
| `--text-primary` | `#ffffff` | 22+ | text | index.css:97, 139, DebugPanelScreen, Card, AppLayout, ColumnSection, AppSubheader, RouteDraftCard, MapboxMap, AppHeader, etc. |
| `--text-muted` | `rgba(255,255,255,0.4)` | 14 | text | utilities.css:43, RouteDeliveryCard, Card, AppSubheader, RouteDraftCard, AppLayout, ColumnSection, AppHeader |
| `--text-tertiary` | `rgba(255,255,255,0.20)` | 3 | text | src/shared/ui/Card.css:346, 353, src/entities/ColumnSection.css:27 |
| `--text-placeholder` | `rgba(255,255,255,0.5)` | 2 | text | src/shared/ui/Card.css:297, src/entities/RouteDraftCard.css:22 |
| `--text-secondary` | `rgba(255,255,255,0.6)` | 1 | text | src/entities/RouteDraftCard.css:34 |
| `--text-secondary-hover` | `rgba(255,255,255,0.7)` | 4 | text | src/entities/RouteDraftCard.css:106, 114, 122, src/components/MapboxMap.css:216 |
| `--text-secondary-more` | `rgba(255,255,255,0.8)` | 1 | text | src/entities/RouteDraftCard.css:251 |
| `--text-caption` | `#7b85a5` | 0 | text | (defined only; unused) |
| `--text-on-primary` | `#272725` | 1 | text | src/entities/RouteDraftCard.css:363 |
| `--text-on-primary-mobile` | `#1a1a1a` | 1 | text | src/screens/DashboardMobileMap.css:46 |
| `--link` | `#a78bfa` | 1 | text | src/components/MapboxMap.css:233 |
| **Borders** |
| `--border-default` | `rgba(255,255,255,0.04)` | 10 | border | RouteDeliveryCard, Card, RouteDraftCard, MapboxMap (border + 1× background), AppHeader |
| `--border-subtle` | `rgba(255,255,255,0.06)` | 2 | border | src/shared/ui/AppSubheader.css:7, src/shared/ui/AppHeader.css:7 |
| `--border-strong` | `rgba(255,255,255,0.08)` | 4 | border | DebugPanelScreen, Card, MapboxMap, AppHeader |
| `--border-dashed` | `rgba(255,255,255,0.10)` | 2 | border | src/shared/ui/Card.css:120, src/entities/RouteDraftCard.css:73 |
| `--border-focus` | `rgba(255,255,255,0.14)` | 1 | border | src/shared/ui/Card.css:129 |
| `--border-hover` | `rgba(255,255,255,0.15)` | 5 | border (+ 1 bg) | DebugPanelScreen, Card, RouteDraftCard (79, 125), DashboardScreen:78 (background) |
| `--border-input` | `rgba(255,255,255,0.12)` | 1 | border | src/screens/DebugPanelScreen.css:82 |
| `--border-table` | `rgba(94,108,141,0.2)` | 1 | border | src/screens/DebugPanelScreen.css:175 |
| `--border-table-head` | `rgba(94,108,141,0.35)` | 1 | border | src/screens/DebugPanelScreen.css:179 |
| `--border-light` | `rgba(0,0,0,0.08)` | 2 | border | src/screens/DashboardMobileMap.css:43, src/entities/RouteDraftCard.css:360 |
| **Semantic / accent** |
| `--accent` | `#03ab00` | 5 CSS + 2 JS | accent | RouteDeliveryCard, Card, MapboxMap (265, 287, 325); MapboxMap.tsx (402, 754), RouteDeliveryCard.tsx (fill) |
| `--green` | `#03ab00` | 0 | accent | (defined only; unused) |
| `--accent-glow` | `#B8FFB7` | 0 CSS, 1 JS | accent | MapboxMap.tsx:755 |
| `--accent-on-accent` | `rgba(255,255,255,1)` | 2 CSS + 1 JS | text-on-accent | MapboxMap.css:266, 281; MapboxMap.tsx:403 |
| `--accent-purple` | `#7B00DF` | 1 | accent | src/components/MapboxMap.css:472 |
| `--danger` | `#E8306E` | 1 | state | src/components/MapboxMap.css:280 |
| `--danger-hsl` | `hsla(340,80%,55%,1)` ≈ `#E8306E` | 1 | state (text) | src/shared/ui/Card.css:386 |
| `--danger-surface` | `#570F27` | 3 CSS + 2 JS | state bg | RouteDeliveryCard, Card, RouteDraftCard; RouteDraftCard.tsx, RouteDeliveryCard.tsx |
| `--danger-surface-subtle` | `rgba(232,48,110,0.20)` | 1 | state bg | src/shared/ui/Card.css:385 |
| `--danger-surface-hover` | `rgba(58,10,26,0.98)` | 0 | state bg | (defined only; unused) |
| `--success-text` | `#47d37a` | 2 | state text | src/shared/ui/Card.css:441, 468 |
| `--success-surface-subtle` | `rgba(3,171,0,0.1)` | 2 | state bg | RouteDeliveryCard, Card |
| `--success-surface` | `rgba(46,204,113,0.18)` | 2 | state bg | src/shared/ui/Card.css:439, 466 |
| `--success-border` | `rgba(46,204,113,0.4)` | 2 | border | src/shared/ui/Card.css:440, 467 |
| `--dot-bg` | `rgba(255,255,255,0.10)` | 1 | bg | src/shared/ui/Card.css:362 |
| `--text-shadow-dark` | `#202020` | 2 | shadow | src/components/MapboxMap.css:386, 400 |

**Non-color token (for reference):**  
`--route-radius` = `12px` — defined in Card.css:110, used Card.css:118. Not a color; do not merge into palette.

---

## 2. Raw hardcoded colors (bypass tokens)

Colors in component CSS that are **not** using `var(--...)` and are **not** inside `:root` definitions.

| File | Line | Code / context | Suggestion |
|------|------|----------------|------------|
| src/screens/DebugPanelScreen.css | 148 | `box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25)` | Consider token e.g. `--shadow-panel` |
| src/shared/ui/Card.css | 11 | `box-shadow: 0 1px 8px rgba(0, 0, 0, 0.2)` | Consider shadow token |
| src/shared/ui/Card.css | 17 | `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3)` | Consider shadow token |
| src/shared/ui/Card.css | 50, 58, 76 | `box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35)` | Consider shadow token |
| src/shared/ui/Card.css | 122 | `box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.06)` | Consider shadow token |
| src/shared/ui/Card.css | 229 | `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35)` | Consider shadow token |
| src/screens/DashboardMobileMap.css | 45 | `box-shadow: 0 1px 8px 0 rgba(0, 0, 0, 0.03)` | Consider shadow token |
| src/entities/RouteDraftCard.css | 308, 362 | `box-shadow: 0 1px 8px 0 rgba(0, 0, 0, 0.03)` | Consider shadow token |
| src/components/MapboxMap.css | 133 | `box-shadow: 0 1px 8px 0 rgba(0, 0, 0, 0.03)` | Consider shadow token |
| src/components/MapboxMap.css | 215 | `background: rgba(0, 0, 0, 0.2)` | Consider e.g. `--overlay-dim` token |
| src/components/MapboxMap.css | 367 | Comment: `/* Зелёный цвет #03AB00 для иконки */` + filter replicating green | Filter approximates `--accent` (#03ab00); consider documenting as token-derived |
| src/components/MapboxMap.css | 387–388, 401–402 | `0 1px 2px rgba(0, 0, 0, 0.8)`, `0 0 4px rgba(0, 0, 0, 0.5)` | Consider shadow tokens |
| src/components/MapboxMap.css | 419 | `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4)` | Consider shadow token |
| src/components/MapboxMap.css | 473 | `box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35)` | Consider shadow token |
| src/shared/ui/AppHeader.css | 68 | `box-shadow: 0 1px 8px 0 rgba(0, 0, 0, 0.03)` | Consider shadow token |
| src/shared/ui/AppHeader.css | 132 | `box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35)` | Consider shadow token |

**Summary:** All are shadows or one overlay; no direct replacement of existing color tokens. Optional follow-up: introduce shadow/overlay tokens and replace these values.

---

## 3. Similarity clusters

Grouped by same or very close values. DeltaE not computed; comparison is by RGB/alpha.

### 3.1 Identical (same value)

| Cluster | Tokens | Resolved value | Note |
|---------|--------|----------------|------|
| **Base app bg** | `--bg-app`, `--bg` | `#0F1215` | Same role (bg); safe to merge to one token. |
| **Accent green** | `--accent`, `--green` | `#03ab00` | `--green` unused; can remove and keep `--accent`. |
| **Danger solid** | `--danger`, `--danger-hsl` | `#E8306E` / `hsla(340,80%,55%,1)` | Same color; keep one (e.g. `--danger`), other as alias or remove. |
| **White 10%** | `--bg-ghost`, `--dot-bg` | `rgba(255,255,255,0.10)` | Same role family (bg); can merge to one (e.g. `--bg-ghost`). |
| **White 4%** | `--column-bg`, `--border-default` | `rgba(255,255,255,0.04)` | Different roles (bg vs border). Keep both names; can point to same base token (e.g. `--neutral-alpha-04`) if desired. |
| **Overdue/danger hover** | `--bg-overdue-hover`, `--danger-surface-hover` | `rgba(58,10,26,0.98)` | Same value; `--danger-surface-hover` unused. Can merge to one semantic token. |

### 3.2 Same RGB, different alpha (white)

| Base | Tokens | Values | Max alpha diff |
|------|--------|--------|----------------|
| White | `--border-default`, `--column-bg` | 0.04 | — |
| White | `--bg-hover-subtle` | 0.06 | +0.02 |
| White | `--border-subtle` | 0.06 | same as hover-subtle |
| White | `--bg-chip`, `--border-strong` | 0.08 | +0.02 |
| White | `--bg-ghost`, `--dot-bg` | 0.10 | +0.02 |
| White | `--border-dashed` | 0.10 | same as ghost |
| White | `--bg-ghost-hover` | 0.12 | +0.02 |
| White | `--border-input` | 0.12 | same as ghost-hover |
| White | `--border-focus` | 0.14 | +0.02 |
| White | `--border-hover` | 0.15 | +0.01 |

Minimal palette could use one “white alpha” scale (e.g. 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.15) and map semantic tokens to these.

### 3.3 Dark neutrals (hex)

| Tokens | Values | Channel diffs (max) |
|--------|--------|---------------------|
| `--bg-app`, `--bg` | `#0F1215` | — |
| `--bg-popover` | `#131415` | R+2, G+2, B+0 |
| `--bg-neutral-900` | `#111827` | R+0, G−1, B+6 (different hue) |
| `--bg-input` | `#212428` | R+6, G+4, B+7 |
| `--bg-surface` | `#22262B` | R+7, G+6, B+10 |
| `--card-bg` | `#292d32` | R+14, G+9, B+11 |
| `--bg-popover-surface` | `#282A2E` | R+13, G+8, B+7 |
| `--bg-map-container` | `#292929` | R+14, G+11, B+8 (gray) |
| `--bg-elevated` | `#34373C` | R+19, G+19, B+15 |

These are close; a minimal set could be e.g. 2–3 base neutrals + semantic names.

### 3.4 Accent-on-accent / white

| Token | Value | Note |
|-------|--------|-----|
| `--accent-on-accent` | `rgba(255,255,255,1)` | Same as `#ffffff` / `--text-primary` value; different semantic role (text on accent). Keep separate name; can alias to same base. |

---

## 4. Single-use list

Tokens used **exactly once** (or 0 for unused). “Where” = file:line (or “definition only”).

| Token | Usage count | Where used |
|-------|-------------|------------|
| `--bg-app` | 1 | src/index.css:98 |
| `--column-bg` | 1 | src/screens/DebugPanelScreen.css:99 |
| `--bg-popover` | 1 | src/shared/ui/AppHeader.css:129 |
| `--bg-popover-surface` | 1 | src/components/MapboxMap.css:416 |
| `--bg-map-container` | 1 | src/components/MapWidget.css:13 |
| `--bg-neutral-900` | 1 | src/shared/ui/utilities.css:30 |
| `--bg-card-hover-alt` | 1 | src/shared/ui/Card.css:49 |
| `--bg-empty-route` | 1 | src/shared/ui/Card.css:121 |
| `--bg-empty-route-hover` | 1 | src/shared/ui/Card.css:128 |
| `--bg-overdue-hover` | 1 | src/shared/ui/Card.css:228 (overdue card hover — semantic state) |
| `--text-on-primary` | 1 | src/entities/RouteDraftCard.css:363 |
| `--text-on-primary-mobile` | 1 | src/screens/DashboardMobileMap.css:46 |
| `--text-secondary` | 1 | src/entities/RouteDraftCard.css:34 |
| `--text-secondary-more` | 1 | src/entities/RouteDraftCard.css:251 |
| `--link` | 1 | src/components/MapboxMap.css:233 |
| `--border-focus` | 1 | src/shared/ui/Card.css:129 |
| `--border-input` | 1 | src/screens/DebugPanelScreen.css:82 |
| `--border-table` | 1 | src/screens/DebugPanelScreen.css:175 |
| `--border-table-head` | 1 | src/screens/DebugPanelScreen.css:179 |
| `--danger` | 1 | src/components/MapboxMap.css:280 (pill bg) |
| `--danger-hsl` | 1 | src/shared/ui/Card.css:386 (text color) |
| `--danger-surface-subtle` | 1 | src/shared/ui/Card.css:385 |
| `--dot-bg` | 1 | src/shared/ui/Card.css:362 |
| `--accent-purple` | 1 | src/components/MapboxMap.css:472 (map view button) |
| **Unused (0)** | | |
| `--green` | 0 | definition only (src/index.css:74) |
| `--text-caption` | 0 | definition only (src/index.css:55) |
| `--danger-surface-hover` | 0 | definition only (src/index.css:82) |

**Single-use but semantic:**  
- `--bg-overdue-hover` — overdue state; recommend **KEEP** as state token (or merge with `--danger-surface-hover` and use one name).  
- `--danger`, `--danger-hsl` — same color, different formats; one can be alias.  
- `--accent-purple` — map-specific accent; keep or fold into “accent” palette with a role.

---

## Next step

Proceed to **Step 2**: create `/docs/COLOR_CLEANUP_PLAN.md` with a proposed minimal palette and KEEP / MERGE / DELETE for each token (no code changes).
