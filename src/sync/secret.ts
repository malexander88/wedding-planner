// Household secret: 32 random bytes as base64url (43 characters).
// The secret lives only on your two devices and inside the pairing link's
// #fragment, which browsers never send to a server.

const SECRET_RE = /^[A-Za-z0-9_-]{40,200}$/

export function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateSecret(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return toBase64Url(buf)
}

export function isValidSecret(s: unknown): s is string {
  return typeof s === 'string' && SECRET_RE.test(s)
}

/** Accepts a full link, a bare "#join=…" hash, or the secret itself. */
export function parseJoin(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  const m = text.match(/(?:^|[#&?])join=([A-Za-z0-9_-]+)/)
  const candidate = m ? m[1] : text
  return isValidSecret(candidate) ? candidate : null
}

export function buildJoinLink(secret: string, origin: string, basePath: string): string {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${origin}${base}#join=${secret}`
}

let pendingJoin: string | null = null

/** Read #join=… once at startup and strip it from the address bar and history. */
export function captureJoinFromLocation(): void {
  if (typeof window === 'undefined') return
  const secret = parseJoin(window.location.hash)
  if (!secret) return
  pendingJoin = secret
  const clean = window.location.pathname + window.location.search
  window.history.replaceState(window.history.state, '', clean)
}

export function takePendingJoin(): string | null {
  const s = pendingJoin
  pendingJoin = null
  return s
}
