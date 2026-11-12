import type { AppState, Supplier } from '../types'
import { formatLong } from '../data/legal'
import { planningNumbers } from '../data/guests'

export function draftEnquiry(state: AppState, supplier: Supplier): string {
  const p = state.profile
  // Only counts leave the app — never names, addresses or dietary details.
  const n = planningNumbers(state)
  const names = [p.partnerAName, p.partnerBName].filter(Boolean).join(' and ') || 'us'
  const dateLine = p.date
    ? `We are getting married on ${formatLong(p.date)}.`
    : p.candidateDates.length
      ? `We are comparing these dates: ${p.candidateDates.map(formatLong).join('; ')}.`
      : p.season === 'any'
        ? 'We have not settled on a date yet.'
        : `We are hoping for a ${p.season} wedding and have not fixed a date yet.`

  return `Subject: Wedding enquiry — ${names} — ${supplier.name}

Hello,

We are ${names}, and we are planning a wedding in the ${p.area || 'Belfast / Antrim / Newtownabbey'} area. ${dateLine}
We are expecting ${n.fromList ? '' : 'around '}${n.day || 80} day guests and ${n.fromList ? n.evening : n.evening || 40} extra evening guests${n.children ? `, including ${n.children} children` : ''}. The style we have in mind is ${p.style}.

We found you while looking for a ${supplier.category} and would love to know:

• whether you are available on the date (or dates) above
• what your packages include, and what is extra
• whether quotes include VAT
• your deposit and when the balance is due
• anything else we should budget for (corkage, overtime, supplier meals, travel)

We are happy to arrange a viewing or a call at a time that suits you.

Thank you,
${names}
`
}
