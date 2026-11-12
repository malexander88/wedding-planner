import { describe, expect, it } from 'vitest'
import { bestMatch, keyWords, searchUrl, toMatch, type Establishment } from './hygiene'

const est = (name: string, type: string, pc: string, distance: number | null, extra: Partial<Establishment> = {}): Establishment => ({
  FHRSID: Math.floor(Math.random() * 1e6),
  BusinessName: name,
  BusinessType: type,
  PostCode: pc,
  RatingValue: '5',
  RatingDate: '2025-11-17T00:00:00',
  Distance: distance,
  ...extra,
})
const HOTEL = 'Hotel/bed & breakfast/guest house'

describe('food hygiene matching (cases from the live FHRS API)', () => {
  it('ignores generic words when searching', () => {
    expect(keyWords('Galgorm Resort and Spa')).toEqual(['galgorm'])
    expect(keyWords('The Hotel')).toEqual(['the', 'hotel'])
    expect(new URL(searchUrl({ name: 'The Mill at Ballydugan', lat: 54.3, lng: -5.7 })).searchParams.get('name')).toBe('ballydugan')
  })
  it('prefers the hotel over a takeaway with the same name', () => {
    const e = bestMatch({ name: 'Galgorm Resort and Spa', lat: 54.86, lng: -6.3, precise: true }, [
      est('Woodpecker Galgorm', 'Takeaway/sandwich shop', 'BT42 1EA', 0.129),
      est('Galgorm Spa & Golf Resort', HOTEL, 'BT42 1EA', 0.129),
      est('Galgorm Care Home', 'Caring Premises', 'BT42 1AA', 0.2),
    ])
    expect(e?.BusinessName).toBe('Galgorm Spa & Golf Resort')
  })
  it('rejects a same-word business too far from a precise pin', () => {
    expect(
      bestMatch({ name: 'Portstewart Golf Club', lat: 55.18, lng: -6.7, precise: true, postcode: 'BT55 7PG' }, [est('Portstewart Arms', 'Pub/bar/nightclub', 'BT55 7JW', 0.75)]),
    ).toBeNull()
    expect(
      bestMatch({ name: 'Portstewart Golf Club', lat: 55.18, lng: -6.7, precise: true, postcode: 'BT55 7PG' }, [
        est('Portstewart Arms', 'Pub/bar/nightclub', 'BT55 7JW', 0.75),
        est('Portstewart Golf Club (Bar)', 'Pub/bar/nightclub', 'BT55 7PG', 0.05),
      ])?.BusinessName,
    ).toBe('Portstewart Golf Club (Bar)')
  })
  it('picks the nearest food business when several share the word', () => {
    expect(
      bestMatch({ name: 'Belfast Castle', lat: 54.64, lng: -5.94, precise: true }, [
        est('Belfast City Mission', 'Restaurant/Cafe/Canteen', 'BT15 4JU', 0.84),
        est('Cellar at Belfast Castle', 'Restaurant/Cafe/Canteen', 'BT15 5GR', 0.002),
      ])?.BusinessName,
    ).toBe('Cellar at Belfast Castle')
  })
  it('caterers without a pin: Northern Ireland only, strong name match', () => {
    const q = { name: 'Mauds Catering', town: 'Belfast' }
    expect(bestMatch(q, [est('Mauds Ice Cream Parlour', 'Restaurant/Cafe/Canteen', 'SW1A 1AA', null)])).toBeNull()
    expect(bestMatch(q, [est('MAUDS', 'Mobile caterer', 'BT1 1AA', null, { AddressLine3: 'Belfast' })])?.BusinessName).toBe('MAUDS')
    expect(bestMatch({ name: 'Taste of Ulster Catering' }, [est('Ulster Fry Cafe', 'Restaurant/Cafe/Canteen', 'BT9 1AA', null)])).toBeNull()
  })
  it('maps a result to a link on the FSA site and hides placeholder dates', () => {
    const m = toMatch(est('Exempt Kiosk', 'Other catering premises', 'BT1 1AA', null, { FHRSID: 742493, RatingValue: 'Exempt', RatingDate: '1901-01-01T00:00:00' }))
    expect(m.url).toBe('https://ratings.food.gov.uk/business/742493')
    expect(m.ratedOn).toBe('')
  })
})
