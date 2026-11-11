// Parses the saved nidirect page (scripts/venues/nidirect-snapshot.html) into
// scripts/venues/nidirect.json. Re-fetch the snapshot with:
//   curl -sL -A "wedding-planner-build (github.com/malexander88/wedding-planner)" \
//     https://www.nidirect.gov.uk/articles/registration-office-venues-civil-marriage-and-civil-partnerships \
//     -o scripts/venues/nidirect-snapshot.html
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = import.meta.dirname
const html = readFileSync(resolve(dir, 'nidirect-snapshot.html'), 'utf8')
const updated = html.match(/article:modified_time" content="([^"]+)"|updated_time" content="([^"]+)"/)
const pageUpdated = (updated?.[1] || updated?.[2] || '').slice(0, 10)

const COUNCIL_IDS = {
  'Antrim and Newtownabbey': 'anbc',
  'Ards and North Down': 'andbc',
  'Armagh, Banbridge and Craigavon': 'abc',
  Belfast: 'belfast',
  'Causeway Coast and Glens': 'ccg',
  'Derry City and Strabane': 'dcsd',
  'Fermanagh and Omagh': 'fodc',
  'Lisburn and Castlereagh': 'lcc',
  'Mid and East Antrim': 'mea',
  'Mid Ulster': 'mu',
  'Newry, Mourne and Down': 'nmd',
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#039;|&#39;|&rsquo;/g, '’').replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'))
// Walk h2 / h3 / li in document order.
const tokens = [...main.matchAll(/<(h2|h3|h4|li)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], text: decode(m[2]) }))

const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[’'`]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const PHONE = /(?:Tel:?\s*)?((?:0\d|\+44)[\d\s/]{6,}\d)\s*$/
const out = []
let section = ''
let council = ''
for (const t of tokens) {
  if (t.tag === 'h2') { section = t.text; council = ''; continue }
  if (t.tag === 'h3' || t.tag === 'h4') { council = COUNCIL_IDS[t.text] ?? ''; continue }
  if (!council || !/District registrars|Venues approved/.test(section)) continue
  let line = t.text
  let phone = ''
  const pm = line.match(PHONE)
  if (pm) { phone = pm[1].trim(); line = line.slice(0, pm.index).trim() }
  line = line.replace(/[:\s]+$/, '').replace(/\s+Tel$/, '')
  if (/^Beaches maintained by council/i.test(line)) continue // not a single place; noted in the UI copy instead
  let postcode = ''
  const pc = line.match(/\b(BT\d{1,2}\s?\d[A-Z]{2})\b/)
  if (pc) postcode = pc[1]
  const registrar = /^Registrar[’']s Office/i.test(line)
  let name = line
  let town = ''
  if (registrar) {
    const place = line.split(',').slice(1).join(',').trim()
    town = place.replace(/^\d+\s+/, '') || (council === 'belfast' ? 'Belfast' : '')
    name = `Registrar’s office${place ? `, ${place}` : council === 'belfast' ? ', Belfast City Hall' : ''}`
    if (council === 'dcsd' && /Magazine/.test(place)) town = 'Derry'
    if (council === 'dcsd' && /Strabane/.test(place)) town = 'Strabane'
    if (council === 'andbc' && place === 'Ards') town = 'Newtownards'
  } else if (line.includes(',')) {
    const parts = line.split(',').map((s) => s.trim())
    town = parts.pop()
    name = parts.join(', ')
    if (postcode) town = town.replace(postcode, '').trim()
  }
  // Street addresses sometimes ride along in the name ("Hillmount House, 357 Old Glenarm Road").
  let address = ''
  if (!registrar) {
    const parts = name.split(',').map((x) => x.trim())
    const addrAt = parts.findIndex((x, i) => i > 0 && /^\d+[a-z]?\s/i.test(x))
    if (addrAt > 0) { address = parts.slice(addrAt).join(', '); name = parts.slice(0, addrAt).join(', ') }
    const inline = name.match(/^(.*?\))\s+(\d+\s.+)$/) // "WHOWHATWHEREWHENHOW (W5) 2 Queen’s Quay"
    if (inline) { name = inline[1]; address = inline[2] }
    if (/^(\d+ )?[A-Z][a-z]+ (Road|Street|Quay)/.test(town)) { address = town; town = '' }
  } else {
    const am = name.match(/,\s*(\d+\s[^,]+)/)
    if (am) address = am[1]
  }
  const FIX = { 'Enniskillen Caste': 'Enniskillen Castle' } // typo on the source page
  name = FIX[name] ?? name
  out.push({
    id: `nid-${slug(registrar ? `${council} ${name}` : name + (town ? ` ${town}` : ''))}`,
    name,
    town,
    council,
    phone,
    postcode,
    address,
    kind: registrar ? 'registrar' : 'venue',
    raw: t.text,
  })
}
// The MEA registrar block repeats two venues; keep the venue copy.
const seen = new Map()
for (const v of out) {
  const key = `${v.council}|${slug(v.name)}`
  if (seen.has(key)) { if (v.kind === 'venue') seen.set(key, v); continue }
  seen.set(key, v)
}
const list = [...seen.values()].filter((v, i, a) => !(v.kind === 'registrar' && !/Registrar/.test(v.name) && a.some((w) => w !== v && slug(w.name) === slug(v.name))))
// Registrar-section venues (Harbourview, Masonic Hall) are venues, not offices.
for (const v of list) if (v.kind === 'registrar' && !/^Registrar/.test(v.name)) v.kind = 'venue'
writeFileSync(resolve(dir, 'nidirect.json'), JSON.stringify({ pageUpdated, count: list.length, entries: list }, null, 1) + '\n')
console.log('parsed', out.length, 'lines →', list.length, 'unique;', list.filter((v) => v.kind === 'venue').length, 'venues,', list.filter((v) => v.kind === 'registrar').length, 'registrar offices; page updated', pageUpdated)
