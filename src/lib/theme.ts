// Appearance: light/dark (following the system unless overridden) and a curated accent colour.
// A per-device choice, kept in localStorage so index.html can apply it before first paint (no flash).

export type ThemePref = 'system' | 'light' | 'dark'
export type Accent = 'gold' | 'rose' | 'heather' | 'sage'

export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: 'gold', label: 'Gold', swatch: '#C9A55C' },
  { id: 'rose', label: 'Rose gold', swatch: '#C99482' },
  { id: 'heather', label: 'Heather', swatch: '#A88DB4' },
  { id: 'sage', label: 'Sage', swatch: '#9DB386' },
]
export const THEME_KEY = 'wp.theme'
export const ACCENT_KEY = 'wp.accent'
/** Browser bar colour per resolved theme. */
export const BAR_COLOUR = { light: '#1F3B2D', dark: '#0E1712' } as const

export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  return pref === 'dark' || (pref === 'system' && systemDark) ? 'dark' : 'light'
}

const isTheme = (v: unknown): v is ThemePref => v === 'system' || v === 'light' || v === 'dark'
const isAccent = (v: unknown): v is Accent => ACCENTS.some((a) => a.id === v)

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function getAppearance(): { theme: ThemePref; accent: Accent } {
  const t = read(THEME_KEY)
  const a = read(ACCENT_KEY)
  return { theme: isTheme(t) ? t : 'system', accent: isAccent(a) ? a : 'gold' }
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

export function applyAppearance(): void {
  const { theme, accent } = getAppearance()
  const resolved = resolveTheme(theme, systemDark())
  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.accent = accent
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOUR[resolved])
}

export function setAppearance(next: Partial<{ theme: ThemePref; accent: Accent }>): void {
  try {
    if (next.theme) localStorage.setItem(THEME_KEY, next.theme)
    if (next.accent) localStorage.setItem(ACCENT_KEY, next.accent)
  } catch {
    /* private mode: applies for this visit only */
  }
  applyAppearance()
  window.dispatchEvent(new Event('wp-appearance'))
}

/** Keep following the system while the preference is "system". Returns an unsubscribe. */
export function watchSystemTheme(): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const on = () => applyAppearance()
  mq.addEventListener?.('change', on)
  return () => mq.removeEventListener?.('change', on)
}
