# Color Cleanup Plan

**Purpose:** Reduce color tokens to a minimal palette (neutrals + alphas + accents) without changing UI appearance.  
**No code changes** in this document — proposal only. Apply in Step 3 in small, approved batches.

---

## 1. Proposed minimal palette

Semantic naming kept. Values stay as-is; we only merge duplicate tokens and remove unused ones.

### 1.1 Neutrals (dark base)

| Token | Value | Role |
|-------|--------|------|
| `--bg` | `#0F1215` | Base app/canvas background (single source; replace `--bg-app` usage) |
| `--bg-surface` | `#22262B` | Cards, map area |
| `--bg-elevated` | `#34373C` | Elevated panels, merger line (JS) |
| `--bg-input` | `#212428` | Input fields |
| `--bg-popover` | `#131415` | Popover/dropdown (darkest) |
| `--bg-popover-surface` | `#282A2E` | Popover inner surface |
| `--bg-map-container` | `#292929` | Map widget container (⚠️ map-specific) |
| `--card-bg` | `#292d32` | Card default (very close to map-container; could merge later if desired) |
| `--bg-neutral-900` | `#111827` | Utilities (slightly blue tint; ⚠️ 1 use) |

### 1.2 White alphas (one scale, semantic aliases OK)

Keep semantic names; they can point to the same raw value where identical.

| Semantic token | Value | Note |
|----------------|--------|------|
| `--border-default` | `rgba(255,255,255,0.04)` | Border + column bg (alias for same value) |
| `--column-bg` | → MERGE to `--border-default` or keep alias | Same 0.04; different role (bg). Prefer: keep `--column-bg` as alias: `var(--border-default)` or keep value. |
| `--bg-hover-subtle` | `rgba(255,255,255,0.06)` | Hover bg |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Same 0.06; can alias to `--bg-hover-subtle` or keep both names → same value. |
| `--bg-chip` | `rgba(255,255,255,0.08)` | Chips, tags |
| `--border-strong` | `rgba(255,255,255,0.08)` | Same 0.08; can alias. |
| `--bg-ghost` | `rgba(255,255,255,0.10)` | Ghost buttons, list bg |
| `--border-dashed` | `rgba(255,255,255,0.10)` | Same 0.10; can alias. |
| `--bg-ghost-hover` | `rgba(255,255,255,0.12)` | Ghost hover |
| `--border-input` | `rgba(255,255,255,0.12)` | Same 0.12; can alias. |
| `--border-focus` | `rgba(255,255,255,0.14)` | Focus ring |
| `--border-hover` | `rgba(255,255,255,0.15)` | Hover border |

### 1.3 Text

| Token | Value | Role |
|-------|--------|------|
| `--text-primary` | `#ffffff` | Primary text |
| `--text-muted` | `rgba(255,255,255,0.4)` | Muted |
| `--text-tertiary` | `rgba(255,255,255,0.20)` | Tertiary |
| `--text-placeholder` | `rgba(255,255,255,0.5)` | Placeholder |
| `--text-secondary` | `rgba(255,255,255,0.6)` | Secondary (1 use) |
| `--text-secondary-hover` | `rgba(255,255,255,0.7)` | Secondary hover |
| `--text-secondary-more` | `rgba(255,255,255,0.8)` | Slightly stronger secondary (1 use) |
| `--text-on-primary` | `#272725` | Text on primary btn (desktop) |
| `--text-on-primary-mobile` | `#1a1a1a` | Text on primary btn (mobile) |
| `--link` | `#a78bfa` | Links (1 use, map) |
| `--accent-on-accent` | `#ffffff` | Text on accent/danger buttons (semantic alias for white) |

### 1.4 Accents & state

| Token | Value | Role |
|-------|--------|------|
| `--accent` | `#03ab00` | Primary green (success, CTA) |
| `--accent-glow` | `#B8FFB7` | Glow for route line (JS) |
| `--accent-purple` | `#7B00DF` | Map view button (⚠️ map-specific, 1 use) |
| `--danger` | `#E8306E` | Danger solid (buttons, pills) |
| `--danger-surface` | `#570F27` | Danger bg (cards, merger line JS) |
| `--danger-surface-subtle` | `rgba(232,48,110,0.20)` | Subtle danger bg |
| `--success-text` | `#47d37a` | Success text |
| `--success-surface-subtle` | `rgba(3,171,0,0.1)` | Subtle success bg |
| `--success-surface` | `rgba(46,204,113,0.18)` | Success surface |
| `--success-border` | `rgba(46,204,113,0.4)` | Success border |

### 1.5 State backgrounds (card hovers, overlay, overdue)

| Token | Value | Role |
|-------|--------|------|
| `--bg-card-hover` | `rgba(32,35,39,0.98)` | Card hover |
| `--bg-card-hover-alt` | `rgba(28,31,35,0.98)` | Card hover alt (1 use) |
| `--bg-empty-route` | `rgba(34,38,43,0.30)` | Empty route card (⚠️ 1 use) |
| `--bg-empty-route-hover` | `rgba(28,32,37,0.5)` | Empty route hover (⚠️ 1 use) |
| `--bg-overlay-highlight` | `rgba(255,255,255,0.3)` | Overlay highlight |
| `--bg-overdue-hover` | `rgba(58,10,26,0.98)` | Overdue card hover (state; keep) |

### 1.6 Special / gradients

| Token | Value | Role |
|-------|--------|------|
| `--bg-primary-btn` | `linear-gradient(0deg, #FAFAFA 0%, #FFF 100%)` | Primary button (⚠️ gradient — do not touch unless approved) |
| `--border-table` | `rgba(94,108,141,0.2)` | Debug table border |
| `--border-table-head` | `rgba(94,108,141,0.35)` | Debug table head |
| `--border-light` | `rgba(0,0,0,0.08)` | Light border (on light bg) |
| `--dot-bg` | → MERGE to `--bg-ghost` | Same as `--bg-ghost` (0.10) |
| `--text-shadow-dark` | `#202020` | Text shadow (map labels) |

---

## 2. Per-token decision (KEEP / MERGE / DELETE)

### Backgrounds

| Token | Decision | Target / reason |
|-------|----------|------------------|
| `--bg-app` | **MERGE** | → `--bg`. Same value `#0F1215`; 1 use (index.css). Replace with `var(--bg)`, remove token. |
| `--bg` | **KEEP** | Core palette. |
| `--column-bg` | **KEEP** (or alias) | Same value as `--border-default` (0.04). Option A: keep as-is. Option B: `--column-bg: var(--border-default)` and use for bg only (role stays semantic). |
| `--card-bg` | **KEEP** | Core. |
| `--bg-surface` | **KEEP** | Core. |
| `--bg-elevated` | **KEEP** | Core (+ JS). |
| `--bg-input` | **KEEP** | Core. |
| `--bg-popover` | **KEEP** | Core. |
| `--bg-popover-surface` | **KEEP** | Core. |
| `--bg-map-container` | **KEEP** | ⚠️ Map-specific; don’t merge with card-bg without approval. |
| `--bg-neutral-900` | **KEEP** | 1 use; semantic. |
| `--bg-chip` | **KEEP** | Core. |
| `--bg-hover-subtle` | **KEEP** | Core. |
| `--bg-ghost` | **KEEP** | Core. |
| `--bg-ghost-hover` | **KEEP** | Core. |
| `--bg-primary-btn` | **KEEP** | ⚠️ Gradient — do not change unless approved. |
| `--bg-card-hover` | **KEEP** | Core. |
| `--bg-card-hover-alt` | **KEEP** | 1 use; distinct value. |
| `--bg-empty-route` | **KEEP** | ⚠️ 1 use; semantic. |
| `--bg-empty-route-hover` | **KEEP** | ⚠️ 1 use; semantic. |
| `--bg-overlay-highlight` | **KEEP** | Core. |
| `--bg-overdue-hover` | **KEEP** | State; semantic. |

### Text

| Token | Decision | Target / reason |
|-------|----------|------------------|
| `--text-primary` | **KEEP** | Core. |
| `--text-muted` | **KEEP** | Core. |
| `--text-tertiary` | **KEEP** | Core. |
| `--text-placeholder` | **KEEP** | Core. |
| `--text-secondary` | **KEEP** | 1 use; semantic. |
| `--text-secondary-hover` | **KEEP** | Core. |
| `--text-secondary-more` | **KEEP** | 1 use; semantic. |
| `--text-caption` | **DELETE** | Unused (0). Remove from :root. |
| `--text-on-primary` | **KEEP** | Core. |
| `--text-on-primary-mobile` | **KEEP** | Core. |
| `--link` | **KEEP** | 1 use; semantic. |
| `--accent-on-accent` | **KEEP** | Semantic (text on accent/danger). Same value as white; keep name. |

### Borders

| Token | Decision | Target / reason |
|-------|----------|------------------|
| `--border-default` | **KEEP** | Core. |
| `--border-subtle` | **KEEP** | Same 0.06 as bg-hover-subtle; different role — keep. |
| `--border-strong` | **KEEP** | Core. |
| `--border-dashed` | **KEEP** | Core. |
| `--border-focus` | **KEEP** | Core. |
| `--border-hover` | **KEEP** | Core. |
| `--border-input` | **KEEP** | Core. |
| `--border-table` | **KEEP** | Debug panel. |
| `--border-table-head` | **KEEP** | Debug panel. |
| `--border-light` | **KEEP** | Core (light border). |

### Semantic / accent

| Token | Decision | Target / reason |
|-------|----------|------------------|
| `--accent` | **KEEP** | Core. |
| `--green` | **DELETE** | Unused (0); same as `--accent`. Remove from :root. |
| `--accent-glow` | **KEEP** | Used in JS (Mapbox). |
| `--accent-on-accent` | **KEEP** | Core. |
| `--accent-purple` | **KEEP** | ⚠️ Map; 1 use; keep unless you drop the control. |
| `--danger` | **KEEP** | Core. |
| `--danger-hsl` | **MERGE** | → `--danger`. Same color; 1 use (Card.css:386). Use `var(--danger)`, remove `--danger-hsl`. |
| `--danger-surface` | **KEEP** | Core. |
| `--danger-surface-subtle` | **KEEP** | Core. |
| `--danger-surface-hover` | **MERGE** | → `--bg-overdue-hover`. Same value; 0 uses. Define `--danger-surface-hover: var(--bg-overdue-hover)` and keep name for future use, or DELETE. Prefer: alias for consistency. |
| `--success-text` | **KEEP** | Core. |
| `--success-surface-subtle` | **KEEP** | Core. |
| `--success-surface` | **KEEP** | Core. |
| `--success-border` | **KEEP** | Core. |
| `--dot-bg` | **MERGE** | → `--bg-ghost`. Same value (0.10); 1 use. Replace with `var(--bg-ghost)`, remove token. |
| `--text-shadow-dark` | **KEEP** | Core. |

---

## 3. Risky / special items

- **Gradients:** `--bg-primary-btn` — do not change unless explicitly approved.
- **Map:** `--bg-map-container`, `--accent-purple` — map-specific; merge only with approval.
- **Debug:** `--border-table`, `--border-table-head` — keep for DebugPanel.
- **Single-use state:** `--bg-overdue-hover`, `--danger-surface-hover` (unused) — keep one name, alias the other if desired.

---

## 4. Suggested order for Step 3 (batches)

1. **Batch 1 — Unused tokens (safe):** DELETE `--green`, `--text-caption`; no reference changes.
2. **Batch 2 — Same value, one token:** MERGE `--bg-app` → `--bg` (replace 1 use, remove `--bg-app`).
3. **Batch 3 — Danger alias:** MERGE `--danger-hsl` → `--danger` (replace 1 use, remove `--danger-hsl`).
4. **Batch 4 — Dot bg:** MERGE `--dot-bg` → `--bg-ghost` (replace 1 use, remove `--dot-bg`).
5. **Batch 5 — Danger surface hover (unused):** Either DELETE `--danger-surface-hover` or add alias `--danger-surface-hover: var(--bg-overdue-hover)` (no usage changes).
6. **Optional later:** Alias `--column-bg` to `var(--border-default)` (same value, keeps semantic name); alias `--danger-surface-hover` to `var(--bg-overdue-hover)`.

After each batch: run build/lint, update `COLOR_MIGRATION_LOG.md`, wait for approval.
