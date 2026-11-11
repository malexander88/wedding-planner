import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState } from '../state/store'
import type { AppState } from '../types'
import { MAX_BACKUPS, WipeRefusedError, _resetConnection, backupState, getBackups, indexedDbStorage, saveStateNow } from './indexeddb'

const real = (name = 'Matt'): AppState => {
  const s = emptyState()
  s.profile = { ...s.profile, partnerAName: name, partnerBName: 'Sam', onboardingComplete: true, totalBudget: 18000 }
  return s
}

beforeEach(async () => {
  _resetConnection()
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('wedding-planner')
    r.onsuccess = () => res()
    r.onerror = () => res()
  })
})

describe('guarded save', () => {
  it('refuses to overwrite a real saved plan with a blank one', async () => {
    await indexedDbStorage.setState(real())
    await expect(indexedDbStorage.setState(emptyState())).rejects.toBeInstanceOf(WipeRefusedError)
    expect((await indexedDbStorage.getState())?.profile.partnerAName).toBe('Matt')
  })
  it('the synchronous pagehide flush is guarded too', async () => {
    await indexedDbStorage.setState(real())
    expect(saveStateNow(emptyState())).toBe(true)
    await new Promise((r) => setTimeout(r, 20))
    expect((await indexedDbStorage.getState())?.profile.partnerAName).toBe('Matt')
  })
  it('allows a blank plan when nothing real is stored, or after an explicit erase', async () => {
    await indexedDbStorage.setState(emptyState())
    expect((await indexedDbStorage.getState())?.profile.onboardingComplete).toBe(false)
    await indexedDbStorage.setState(real())
    await indexedDbStorage.setState(emptyState(), { allowWipe: true })
    expect((await indexedDbStorage.getState())?.profile.partnerAName).toBe('')
  })
  it('real plans always save', async () => {
    await indexedDbStorage.setState(real('Matt'))
    await indexedDbStorage.setState(real('Matthew'))
    expect((await indexedDbStorage.getState())?.profile.partnerAName).toBe('Matthew')
  })
})

describe('rolling backups', () => {
  it('keeps the last few real plans, at most one per 10 minutes unless forced', async () => {
    const t0 = Date.parse('2026-11-11T12:00:00Z')
    expect(await backupState(emptyState(), { now: t0 })).toBe(false) // blank never backed up
    expect(await backupState(real('A'), { now: t0 })).toBe(true)
    expect(await backupState(real('B'), { now: t0 + 60_000 })).toBe(false) // too soon
    expect(await backupState(real('B'), { now: t0 + 60_000, force: true })).toBe(true)
    for (let i = 0; i < 8; i++) await backupState(real(`C${i}`), { now: t0 + (i + 1) * 11 * 60_000 })
    const list = await getBackups()
    expect(list).toHaveLength(MAX_BACKUPS)
    expect(list[0].state.profile.partnerAName).toBe('C7')
  })
})
