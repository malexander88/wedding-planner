// Calendar export (.ics, RFC 5545) for task deadlines.
// Each task keeps a stable UID, so importing a fresh file after dates change updates events in most calendar
// apps instead of adding copies. Only the task title, its advice text and a link back go into the calendar —
// never notes, guest details or money.

export interface CalEvent {
  uid: string
  date: string // YYYY-MM-DD, all-day
  title: string
  description?: string
  url?: string
  /** Reminders: days before at 09:00 (0 = on the day). */
  alarms?: number[]
}

const APP_URL = 'https://malexander88.github.io/wedding-planner/'
export const DEFAULT_ALARMS = [7, 0]

export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Fold to 75 octets per line (UTF-8 aware), continuation lines start with a space. */
export function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    const limit = out.length ? 74 : 75
    if (bytes + b > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join('\r\n ')
}

const ymd = (iso: string) => iso.replace(/-/g, '')
function nextDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}
function stamp(now: Date) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Trigger for 09:00 local on the day `daysBefore` days ahead of an all-day event (which starts at 00:00). */
export function alarmTrigger(daysBefore: number): string {
  if (daysBefore <= 0) return 'PT9H'
  // 09:00 N days before = start − N days + 9 hours = −((N−1) days 15 hours)
  return daysBefore === 1 ? '-PT15H' : `-P${daysBefore - 1}DT15H`
}

export function buildCalendar(events: CalEvent[], name: string, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Planner//Task deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
  ]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`,
      `SUMMARY:${escapeText(e.title)}`,
    )
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    lines.push('TRANSP:TRANSPARENT')
    for (const d of e.alarms ?? []) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(d ? `${e.title} — due in ${d === 7 ? 'a week' : `${d} days`}` : `${e.title} — due today`)}`,
        `TRIGGER:${alarmTrigger(d)}`,
        'END:VALARM',
      )
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export interface TaskLike {
  key: string
  title: string
  body?: string
  dueDate: string
  done?: boolean
  hidden?: boolean
  removed?: boolean
  legal?: boolean
}

export function taskEvent(t: TaskLike): CalEvent {
  const desc = [t.legal ? 'Legal step — check the official rules.' : '', t.body ?? '', `Open the plan: ${APP_URL}plan`].filter(Boolean).join('\n\n')
  return {
    uid: `task-${t.key}@wedding-planner.malexander88.github.io`,
    date: t.dueDate,
    title: `Wedding: ${t.title}`,
    description: desc,
    url: `${APP_URL}plan`,
    alarms: DEFAULT_ALARMS,
  }
}

/** Upcoming, not-done, visible tasks with a date (from today on), plus the wedding day itself. */
export function deadlineEvents(tasks: TaskLike[], today: string, wedding?: { date?: string; names: string }): { events: CalEvent[]; skippedPast: number } {
  const live = tasks.filter((t) => !t.done && !t.hidden && !t.removed && t.dueDate)
  const events = live.filter((t) => t.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(taskEvent)
  if (wedding?.date && wedding.date >= today)
    events.push({ uid: 'wedding-day@wedding-planner.malexander88.github.io', date: wedding.date, title: `${wedding.names} — wedding day`, url: APP_URL, alarms: [] })
  return { events, skippedPast: live.length - (events.length - (wedding?.date && wedding.date >= today ? 1 : 0)) }
}

/** Google Calendar "add event" link for one task (Google uses its own default reminders). */
export function googleCalendarUrl(e: CalEvent): string {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${ymd(e.date)}/${ymd(nextDay(e.date))}`, details: e.description ?? '' })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export function downloadIcs(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
