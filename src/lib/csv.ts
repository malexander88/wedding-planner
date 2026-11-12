import { dietaryOf, guestName, householdOf, isComing, isDay } from '../data/guests'
import type { AppState, Household } from '../types'

function esc(v: string): string {
  // Spreadsheets run cells starting with = + - @ as formulas; a leading ' keeps a name a name.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function sideName(state: AppState, side: Household['side']): string {
  if (side === 'a') return `${state.profile.partnerAName || 'Partner 1'}'s`
  if (side === 'b') return `${state.profile.partnerBName || 'Partner 2'}'s`
  return 'Both'
}

const yes = (b: boolean) => (b ? 'yes' : 'no')
const table = (header: string[], rows: string[][]) => [header.join(','), ...rows.map((r) => r.map((v) => esc(String(v))).join(','))].join('\n')

/**
 * The full guest list. Dietary needs only appear for guests who consented. Contact details
 * (address, email, phone) are private and only included when asked for.
 */
export function guestsCsv(state: AppState, opts: { contacts?: boolean } = {}): string {
  const header = [
    'Household', 'First name', 'Last name', 'Side', 'Group', 'Day or evening', 'Child', 'Plus-one', 'Coming',
    'Meal', 'Dietary', 'Dietary consent', 'Tags', 'Save the date sent', 'Invitation sent', 'Travelling from', 'Notes',
    ...(opts.contacts ? ['Address', 'Postcode', 'Email', 'Phone'] : []),
  ]
  const rows = state.guests.map((g) => {
    const hh = householdOf(state, g)
    return [
      hh?.name ?? '',
      g.firstName,
      g.lastName,
      hh ? sideName(state, hh.side) : '',
      hh?.group ?? '',
      isDay(g) ? 'Day' : 'Evening',
      yes(g.child),
      yes(g.isPlusOne),
      isComing(g) ? 'yes' : 'no',
      g.meal,
      // Dietary needs are health data: only exported when the guest agreed to them being kept.
      dietaryOf(g),
      yes(g.dietaryConsent),
      (g.tags ?? []).join('; '),
      yes(!!hh?.saveDateSent),
      yes(!!hh?.inviteSent),
      g.travelFrom,
      g.notes,
      ...(opts.contacts ? [hh?.address ?? '', hh?.postcode ?? '', hh?.email ?? '', hh?.phone ?? ''] : []),
    ]
  })
  return table(header, rows)
}

/** For the caterer: who is eating, when, meal and (consented) dietary needs. No contact details. */
export function catererCsv(state: AppState): string {
  const header = ['Name', 'Day or evening', 'Child', 'Meal', 'Dietary']
  const rows = state.guests
    .filter(isComing)
    .map((g) => [guestName(g, state.guests), isDay(g) ? 'Day' : 'Evening', yes(g.child), g.meal, dietaryOf(g)])
  return table(header, rows)
}

/** Addresses for posting invitations: only when the couple explicitly asks for it. */
export function addressesCsv(state: AppState): string {
  const header = ['Household', 'Address', 'Postcode', 'Email', 'Invitation sent']
  const rows = state.households
    .filter((h) => state.guests.some((g) => g.householdId === h.id && isComing(g)))
    .map((h) => [h.name, h.address ?? '', h.postcode ?? '', h.email ?? '', yes(!!h.inviteSent)])
  return table(header, rows)
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
