/**
 * Geocode addresses via Mapbox Geocoding API and save as JSON.
 * Usage: MAPBOX_TOKEN=pk.xxx node scripts/geocode-addresses.js
 * Output: src/data/addresses.json
 * Requires Node 18+ (fetch).
 */

import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DELAY_MS = 350
const SANCT_PETERBURG = 'Санкт-Петербург, Россия'

const ADDRESSES = [
  'Гороховая улица, 40',
  'Миллионная улица, 5',
  'улица Пестеля, 14',
  'улица Чайковского, 44',
  'Конюшенная площадь, 2',
  'Аптекарская набережная, 20',
  'улица Куйбышева, 21',
  'Большая Зеленина улица, 24',
  'Малая Посадская улица, 7/4',
  'улица Льва Толстого, 9',
  'улица Блохина, 15',
  'Съезжинская улица, 37',
  '9-я линия Васильевского острова, 34',
  'Средний проспект Васильевского острова, 36',
  'Наличная улица, 36к1',
  'улица Шевченко, 17',
  'улица Глинки, 2',
  'набережная Адмиралтейского канала, 2',
  'переулок Гривцова, 4',
  'Коломенская улица, 14',
  'Захарьевская улица, 23',
  'улица Моховая, 27-29',
  'Басков переулок, 12',
  'улица Маяковского, 3Б',
  'улица Некрасова, 58',
  'Лиговский проспект, 74',
  'улица Достоевского, 9',
  '2-я Советская улица, 12',
  'Новгородская улица, 23',
  'улица Тверская, 8',
  'Синопская набережная, 22',
  'улица Чапаева, 16',
  'Большой Сампсониевский проспект, 60',
  'проспект Обуховской Обороны, 120',
  'улица Моисеенко, 22',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function geocodeOne(token, address) {
  const query = encodeURIComponent(`${address}, ${SANCT_PETERBURG}`)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1&country=RU`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  const data = await res.json()
  const feature = data.features?.[0]
  if (!feature?.geometry?.coordinates) {
    throw new Error(`No result for: ${address}`)
  }
  const [lng, lat] = feature.geometry.coordinates
  return { address, coords: { lat, lng } }
}

async function main() {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN
  if (!token?.trim()) {
    console.error('Set MAPBOX_TOKEN or VITE_MAPBOX_ACCESS_TOKEN')
    process.exit(1)
  }

  const outPath = join(__dirname, '..', 'src', 'data', 'addresses.json')
  const results = []
  let failed = 0

  for (let i = 0; i < ADDRESSES.length; i++) {
    const address = ADDRESSES[i]
    try {
      const item = await geocodeOne(token, address)
      results.push(item)
      console.log(`[${i + 1}/${ADDRESSES.length}] ${address} → ${item.coords.lat.toFixed(4)}, ${item.coords.lng.toFixed(4)}`)
    } catch (err) {
      failed++
      console.error(`[${i + 1}/${ADDRESSES.length}] ${address} — ${err.message}`)
      results.push({ address, coords: null, error: err.message })
    }
    if (i < ADDRESSES.length - 1) await sleep(DELAY_MS)
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
  console.log(`\nWrote ${results.length} entries to ${outPath}`)
  if (failed) console.error(`${failed} address(es) failed. Fix or remove entries with "coords": null.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
