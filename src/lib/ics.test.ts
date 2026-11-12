import { describe, expect, it } from 'vitest'
import { alarmTrigger, buildCalendar, deadlineEvents, escapeText, fold, googleCalendarUrl, taskEvent } from './ics'

const now = new Date('2026-11-12T02:00:00Z')
describe('ics', () => {
  it('escapes text and folds long lines at 75 octets', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
    const long = 'DESCRIPTION:' + 'é'.repeat(80)
    const folded = fold(long)
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(long)
  })
  it('sets 9am alarms a week before and on the day', () => {
    expect(alarmTrigger(0)).toBe('PT9H')
    expect(alarmTrigger(1)).toBe('-PT15H')
    expect(alarmTrigger(7)).toBe('-P6DT15H')
  })
  it('builds a valid all-day calendar with stable UIDs', () => {
    const ics = buildCalendar([taskEvent({ key: 'book-photographer', title: 'Book the photographer', body: 'Popular ones go early, so book soon.', dueDate: '2027-02-28' })], 'Wedding deadlines', now)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics).toContain('UID:task-book-photographer@wedding-planner.malexander88.github.io')
    expect(ics).toContain('DTSTART;VALUE=DATE:20270228')
    expect(ics).toContain('DTEND;VALUE=DATE:20270301')
    expect(ics).toContain('DTSTAMP:20261112T020000Z')
    expect(ics).toContain('SUMMARY:Wedding: Book the photographer')
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })
  it('exports upcoming undone tasks plus the wedding day, and counts past ones it skipped', () => {
    const { events, skippedPast } = deadlineEvents(
      [
        { key: 'a', title: 'A', dueDate: '2026-12-01' },
        { key: 'b', title: 'B', dueDate: '2026-10-01' },
        { key: 'c', title: 'C', dueDate: '2027-01-01', done: true },
        { key: 'd', title: 'D', dueDate: '2027-01-02', hidden: true },
        { key: 'e', title: 'E', dueDate: '' },
      ],
      '2026-11-12',
      { date: '2027-06-19', names: 'Matt & Sam' },
    )
    expect(events.map((e) => e.title)).toEqual(['Wedding: A', 'Matt & Sam — wedding day'])
    expect(skippedPast).toBe(1)
  })
  it('makes a Google Calendar link for one task', () => {
    const u = new URL(googleCalendarUrl(taskEvent({ key: 'x', title: 'Give notice', dueDate: '2027-03-01' })))
    expect(u.hostname).toBe('calendar.google.com')
    expect(u.searchParams.get('dates')).toBe('20270301/20270302')
    expect(u.searchParams.get('text')).toBe('Wedding: Give notice')
  })
})
