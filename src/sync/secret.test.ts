import { describe, expect, it } from 'vitest'
import { buildJoinLink, generateSecret, isValidSecret, parseJoin } from './secret'
import { isPrivilegedKey, isSyncConfigured } from '../config/supabase'

describe('household secret', () => {
  it('is 32 random bytes as 43 base64url characters', () => {
    const s = generateSecret()
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateSecret()).not.toBe(s)
    expect(isValidSecret(s)).toBe(true)
  })

  it('parses links, hashes and bare secrets', () => {
    const s = generateSecret()
    const link = buildJoinLink(s, 'https://malexander88.github.io', '/wedding-planner/')
    expect(link).toBe(`https://malexander88.github.io/wedding-planner/#join=${s}`)
    expect(parseJoin(link)).toBe(s)
    expect(parseJoin(`#join=${s}`)).toBe(s)
    expect(parseJoin(`  ${s}  `)).toBe(s)
  })

  it('rejects short or malformed secrets', () => {
    expect(parseJoin('#join=abc')).toBeNull()
    expect(parseJoin('hello world')).toBeNull()
    expect(parseJoin('')).toBeNull()
  })
})

describe('supabase config guard', () => {
  const fakeJwt = (role: string) =>
    `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.sig`

  it('accepts publishable and anon keys', () => {
    expect(isSyncConfigured('https://edytqwcnxqqzxeepgdjn.supabase.co', 'sb_publishable_abcdefghijklmnopqrstuvwxyz')).toBe(true)
    expect(isSyncConfigured('https://edytqwcnxqqzxeepgdjn.supabase.co', fakeJwt('anon'))).toBe(true)
  })

  it('refuses service-role / secret keys and blanks', () => {
    expect(isPrivilegedKey('sb_secret_abcdefghijklmnopqrstuvwxyz')).toBe(true)
    expect(isPrivilegedKey(fakeJwt('service_role'))).toBe(true)
    const err = console.error
    console.error = () => undefined
    expect(isSyncConfigured('https://edytqwcnxqqzxeepgdjn.supabase.co', fakeJwt('service_role'))).toBe(false)
    console.error = err
    expect(isSyncConfigured('https://edytqwcnxqqzxeepgdjn.supabase.co', '')).toBe(false)
  })
})
