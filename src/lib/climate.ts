// Historical rain odds and sunset times for the date picker, from Open-Meteo's historical weather archive
// (ERA5 reanalysis; free, no key; CC BY 4.0 — credit shown on screen).
//
// These are HISTORICAL ODDS, not a forecast: for a date, we look at the same week (±3 days) in each of the
// last 20 complete years and count how often there was rain. The summary (a few KB) is cached on this
// device per area; nothing goes into the shared plan.

export interface ClimateSummary {
  v: 1
  lat: number
  lng: number
  from: number
  to: number
  /** Per day of a leap year (index 0 = 1 Jan … 365 = 31 Dec): % of days in the ±3-day window with ≥1 mm. */
  wet: number[]
  /** Same, with ≥5 mm (a properly wet day). */
  heavy: number[]
  /** Sunset in minutes after midnight UTC, from the most recent year with that date. */
  sunset: number[]
}

export interface DayOdds {
  /** % chance of at least some rain (≥1 mm) on the day, from history. */
  rain: number
  /** % chance of a properly wet day (≥5 mm). */
  wet: number
  /** Sunset in UK local time, e.g. "21:58". */
  sunset: string | null
  years: string
}

const WINDOW = 3
const DAYS = 366
const LEAP = 2024 // any leap year: gives every month-day an index

export function dayIndex(iso: string): number {
  const [, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(LEAP, m - 1, d) - Date.UTC(LEAP, 0, 1)) / 86400000)
}

export const yearsFor = (today = new Date()) => {
  const to = today.getFullYear() - 1
  return { from: to - 19, to }
}

export interface ArchiveDaily {
  time: string[]
  precipitation_sum: (number | null)[]
  sunset: (string | null)[]
}

/** Boil 20 years of daily data down to per-day-of-year odds. */
export function summarise(daily: ArchiveDaily, lat: number, lng: number, from: number, to: number): ClimateSummary {
  const rainByDay: number[][] = Array.from({ length: DAYS }, () => [])
  const sunset: number[] = new Array(DAYS).fill(-1)
  daily.time.forEach((iso, i) => {
    const k = dayIndex(iso)
    const mm = daily.precipitation_sum[i]
    if (typeof mm === 'number') rainByDay[k].push(mm)
    const s = daily.sunset[i]
    if (s) {
      const [h, mi] = s.slice(11, 16).split(':').map(Number)
      sunset[k] = h * 60 + mi // later years overwrite earlier ones
    }
  })
  const wet: number[] = []
  const heavy: number[] = []
  for (let k = 0; k < DAYS; k++) {
    let n = 0
    let w = 0
    let h = 0
    for (let o = -WINDOW; o <= WINDOW; o++) {
      for (const mm of rainByDay[(k + o + DAYS) % DAYS]) {
        n++
        if (mm >= 1) w++
        if (mm >= 5) h++
      }
    }
    wet.push(n ? Math.round((w / n) * 100) : -1)
    heavy.push(n ? Math.round((h / n) * 100) : -1)
  }
  // 29 Feb only exists in leap years: borrow 28 Feb's sunset if missing.
  for (let k = 0; k < DAYS; k++) if (sunset[k] < 0) sunset[k] = sunset[(k + DAYS - 1) % DAYS]
  return { v: 1, lat, lng, from, to, wet, heavy, sunset }
}

/** Sunset for a calendar date, in UK time (handles BST/GMT for that date). */
export function sunsetLocal(iso: string, utcMinutes: number): string | null {
  if (!(utcMinutes >= 0)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d, 0, utcMinutes))
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t)
}

export function oddsFor(s: ClimateSummary, iso: string): DayOdds | null {
  const k = dayIndex(iso)
  if (!(s.wet[k] >= 0)) return null
  return { rain: s.wet[k], wet: s.heavy[k], sunset: sunsetLocal(iso, s.sunset[k]), years: `${s.from}–${s.to}` }
}

/** How this date compares with the rest of the year in the same place (ERA5 odds sit in a narrow band). */
export function compareToYear(s: ClimateSummary, iso: string): 'drier' | 'typical' | 'wetter' | null {
  const k = dayIndex(iso)
  const all = s.wet.filter((x) => x >= 0)
  if (!(s.wet[k] >= 0) || !all.length) return null
  const mean = all.reduce((a, b) => a + b, 0) / all.length
  return s.wet[k] <= mean - 4 ? 'drier' : s.wet[k] >= mean + 4 ? 'wetter' : 'typical'
}

// ---- fetch + cache ------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10
const cacheKey = (lat: number, lng: number, from: number, to: number) => `wp.climate.v1|${lat},${lng}|${from}-${to}`
const inflight = new Map<string, Promise<ClimateSummary | null>>()

export function cachedClimate(lat0: number, lng0: number, today = new Date()): ClimateSummary | null {
  const { from, to } = yearsFor(today)
  try {
    const raw = localStorage.getItem(cacheKey(round1(lat0), round1(lng0), from, to))
    return raw ? (JSON.parse(raw) as ClimateSummary) : null
  } catch {
    return null
  }
}

export function loadClimate(lat0: number, lng0: number, fetcher: typeof fetch = fetch, today = new Date()): Promise<ClimateSummary | null> {
  const lat = round1(lat0)
  const lng = round1(lng0)
  const { from, to } = yearsFor(today)
  const key = cacheKey(lat, lng, from, to)
  const hit = cachedClimate(lat, lng, today)
  if (hit) return Promise.resolve(hit)
  const running = inflight.get(key)
  if (running) return running
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${from}-01-01&end_date=${to}-12-31&daily=precipitation_sum,sunset&timezone=GMT`
  const p = fetcher(url)
    .then(async (r) => {
      if (!r.ok) return null
      const j = (await r.json()) as { daily?: ArchiveDaily }
      if (!j.daily?.time?.length) return null
      const s = summarise(j.daily, lat, lng, from, to)
      try {
        // Drop older summaries for other areas/years so this never grows.
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i)
          if (k?.startsWith('wp.climate.') && k !== key) localStorage.removeItem(k)
        }
        localStorage.setItem(key, JSON.stringify(s))
      } catch {
        /* storage full: still use it this session */
      }
      return s
    })
    .catch(() => null)
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
