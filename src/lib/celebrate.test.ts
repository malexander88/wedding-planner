import { describe, expect, it } from 'vitest'
import { completeStages, newlyComplete } from './celebrate'

describe('stage celebrations', () => {
  const t = (stage: string, done: boolean) => ({ stage, done })
  it('finds fully done stages only', () => {
    expect([...completeStages([t('vision', true), t('vision', true), t('venue', true), t('venue', false)])]).toEqual(['vision'])
    expect(completeStages([]).size).toBe(0)
  })
  it('reports stages that have just been finished', () => {
    const before = completeStages([t('vision', true), t('venue', false)])
    const after = completeStages([t('vision', true), t('venue', true)])
    expect(newlyComplete(before, after)).toEqual(['venue'])
    expect(newlyComplete(after, before)).toEqual([])
  })
})
