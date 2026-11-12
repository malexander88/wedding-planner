import { describe, expect, it } from 'vitest'
import { emptyState, newSupplier } from '../state/store'
import { comparableVenues, compareColumn, pickCompare } from './compare'
import { DIRECTORY } from './venues'

const idOf = (name: string) => DIRECTORY.find((d) => d.name === name)!.id

function plan() {
  const s = emptyState()
  s.profile.estimatedDayGuests = 120
  s.profile.date = '2027-06-19' // a Saturday
  const castle = newSupplier({ name: 'Belfast Castle', category: 'venue', catalogueId: idOf('Belfast Castle'), notes: 'Loved the view' })
  const galgorm = newSupplier({ name: 'Galgorm Resort and Spa', category: 'venue', catalogueId: idOf('Galgorm Resort and Spa') })
  const own = newSupplier({ name: 'Auntie’s Farm', category: 'venue', area: 'Lisburn' })
  const gone = { ...newSupplier({ name: 'Nope Hall', category: 'venue' }), status: 'rejected' as const }
  const cake = newSupplier({ name: 'Cakes', category: 'cake' })
  s.suppliers = [castle, galgorm, own, gone, cake]
  s.quotes = [
    { id: 'q1', supplierId: galgorm.id, label: 'Package', amount: 9000, vatIncluded: true, vatRate: 20, inclusions: '', exclusions: '', extrasNotes: '', hiddenExtras: {}, validUntil: '', receivedAt: '2026-10-01' },
    { id: 'q2', supplierId: galgorm.id, label: 'Revised', amount: 8500, vatIncluded: true, vatRate: 20, inclusions: '', exclusions: '', extrasNotes: '', hiddenExtras: {}, validUntil: '', receivedAt: '2026-11-01' },
  ]
  s.venueDates = [{ supplierId: castle.id, date: '2027-06-19', availability: 'available' }]
  return { s, castle, galgorm, own }
}

describe('venue compare', () => {
  it('only offers shortlisted venues that are not ruled out', () => {
    const { s } = plan()
    expect(comparableVenues(s).map((x) => x.name)).toEqual(['Belfast Castle', 'Galgorm Resort and Spa', 'Auntie’s Farm'])
  })
  it('uses the picked ids in order, max four, else the first three', () => {
    const { s, castle, galgorm, own } = plan()
    const all = comparableVenues(s)
    expect(pickCompare(all, [own.id, castle.id, own.id, 'missing']).map((x) => x.id)).toEqual([own.id, castle.id])
    expect(pickCompare(all, []).map((x) => x.id)).toEqual([castle.id, galgorm.id, own.id])
  })
  it('builds a column from checked facts, quotes, fees and availability', () => {
    const { s, castle, galgorm, own } = plan()
    const c = compareColumn(s, castle)
    expect(c.type).toBe('Castle')
    expect(c.distance).toMatch(/km from Newtownabbey$/)
    expect(c.fee.saturday).toBeGreaterThan(0)
    expect(c.fee.onDate).toBe(c.fee.saturday)
    expect(c.availability).toBe('available')
    expect(c.notes).toBe('Loved the view')
    expect(compareColumn(s, galgorm).price).toEqual({ amount: 8500, kind: 'quote' })
    const o = compareColumn(s, own)
    expect(o.distance).toBe('')
    expect(o.price).toBeNull()
    expect(o.availability).toBe('unknown')
  })
})
