// Thin client for the four RPCs in supabase/001_sync.sql (PostgREST /rpc).
// Uses only the publishable/anon key; no Supabase SDK needed.

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabase'
import type { WireDoc } from './merge'

export interface RemoteRow {
  ok: boolean
  found: boolean
  conflict?: boolean
  version?: number
  state?: unknown
  updated_at?: string
}

export class SyncHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function rpc(fn: string, body: Record<string, unknown>): Promise<RemoteRow> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  }
  // Legacy anon keys are JWTs and go in Authorization too; new publishable keys do not.
  if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      const j = (await res.json()) as { message?: string }
      if (j?.message) msg = j.message
    } catch {
      /* ignore */
    }
    throw new SyncHttpError(res.status, msg)
  }
  return (await res.json()) as RemoteRow
}

export const syncApi = {
  createHousehold: (secret: string, state: WireDoc) => rpc('create_household', { p_secret: secret, p_state: state }),
  getState: (secret: string) => rpc('get_state', { p_secret: secret }),
  putState: (secret: string, state: WireDoc, baseVersion: number) =>
    rpc('put_state', { p_secret: secret, p_state: state, p_base_version: baseVersion }),
  rotateSecret: (oldSecret: string, newSecret: string) =>
    rpc('rotate_secret', { p_old_secret: oldSecret, p_new_secret: newSecret }),
}
