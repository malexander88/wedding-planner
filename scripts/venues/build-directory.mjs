// Builds src/data/venues.generated.json from the parsed nidirect list and the
// cached geocodes. Run after parse-nidirect.mjs and geocode.mjs.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = import.meta.dirname
const { entries, pageUpdated } = JSON.parse(readFileSync(resolve(dir, 'nidirect.json'), 'utf8'))
const geo = JSON.parse(readFileSync(resolve(dir, 'geocoded.json'), 'utf8'))

/** Venue type from the name — a best guess, shown as such in the app. First match wins. */
const RULES = [
  ['registrar', (e) => e.kind === 'registrar'],
  ['castle', /\bcastle|castleward|caste\b/i],
  ['hotel', /hotel|\binn\b|resort|hilton|marriott|maldron|malmaison|crowne plaza|europa|merchant|clayton|everglades|da vinci|belfray|lansdowne|beechlawn|devenish|balmoral|ballymac|ivanhoe|la mon|burrendale|bishop's gate|ebrington|white horse|fir trees|silverbirch|killyhevlin|westville|mellon|greenvale|glenavon|terrace|ryandale|corick|canal court|flagstaff|millbrook|whistledown|tullyglass|leighinmohr|adair arms|rosspark|harbourview|bushtown|drummond|greys|hedges|marine|royal court|portrush atlantic|roe valley resort|lodge hotel|beech hill|seagoe|ashburn|bannville|belmont|lough erne|manor house country/i],
  ['club', /golf|yacht|social club|reform club|country club/i],
  ['restaurant', /restaurant|\bbar\b|deane|pot belly|pitchers|murphy|hugh mccann|sintons|halfway house|woodville arms|basil sheils|dog and duck|wild duck|windrose|old inn|brown ?trout|arcadia|harbour house/i],
  ['hall', /town hall|guildhall|waterfront|ulster hall|masonic|\bhall\b|civic|memorial|campus|college|university|kiltonga/i],
  ['culture', /museum|gaol|theatre|w5|whowhatwhere|titanic belfast|distillery|brewery|mill\b|studios|cultra|heritage|film|temple|arts|centre|conway|o’neill|o'neill|cottage, ?|jackson/i],
  ['barn', /barn|courtyard|field of dreams|cottages|farm|tully mill|old court/i],
  ['estate', /park|gardens|estate|woods|demesne|island|holiday complex|rossharbour|lusty beg|crom|valley/i],
  ['house', /house|manor|lodge|rectory|hall|cottage|limepark|altahammond|drenagh|ardtara|larchfield|brook hall|riddel|four trees|tullyveery|montalo|grace hall|hillmount|oranmore|lissan|parkanaur|blessingbourne|ballyscullion|killymoon|glenpark|an creagan|creagan|newforge|riverdale|stormont|kilmore|laragh|lissanoure|belle isle|florencecourt|castle coole|magheramorne|glenarm|ballygally|galgorm|hazelbank|brambles|rocky mountain|golf links house|old rectory|school house|delamont|finnebrogue/i],
]
const typeOf = (e) => {
  for (const [type, rule] of RULES) if (typeof rule === 'function' ? rule(e) : rule.test(e.name)) return type
  return 'other'
}

const out = entries.map((e) => {
  const g = geo[e.id]
  return {
    id: e.id,
    name: e.name,
    town: e.town || g?.place || '',
    address: e.address || g?.road || '',
    postcode: e.postcode || g?.postcode || '',
    council: e.council,
    phone: e.phone,
    kind: e.kind,
    type: typeOf(e),
    lat: g?.lat ?? null,
    lng: g?.lng ?? null,
    geo: g?.precision ?? null,
  }
})
const types = {}
for (const v of out) types[v.type] = (types[v.type] ?? 0) + 1
writeFileSync(
  resolve(dir, '../../src/data/venues.generated.json'),
  JSON.stringify({ source: 'https://www.nidirect.gov.uk/articles/registration-office-venues-civil-marriage-and-civil-partnerships', pageUpdated, checkedOn: '2026-11-11', venues: out }) + '\n',
)
console.log('wrote', out.length, 'places; types', types, '; geocoded', out.filter((v) => v.lat !== null).length, `(${out.filter((v) => v.geo === 'place' || v.geo === 'postcode').length} to the place)`)
