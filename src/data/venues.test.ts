import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './catalogue'
import { COUNCILS, COUNCIL_IDS, feeForDate } from './legal'
import { venueFee } from './venueFee'
import data from './venues.generated.json'
import { DIRECTORY, HOME_BASE, directionsUrl, directoryVenue, distanceKm, formatKm, haversineKm, searchVenues } from './venues'

const starters = CATALOGUE.filter((c) => c.category === 'venue')

describe('venue directory', () => {
  it('loads every nidirect entry, merged with the starter list without duplicates', () => {
    expect(data.venues.length).toBeGreaterThanOrEqual(220)
    const ids = DIRECTORY.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
    // every starter keeps its own id (so existing shortlists still match) and its checked facts
    for (const s of starters) {
      const v = directoryVenue(s.id)
      expect(v, s.id).toBeDefined()
      expect(v!.checked).toBe(true)
      expect(v!.facts).toBe(s.note)
      expect(v!.factsSource?.url).toBe(s.sourceUrl)
    }
    // 17 starters replace their nidirect twin; Dunamoy (ANBC list only) is extra
    expect(DIRECTORY.length).toBe(data.venues.length + 1)
    const names = DIRECTORY.map((v) => `${v.name.toLowerCase().replace(/^the /, '')}|${v.town}`)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has a valid council and a Northern Ireland pin for every place', () => {
    for (const v of DIRECTORY) {
      expect(COUNCIL_IDS, v.id).toContain(v.council)
      expect(v.lat, v.id).not.toBeNull()
      expect(v.lat!).toBeGreaterThan(54)
      expect(v.lat!).toBeLessThan(55.35)
      expect(v.lng!).toBeGreaterThan(-8.25)
      expect(v.lng!).toBeLessThan(-5.35)
    }
    // all 11 councils are represented
    expect(new Set(DIRECTORY.map((v) => v.council)).size).toBe(11)
  })

  it('puts known places in the right council', () => {
    expect(directoryVenue('venue-belfast-castle')!.council).toBe('belfast')
    expect(directoryVenue('venue-dunadry')!.council).toBe('anbc')
    const enniskillen = DIRECTORY.find((v) => /enniskillen castle/i.test(v.name))
    expect(enniskillen?.council).toBe('fodc')
  })
})

describe('distance and search', () => {
  it('haversine is right for a known pair', () => {
    // Belfast City Hall to Antrim town centre is about 25 km in a straight line
    const km = haversineKm({ lat: 54.5964, lng: -5.9301 }, { lat: 54.7151, lng: -6.2192 })
    expect(km).toBeGreaterThan(22)
    expect(km).toBeLessThan(23.5)
    expect(haversineKm(HOME_BASE, HOME_BASE)).toBe(0)
    expect(formatKm(0.4)).toBe('under 1 km')
    expect(formatKm(7.26)).toBe('7.3 km')
    expect(formatKm(42.6)).toBe('43 km')
    expect(distanceKm({ lat: null, lng: null })).toBeNull()
  })

  it('sorts nearest first, hides registrar offices unless asked, and filters', () => {
    const all = searchVenues(DIRECTORY, {})
    expect(all.every((v) => v.kind === 'venue')).toBe(true)
    for (let i = 1; i < all.length; i++) expect(all[i].km!).toBeGreaterThanOrEqual(all[i - 1].km!)
    expect(all[0].km!).toBeLessThan(5)

    const withReg = searchVenues(DIRECTORY, { includeRegistrar: true })
    expect(withReg.length).toBe(DIRECTORY.length)

    const near = searchVenues(DIRECTORY, { maxKm: 10 })
    expect(near.length).toBeGreaterThan(5)
    expect(near.every((v) => v.km! <= 10)).toBe(true)

    const fodcCastles = searchVenues(DIRECTORY, { councils: ['fodc'], types: ['castle'] })
    expect(fodcCastles.length).toBeGreaterThan(0)
    expect(fodcCastles.every((v) => v.council === 'fodc' && v.type === 'castle')).toBe(true)

    const az = searchVenues(DIRECTORY, { sort: 'az' })
    const sorted = [...az].sort((a, b) => a.name.localeCompare(b.name, 'en-GB', { sensitivity: 'base' }))
    expect(az.map((v) => v.id)).toEqual(sorted.map((v) => v.id))
  })

  it('searches names, towns and councils, ignoring case and apostrophes', () => {
    expect(searchVenues(DIRECTORY, { q: 'shanes castle' }).map((v) => v.id)).toContain('venue-shanes-castle')
    expect(searchVenues(DIRECTORY, { q: 'TEMPLEPATRICK' }).length).toBeGreaterThanOrEqual(2)
    expect(searchVenues(DIRECTORY, { q: 'fermanagh' }).every((v) => v.council === 'fodc')).toBe(true)
    expect(searchVenues(DIRECTORY, { q: 'zzzz no such place' })).toEqual([])
  })

  it('capacity filter only hides places known to be too small', () => {
    const big = searchVenues(DIRECTORY, { minCapacity: 500 })
    const known = DIRECTORY.filter((v) => v.kind === 'venue' && v.capacity !== undefined && v.capacity < 500)
    expect(known.length).toBeGreaterThan(0)
    for (const k of known) expect(big.map((v) => v.id)).not.toContain(k.id)
    expect(big.length).toBe(searchVenues(DIRECTORY, {}).length - known.length)
  })

  it('directions use the exact pin only when it is better than the town', () => {
    const v = directoryVenue('venue-dunadry')!
    expect(directionsUrl({ ...v, geo: 'place' })).toContain(encodeURIComponent(`${v.lat},${v.lng}`))
    expect(directionsUrl({ ...v, geo: 'town' })).toContain(encodeURIComponent(v.name))
  })
})

describe('council fees for every area', () => {
  it('uses the venue’s own council, never a default', () => {
    const belfast = venueFee({ catalogueId: 'venue-belfast-castle', name: 'Belfast Castle', area: '' })
    expect(belfast.council).toBe('belfast')
    expect(belfast.band?.weekday).toBe(383)
    const derry = DIRECTORY.find((v) => v.council === 'dcsd' && v.kind === 'venue')!
    const f = venueFee({ catalogueId: derry.id, name: derry.name, area: '' })
    expect(f.council).toBe('dcsd')
    expect(f.band).toBeNull()
    expect(f.label).toMatch(/not published/)
  })

  it('registrar offices never borrow the approved-venue rate', () => {
    const office = DIRECTORY.find((v) => v.kind === 'registrar' && v.council === 'belfast')!
    const f = venueFee({ catalogueId: office.id, name: office.name, area: '' })
    expect(f.band).toBeNull()
    expect(f.label).toMatch(/registrar office/)
    // ...except ANBC's own published civic-centre rate
    expect(venueFee({ catalogueId: 'venue-antrim-civic', name: 'Antrim Civic Centre', area: '' }).band?.weekday).toBe(210)
  })

  it('handles councils without holiday or Sunday ceremonies', () => {
    const ccg = COUNCILS.ccg.approved!
    expect(feeForDate('2027-07-12', ccg)).toEqual({ amount: null, reason: 'no bank holiday ceremonies' })
    expect(feeForDate('2027-07-10', ccg).amount).toBe(ccg.saturday)
    const lcc = COUNCILS.lcc.approved!
    expect(feeForDate('2027-07-12', lcc)).toEqual({ amount: null, reason: 'ask the registrar' })
    expect(feeForDate('2027-07-11', COUNCILS.belfast.approved!)).toEqual({ amount: null, reason: 'no Sunday ceremonies' })
  })

  it('every council has a registrar phone and an official council source', () => {
    const official = /^https:\/\/(www\.|old\.)?(antrimandnewtownabbey\.gov\.uk|ardsandnorthdown\.gov\.uk|armaghbanbridgecraigavon\.gov\.uk|belfastcity\.gov\.uk|causewaycoastandglens\.gov\.uk|derrystrabane\.com|fermanaghomagh\.com|lisburncastlereagh\.gov\.uk|midandeastantrim\.gov\.uk|midulstercouncil\.org|newrymournedown\.org|nidirect\.gov\.uk)\//
    for (const id of COUNCIL_IDS) {
      expect(COUNCILS[id].registrarPhone, id).toMatch(/^0\d{2,3} \d{3,4} \d{4}$/)
      expect(COUNCILS[id].sourceUrl, id).toMatch(official)
    }
  })
})

describe('search ranking', () => {
  it('puts a name match ahead of nearer places that only match words', () => {
    const r = searchVenues(DIRECTORY, { q: 'enniskillen castle' })
    expect(r[0].name).toMatch(/Enniskillen Castle/)
    expect(r.length).toBeGreaterThan(1)
  })
})
