import { useState } from 'react'

/** Which partner uses this phone ('a' or 'b'). Stored per device, never synced. */
export const ME_KEY = 'wp-me'

export function readMe(): 'a' | 'b' {
  try {
    return localStorage.getItem(ME_KEY) === 'b' ? 'b' : 'a'
  } catch {
    return 'a'
  }
}

export function useMe(): ['a' | 'b', (m: 'a' | 'b') => void] {
  const [me, setMe] = useState<'a' | 'b'>(readMe)
  return [
    me,
    (m) => {
      setMe(m)
      try {
        localStorage.setItem(ME_KEY, m)
      } catch {
        /* private mode: fine for this session */
      }
    },
  ]
}

/** The other partner's name, as seen from this phone. */
export function partnerName(profile: { partnerAName: string; partnerBName: string }, me: 'a' | 'b'): string {
  return (me === 'a' ? profile.partnerBName : profile.partnerAName).trim() || 'Your partner'
}
