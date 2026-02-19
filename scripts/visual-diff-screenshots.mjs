#!/usr/bin/env node
/**
 * Capture screenshots for visual diff (before/after color cleanup).
 * Usage:
 *   VISUAL_DIFF_MODE=before node scripts/visual-diff-screenshots.mjs   # save to docs/visual-diffs/before/
 *   VISUAL_DIFF_MODE=after  node scripts/visual-diff-screenshots.mjs   # save to docs/visual-diffs/after/
 * Requires dev server running: npm run dev (default http://localhost:5173)
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MODE = process.env.VISUAL_DIFF_MODE || 'after'
const OUT_DIR = path.join(ROOT, 'docs', 'visual-diffs', MODE)
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 })
  } catch (e) {
    console.error('Failed to load app. Is the dev server running? (npm run dev)')
    console.error(e.message)
    await browser.close()
    process.exit(1)
  }

  await page.waitForTimeout(800)

  // 1. Dashboard (main)
  await page.screenshot({ path: path.join(OUT_DIR, '01-dashboard.png'), fullPage: false })
  console.log('Saved 01-dashboard.png')

  // 2. Debug panel (button text "Дебаг")
  await page.click('button:has-text("Дебаг")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT_DIR, '02-debug-panel.png'), fullPage: false })
  console.log('Saved 02-debug-panel.png')

  // 3. Back to dashboard, then mobile viewport
  await page.click('button:has-text("Дебаг")')
  await page.waitForTimeout(300)
  await context.setViewportSize({ width: 390, height: 700 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT_DIR, '03-mobile.png'), fullPage: false })
  console.log('Saved 03-mobile.png')

  // 4. Desktop dashboard again at full width
  await context.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(OUT_DIR, '04-dashboard-wide.png'), fullPage: false })
  console.log('Saved 04-dashboard-wide.png')

  await browser.close()
  console.log(`\nScreenshots written to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
