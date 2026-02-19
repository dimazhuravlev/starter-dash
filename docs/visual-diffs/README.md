# Visual diffs (color cleanup)

Screenshots for before/after color token cleanup. **Requires Node.js 18+** (Playwright).

## How to generate screenshots

1. Start the dev server: `npm run dev`
2. In another terminal:
   - **After cleanup (current):** `VISUAL_DIFF_MODE=after npm run visual-diff`
   - **Before cleanup:** Check out the commit before cleanup, run `VISUAL_DIFF_MODE=before npm run visual-diff`, then return to your branch.

Screenshots are saved under:
- `docs/visual-diffs/before/` — 01-dashboard.png, 02-debug-panel.png, 03-mobile.png, 04-dashboard-wide.png
- `docs/visual-diffs/after/` — same names.

## Pixel diff (optional)

With ImageMagick installed you can compare matching files:

```bash
for f in 01-dashboard 02-debug-panel 03-mobile 04-dashboard-wide; do
  compare -metric AE "docs/visual-diffs/before/${f}.png" "docs/visual-diffs/after/${f}.png" "docs/visual-diffs/diff-${f}.png" 2>&1 || true
done
```

## Cleanup summary (this run)

- **Removed tokens:** `--danger-surface-hover` (0 usages, was alias of `--bg-overdue-hover`), `--text-secondary-more`, `--white-80`.
- **Replacement:** The single use of `--text-secondary-more` (RouteDraftCard chip label) was merged into `--text-secondary-hover` (alpha 0.8 → 0.7). Visual change is negligible (slightly dimmer secondary text in one chip).
