import { describe, expect, it } from 'vitest'
import { emptyState, newGuest } from '../state/store'
import { guestsCsv } from './csv'

describe('guest CSV export', () => {
  it('leaves dietary needs out unless the guest consented', () => {
    const s = emptyState()
    s.households = [{ id: 'h1', name: 'The Smiths' } as never]
    s.guests = [
      { ...newGuest('h1', 'Ann'), dietary: 'Coeliac', dietaryConsent: false },
      { ...newGuest('h1', 'Bob'), dietary: 'Vegetarian', dietaryConsent: true },
    ]
    const csv = guestsCsv(s)
    expect(csv).not.toContain('Coeliac')
    expect(csv).toContain('Vegetarian')
    const [header, ann] = csv.split('\n')
    const col = header.split(',').indexOf('Dietary')
    expect(ann.split(',')[col]).toBe('')
  })
})
