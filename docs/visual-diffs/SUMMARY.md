# Color cleanup — visual verification summary

**Date:** 2026-02-19

## Changes applied

| Action | Token(s) | Visual impact |
|--------|----------|---------------|
| Removed (0 usages) | `--danger-surface-hover` | None — was alias of `--bg-overdue-hover` |
| Merged → canonical | `--text-secondary-more` → `--text-secondary-hover` | Negligible — one chip label: white alpha 0.8 → 0.7 (slightly dimmer) |
| Removed (only used by above) | `--white-80` | None — no direct usages |

## Screenshots

Generate with **Node 18+** after starting dev server:

```bash
npm run dev
VISUAL_DIFF_MODE=after npm run visual-diff
```

Files: `01-dashboard.png`, `02-debug-panel.png`, `03-mobile.png`, `04-dashboard-wide.png` in `docs/visual-diffs/after/`.

Before screenshots: run the same with `VISUAL_DIFF_MODE=before` from a commit before this cleanup.

## Conclusion

- No layout or logic changes.
- One low-usage token merged with negligible visual difference (secondary text alpha 0.8 → 0.7 in one place).
- Build/lint unchanged; no tests modified.
