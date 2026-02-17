/**
 * Подставляет Mapbox-токен в index.html для деплоя.
 * Запуск: node scripts/set-mapbox-token.js
 *   — токен берётся из .env (VITE_MAPBOX_ACCESS_TOKEN)
 * Или: node scripts/set-mapbox-token.js pk.ваш_токен
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const indexPath = join(root, 'index.html')

function getToken() {
  const arg = process.argv[2]
  if (arg && arg.startsWith('pk.')) return arg.trim()
  if (process.env.VITE_MAPBOX_ACCESS_TOKEN) return process.env.VITE_MAPBOX_ACCESS_TOKEN.trim()
  try {
    const env = readFileSync(join(root, '.env'), 'utf8')
    const m = env.match(/VITE_MAPBOX_ACCESS_TOKEN\s*=\s*(.+)/m)
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch (_) {}
  return null
}

function escapeForJsString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

const token = getToken()
if (!token) {
  console.error('Токен не найден. Создайте .env с VITE_MAPBOX_ACCESS_TOKEN=pk... или передайте: node scripts/set-mapbox-token.js pk...')
  process.exit(1)
}

let html = readFileSync(indexPath, 'utf8')
const escaped = escapeForJsString(token)
html = html.replace(
  /(window\.__MAPBOX_ACCESS_TOKEN__\s*=\s*)['"][^'"]*['"]\s*;/,
  `$1'${escaped}';`
)
writeFileSync(indexPath, html)
console.log('Токен записан в index.html. Можно собирать и деплоить: npm run build')
