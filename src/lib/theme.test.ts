import { describe, expect, it } from 'vitest'
import { ACCENTS, resolveTheme } from './theme'

describe('appearance', () => {
  it('follows the system unless overridden', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('offers gold first plus a few curated accents', () => {
    expect(ACCENTS[0].id).toBe('gold')
    expect(ACCENTS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(ACCENTS.length)
  })
})
