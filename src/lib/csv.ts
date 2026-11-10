import type { AppState } from '../types'

function esc(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function guestsCsv(state: AppState): string {
  const header = [
    'Household',
    'First name',
    'Last name',
    'Plus-one',
    'Child',
    'Day',
    'Evening',
    'RSVP',
    'Meal',
    'Dietary',
    'Dietary consent',
    'Travelling from',
    'Notes',
  ]
  const rows = state.guests.map((g) => {
    const hh = state.households.find((h) => h.id === g.householdId)
    return [
      hh?.name ?? '',
      g.firstName,
      g.lastName,
      g.isPlusOne ? 'yes' : 'no',
      g.child ? 'yes' : 'no',
      g.invitedTo.includes('day') ? 'yes' : 'no',
      g.invitedTo.includes('evening') ? 'yes' : 'no',
      g.rsvp,
      g.meal,
      g.dietary,
      g.dietaryConsent ? 'yes' : '',
      g.travelFrom,
      g.notes,
    ].map((v) => esc(String(v)))
  })
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
