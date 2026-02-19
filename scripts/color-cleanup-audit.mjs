#!/usr/bin/env node
/**
 * Step 1: Audit CSS color tokens.
 * - Parse src/index.css :root for color tokens (exclude typography).
 * - Count var(--token) and getColorToken('--token') across repo.
 * - Resolve values; detect duplicates and near-duplicates.
 * Output: docs/COLOR_CLEANUP_REPORT.md
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INDEX_CSS = path.join(ROOT, 'src/index.css')
const DOCS = path.join(ROOT, 'docs')

const TYPOGRAPHY_TOKENS = new Set(['--font-family', '--type-subtitle', '--type-text', '--type-title'])
const GRADIENT_PATTERN = /linear-gradient|radial-gradient|gradient\(/

function parseTokenDefinitions(css) {
  const tokens = {}
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}(?=\s*(?:\.|\*|\[|:root|$))/m)
  if (!rootMatch) return tokens
  const block = rootMatch[1]
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(block)) !== null) {
    const name = '--' + m[1]
    if (TYPOGRAPHY_TOKENS.has(name)) continue
    const raw = m[2].trim()
    if (GRADIENT_PATTERN.test(raw)) continue // skip gradients
    tokens[name] = { raw }
  }
  return tokens
}

function resolveValue(raw, tokens) {
  const varMatch = raw.match(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/)
  if (varMatch) {
    const ref = varMatch[1]
    if (tokens[ref] && tokens[ref].resolved !== undefined) return tokens[ref].resolved
    if (tokens[ref]) return resolveValue(tokens[ref].raw, tokens)
  }
  return raw
}

function normalizeForCompare(value) {
  const v = value.trim().toLowerCase()
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    return { type: 'hex', r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
  }
  const rgba = v.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/)
  if (rgba) {
    return { type: 'rgb', r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] !== undefined ? +rgba[4] : 1 }
  }
  return null
}

function hexDistance(a, b) {
  if (!a || !b || a.type !== 'hex' && a.type !== 'rgb' || b.type !== 'hex' && b.type !== 'rgb') return Infinity
  const dr = (a.r - b.r) ** 2, dg = (a.g - b.g) ** 2, db = (a.b - b.b) ** 2
  const da = (a.a - b.a) ** 2
  return Math.sqrt(dr + dg + db + da * 255 * 255)
}

function collectUsages(dir, tokens) {
  const usage = {}
  for (const name of Object.keys(tokens)) usage[name] = []
  const varRe = /var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g
  const getColorRe = /getColorToken\s*\(\s*['"](--[a-zA-Z0-9-]+)['"]\s*\)/g

  function scan(content, filePath) {
    let m
    varRe.lastIndex = 0
    while ((m = varRe.exec(content)) !== null) {
      if (usage[m[1]] && usage[m[1]].length < 50) usage[m[1]].push({ file: filePath, line: (content.slice(0, m.index).match(/\n/g) || []).length + 1 })
    }
    getColorRe.lastIndex = 0
    while ((m = getColorRe.exec(content)) !== null) {
      if (usage[m[1]]) usage[m[1]].push({ file: filePath, line: (content.slice(0, m.index).match(/\n/g) || []).length + 1 })
    }
  }

  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.git') walk(full)
      } else if (/\.(css|ts|tsx|js|jsx)$/.test(e.name)) {
        const content = fs.readFileSync(full, 'utf8')
        scan(content, path.relative(ROOT, full))
      }
    }
  }
  walk(dir)
  return usage
}

function main() {
  const css = fs.readFileSync(INDEX_CSS, 'utf8')
  const tokens = parseTokenDefinitions(css)
  const tokenNames = Object.keys(tokens)

  for (const name of tokenNames) {
    let v = tokens[name].raw
    while (v && /var\(\s*--[a-zA-Z0-9-]+\s*\)/.test(v)) {
      const ref = v.match(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/)[1]
      v = tokens[ref] ? tokens[ref].raw : v
    }
    tokens[name].resolved = v
  }

  const usage = collectUsages(path.join(ROOT, 'src'), tokens)
  for (const name of tokenNames) {
    const combined = usage[name] || []
    const seen = new Set()
    tokens[name].usages = combined.filter(({ file, line }) => {
      const k = `${file}:${line}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    tokens[name].count = tokens[name].usages.length
  }

  const normalized = {}
  for (const name of tokenNames) {
    const r = tokens[name].resolved
    normalized[name] = normalizeForCompare(r)
  }

  const duplicates = []
  const nearDuplicates = []
  for (let i = 0; i < tokenNames.length; i++) {
    for (let j = i + 1; j < tokenNames.length; j++) {
      const a = tokenNames[i], b = tokenNames[j]
      const na = normalized[a], nb = normalized[b]
      if (!na || !nb) continue
      if (tokens[a].resolved === tokens[b].resolved) {
        duplicates.push([a, b])
        continue
      }
      if (na.type === 'rgb' && nb.type === 'rgb' && na.r === nb.r && na.g === nb.g && na.b === nb.b && Math.abs(na.a - nb.a) < 0.03) {
        nearDuplicates.push([a, b, `same RGB, alpha ${na.a} vs ${nb.a}`])
      } else if ((na.type === 'hex' || na.type === 'rgb') && (nb.type === 'hex' || nb.type === 'rgb')) {
        const d = hexDistance(na, nb)
        if (d < 5) nearDuplicates.push([a, b, `distance ${d.toFixed(1)}`])
      }
    }
  }

  let report = `# Color Cleanup Report (auto-generated)

**Generated:** ${new Date().toISOString()}
**Source:** \`src/index.css\` \`:root\` (color tokens only; typography and gradients excluded).

---

## 1. Token → value → usage count

| Token | Resolved value | Count | Rare (1–3)? |
|-------|----------------|-------|-------------|
`

  for (const name of tokenNames) {
    const t = tokens[name]
    const rare = t.count >= 1 && t.count <= 3 ? ' **rare**' : ''
    report += `| \`${name}\` | ${t.resolved.replace(/\|/g, '\\|')} | ${t.count} |${rare} |\n`
  }

  report += `\n---

## 2. File paths and line numbers (first 10+ per token)

`

  for (const name of tokenNames) {
    const list = (tokens[name].usages || []).slice(0, 15)
    report += `### \`${name}\`\n`
    if (list.length === 0) report += `- (no usages)\n`
    else list.forEach(({ file, line }) => { report += `- \`${file}:${line}\`\n` })
    report += '\n'
  }

  report += `---

## 3. Rare tokens (usage count 1–3)

`
  const rareList = tokenNames.filter(n => tokens[n].count >= 1 && tokens[n].count <= 3)
  for (const name of rareList) {
    report += `- \`${name}\` (${tokens[name].count}) — ${tokens[name].resolved}\n`
  }

  report += `\n---

## 4. Duplicates (exact same value)

`
  if (duplicates.length === 0) report += `None.\n`
  else duplicates.forEach(([a, b]) => { report += `- \`${a}\` = \`${b}\`\n` })

  report += `\n---

## 5. Near-duplicates (same RGB + close alpha, or small color distance)

`
  if (nearDuplicates.length === 0) report += `None.\n`
  else nearDuplicates.forEach(([a, b, note]) => { report += `- \`${a}\` ≈ \`${b}\` — ${note}\n` })

  fs.mkdirSync(DOCS, { recursive: true })
  fs.writeFileSync(path.join(DOCS, 'COLOR_CLEANUP_REPORT.md'), report, 'utf8')
  console.log('Wrote docs/COLOR_CLEANUP_REPORT.md')
}

main()
