import { describe, expect, it } from 'vitest'
import { approvedMatch, googleQuery, normName, resultKm, townFromAddress } from './googleFind'
import { DIRECTORY } from './venues'

describe('googleQuery', () => {
  it('uses the category search words and the area', () => {
    expect(googleQuery('photographer', 'Antrim')).toBe('wedding photographer near Antrim, Northern Ireland')
  })
  it('lets the couple’s own words replace the category, adding "wedding" once', () => {
    expect(googleQuery('venue', 'Northern Ireland', 'barn')).toBe('wedding barn near Northern Ireland')
    expect(googleQuery('venue', '', 'Wedding barn')).toBe('Wedding barn near Northern Ireland')
  })
  it('caps the length', () => {
    expect(googleQuery('florist', 'x', 'y'.repeat(300)).length).toBeLessThanOrEqual(160)
  })
})

describe('approvedMatch', () => {
  const pinned = DIRECTORY.find((v) => v.kind === 'venue' && v.lat !== null && normName(v.name).length > 3)!
  it('matches a Google result to an approved venue by name and location', () => {
    const r = { name: pinned.name, address: `${pinned.address}, ${pinned.town}`, lat: pinned.lat! + 0.001, lng: pinned.lng! }
    expect(approvedMatch(r)?.id).toBe(pinned.id)
  })
  it('ignores the same name far away', () => {
    expect(approvedMatch({ name: pinned.name, lat: pinned.lat! + 0.5, lng: pinned.lng! })).toBeNull()
  })
  it('falls back to the town when there is no pin', () => {
    const list = [{ ...pinned, lat: null, lng: null }]
    expect(approvedMatch({ name: pinned.name, address: `1 Road, ${pinned.town} BT1 1AA` }, list)?.id).toBe(pinned.id)
    expect(approvedMatch({ name: pinned.name, address: '1 Road, Elsewhere' }, list)).toBeNull()
  })
  it('does not match on generic words alone', () => {
    expect(approvedMatch({ name: 'The Hotel', address: 'Belfast' })).toBeNull()
  })
})

describe('helpers', () => {
  it('normalises names', () => {
    expect(normName('The Galgorm Resort & Spa')).toBe('galgorm')
    expect(normName('Café Néo’s')).toBe('cafe neos')
  })
  it('extracts a town from a Google address', () => {
    expect(townFromAddress('136 Fenaghy Rd, Galgorm, Ballymena BT42 1EA, UK')).toBe('Ballymena')
    expect(townFromAddress('')).toBe('')
  })
  it('gives a distance only with a pin', () => {
    expect(resultKm({})).toBeNull()
    expect(resultKm({ lat: 54.6595, lng: -5.9084 })).toBeCloseTo(0)
  })
})
