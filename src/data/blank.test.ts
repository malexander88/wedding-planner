import { describe, expect, it } from 'vitest'
import { emptyState } from '../state/store'
import { isBlankPlan, recordCount } from './blank'

describe('isBlankPlan', () => {
  it('the fresh default is blank; anything real is not', () => {
    const s = emptyState()
    expect(isBlankPlan(s)).toBe(true)
    expect(isBlankPlan(null)).toBe(true)
    expect(isBlankPlan({ ...s, profile: { ...s.profile, onboardingComplete: true } })).toBe(false)
    expect(isBlankPlan({ ...s, profile: { ...s.profile, partnerAName: 'Matt' } })).toBe(false)
    expect(isBlankPlan({ ...s, taskDone: { 'book-venue': true } })).toBe(false)
    expect(recordCount({ ...s, taskDone: { a: true, b: false } })).toBe(1)
  })
})
