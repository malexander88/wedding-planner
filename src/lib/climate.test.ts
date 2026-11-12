import { describe, expect, it } from 'vitest'
import { compareToYear, dayIndex, oddsFor, summarise, sunsetLocal, yearsFor } from './climate'

function fakeDaily(years: number[], rain: (iso: string) => number) {
  const time: string[] = []
  const precipitation_sum: number[] = []
  const sunset: string[] = []
  for (const y of years) {
    for (let t = Date.UTC(y, 0, 1); t <= Date.UTC(y, 11, 31); t += 86400000) {
      const iso = new Date(t).toISOString().slice(0, 10)
      time.push(iso)
      precipitation_sum.push(rain(iso))
      sunset.push(`${iso}T${iso.slice(5, 7) === '06' ? '21:03' : '16:00'}`)
    }
  }
  return { time, precipitation_sum, sunset }
}

describe('climate', () => {
  it('indexes month-days on a leap calendar', () => {
    expect(dayIndex('2027-01-01')).toBe(0)
    expect(dayIndex('2028-02-29')).toBe(59)
    expect(dayIndex('2027-03-01')).toBe(60)
    expect(dayIndex('2027-12-31')).toBe(365)
  })
  it('uses the last 20 complete years', () => {
    expect(yearsFor(new Date('2026-11-12'))).toEqual({ from: 2006, to: 2025 })
  })
  it('counts rain in the ±3-day window across years', () => {
    // Rain every day in June only in even years → ~50% around mid-June, 0% in January.
    const s = summarise(fakeDaily([2020, 2021, 2022, 2023], (iso) => (iso.slice(5, 7) === '06' && Number(iso.slice(0, 4)) % 2 === 0 ? 6 : 0)), 54.6, -5.9, 2020, 2023)
    const june = oddsFor(s, '2027-06-15')!
    expect(june.rain).toBe(50)
    expect(june.wet).toBe(50)
    expect(oddsFor(s, '2027-01-15')!.rain).toBe(0)
    expect(compareToYear(s, '2027-06-15')).toBe('wetter')
    expect(compareToYear(s, '2027-01-15')).toBe('drier')
    expect(june.years).toBe('2020–2023')
  })
  it('turns UTC sunset into UK time for the target date, BST or GMT', () => {
    expect(sunsetLocal('2027-06-21', 21 * 60 + 3)).toBe('22:03')
    expect(sunsetLocal('2027-12-21', 16 * 60)).toBe('16:00')
  })
  it('fills 29 February sunset from the day before when no leap year had it', () => {
    const s = summarise(fakeDaily([2021, 2022, 2023], () => 0), 54.6, -5.9, 2021, 2023)
    expect(oddsFor(s, '2028-02-29')!.sunset).toBe('16:00')
  })
})
