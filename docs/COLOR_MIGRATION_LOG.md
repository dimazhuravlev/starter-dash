# Color token migration log

Two-layer token system migration. Old tokens were replaced with system tokens; raw palette (Layer 1) is for token definitions only, not direct use in components.

## Background / page

| Old token | New token |
|-----------|-----------|
| `--bg` | `--surface-0` |
| `--bg-surface` | `--surface-1` |
| `--bg-elevated` | `--surface-2` |

## Fill / surfaces

| Old token | New token |
|-----------|-----------|
| `--bg-chip` | `--fill-3` |
| `--bg-hover-subtle` | `--fill-2` |
| `--bg-ghost` | `--fill-4` |
| `--bg-overlay-highlight` | `--fill-5` |
| `--bg-card-hover-overlay` | `--overlay-hover` |
| `--white-04` (used as background) | `--fill-1` |

## Text

| Old token | New token |
|-----------|-----------|
| `--text-primary` | `--text-1` |
| `--text-secondary` | `--text-2` |
| `--text-tertiary` | `--text-3` |
| `--text-inverted` / `--text-on-primary` | `--text-inverted` (unchanged name) |

## Borders / strokes

| Old token | New token |
|-----------|-----------|
| `--border-default` | `--stroke-1` |
| `--border-subtle` | `--stroke-2` |
| `--border-dashed` | `--stroke-3` |

## Accent / status

| Old token | New token |
|-----------|-----------|
| `--success` | `--accent` |
| `--danger` | `--danger` (unchanged) |
| `--success-surface-subtle` | `--accent-surface` |
| `--danger-surface` (solid dark red background) | `--danger-surface-strong` |
| `--danger-surface-subtle` | `--danger-surface` |

## JS/TS getColorToken() updates

- `getColorToken('--bg-elevated')` → `getColorToken('--surface-2')`
- `getColorToken('--danger-surface')` → `getColorToken('--danger-surface-strong')`
- `getColorToken('--success')` → `getColorToken('--accent')`
- `getColorToken('--text-primary')` → `getColorToken('--text-1')`

## Removed (no longer defined)

- `--bg`, `--bg-surface`, `--bg-elevated`, `--bg-chip`, `--bg-hover-subtle`, `--bg-ghost`, `--bg-card-hover-overlay`, `--bg-overlay-highlight`
- `--text-primary`, `--text-secondary`, `--text-tertiary`
- `--border-default`, `--border-subtle`, `--border-dashed`
- `--success`, `--danger-surface`, `--danger-surface-subtle`, `--success-surface-subtle`

All usages were updated to the new system tokens. Gradients were left unchanged (still use `var(--fill-*)` where applicable).
