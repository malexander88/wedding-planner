// Supabase settings for household sync.
//
// Only ever put the PUBLISHABLE key here (starts with `sb_publishable_`) or the
// legacy `anon` key. Both are public by design: they can only call the four
// sync functions in supabase/001_sync.sql and cannot read the table directly.
// Never paste a `service_role` or `sb_secret_` key — the app refuses to use one.
//
// Leave SUPABASE_ANON_KEY empty and the app runs offline-only, exactly as before.

export const SUPABASE_URL = 'https://edytqwcnxqqzxeepgdjn.supabase.co'
export const SUPABASE_ANON_KEY = ''

function jwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return (JSON.parse(json) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

export function isPrivilegedKey(key: string): boolean {
  return key.startsWith('sb_secret_') || jwtRole(key) === 'service_role'
}

export function isSyncConfigured(url = SUPABASE_URL, key = SUPABASE_ANON_KEY): boolean {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return false
  if (key.length < 20) return false
  if (isPrivilegedKey(key)) {
    console.error('Wedding Planner: refusing a privileged Supabase key. Use the publishable/anon key.')
    return false
  }
  return true
}
