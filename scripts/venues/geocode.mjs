// Geocodes scripts/venues/nidirect.json once, at build time, with OpenStreetMap
// Nominatim (usage policy: max 1 request/second, identifying User-Agent, cache
// results). postcodes.io is used for entries that carry a postcode.
// Results are cached in scripts/venues/geocode-cache.json (committed), so re-runs
// only ask for new entries. Coordinates are © OpenStreetMap contributors (ODbL).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = import.meta.dirname
const UA = 'wedding-planner-build/1.0 (one-off venue geocoding; https://github.com/malexander88/wedding-planner)'
const cacheFile = resolve(dir, 'geocode-cache.json')
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}
const save = () => writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n')
const { entries } = JSON.parse(readFileSync(resolve(dir, 'nidirect.json'), 'utf8'))

const NI = { minLat: 54.0, maxLat: 55.35, minLng: -8.25, maxLng: -5.35 }
const inNI = (p) => p && p.lat > NI.minLat && p.lat < NI.maxLat && p.lng > NI.minLng && p.lng < NI.maxLng
const km = (a, b) => {
  const R = 6371, r = (d) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
let last = 0
async function polite() {
  const wait = last + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
}
async function nominatim(q) {
  const key = `nominatim:${q}`
  if (key in cache) return cache[key]
  await polite()
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=gb&viewbox=-8.25,55.35,-5.35,54.0&bounded=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB' } })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const json = await res.json()
  cache[key] = json.map((r) => ({
    lat: Number(r.lat), lng: Number(r.lon), type: `${r.category}/${r.type}`, name: r.name,
    road: r.address?.road ?? '', place: r.address?.town ?? r.address?.city ?? r.address?.village ?? r.address?.suburb ?? r.address?.hamlet ?? '',
    postcode: r.address?.postcode ?? '',
  }))
  save()
  return cache[key]
}
async function postcode(pc) {
  const key = `postcodes.io:${pc}`
  if (key in cache) return cache[key]
  await polite()
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, { headers: { 'User-Agent': UA } })
  const json = res.ok ? await res.json() : null
  cache[key] = json?.result ? { lat: json.result.latitude, lng: json.result.longitude, district: json.result.admin_district } : null
  save()
  return cache[key]
}

const COUNCIL_TOWN = { anbc: 'Antrim', andbc: 'Newtownards', abc: 'Craigavon', belfast: 'Belfast', ccg: 'Coleraine', dcsd: 'Derry', fodc: 'Enniskillen', lcc: 'Lisburn', mea: 'Ballymena', mu: 'Cookstown', nmd: 'Downpatrick' }
const townCache = {}
async function townPoint(town) {
  if (!town) return null
  if (town in townCache) return townCache[town]
  const r = (await nominatim(`${town}, Northern Ireland`)).find((x) => inNI(x))
  townCache[town] = r ? { lat: r.lat, lng: r.lng } : null
  return townCache[town]
}

const out = {}
let precise = 0, townOnly = 0, none = 0
for (const e of entries) {
  const anchor = (await townPoint(e.town)) ?? (await townPoint(COUNCIL_TOWN[e.council]))
  const radius = e.town ? 12 : 45
  const ok = (p) => inNI(p) && (!anchor || km(anchor, p) <= radius)
  let hit = null
  if (e.postcode) {
    const p = await postcode(e.postcode)
    if (ok(p)) hit = { ...p, precision: 'postcode' }
  }
  // Second-pass variants (OSM often names a place without "The" or the trailing "Hotel").
  const bare = e.name.replace(/^the\s+/i, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+(hotel|restaurant|bar|& spa|and spa|golf club|country club)$/i, '').trim()
  const queries = e.kind === 'registrar'
    ? [e.address ? `${e.address}, ${e.town}` : null, `${e.name}, ${e.town}`].filter(Boolean)
    : [
        `${e.name}, ${e.town || COUNCIL_TOWN[e.council]}`,
        e.town ? `${e.name}, ${e.town}, Northern Ireland` : `${e.name}, Northern Ireland`,
        bare !== e.name ? `${bare}, ${e.town || COUNCIL_TOWN[e.council]}` : null,
        `${e.name}`,
      ].filter(Boolean)
  // The looser variants (bare name, name only) must land within 6 km of the venue's own town.
  const strict = (p) => ok(p) && (!e.town || !anchor || km(anchor, p) <= 6)
  for (const [i, q] of (hit ? [] : queries).entries()) {
    // A street that happens to share the venue's name ("Riverdale Crescent") is not the venue.
    const named = (p) => (i >= 2 ? strict(p) : ok(p)) && !p.type.startsWith('highway/')
    const r = (await nominatim(q)).find(e.kind === 'registrar' && i === 0 ? ok : named)
    if (r) { hit = { lat: r.lat, lng: r.lng, precision: r.type.startsWith('highway/') ? 'postcode' : 'place', road: r.road, place: r.place, postcode: r.postcode }; break }
  }
  if (!hit && e.address && e.kind !== 'registrar') {
    const r = (await nominatim(`${e.address}, ${e.town}`)).find(ok)
    if (r) hit = { lat: r.lat, lng: r.lng, precision: 'postcode', road: r.road, place: r.place, postcode: r.postcode }
  }
  if (!hit && anchor) hit = { ...anchor, precision: 'town' }
  if (hit?.precision === 'town') townOnly++
  else if (hit) precise++
  else none++
  out[e.id] = hit ? { lat: +hit.lat.toFixed(5), lng: +hit.lng.toFixed(5), precision: hit.precision, road: hit.road ?? '', place: hit.place ?? '', postcode: hit.postcode ?? '' } : null
  process.stdout.write(`${hit ? hit.precision[0] : '-'} `)
}
writeFileSync(resolve(dir, 'geocoded.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`\ngeocoded ${entries.length}: ${precise} to the place, ${townOnly} to the town only, ${none} not found`)
