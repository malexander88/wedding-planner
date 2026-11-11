// The built-in checklist: every task a Northern Ireland wedding usually needs,
// with a lead time worked back from the wedding date and the details template
// it uses when ticked. Keys are permanent — ticks, details and edits hang off them.
// Lead times follow common UK guidance (venue 12–18 months, photographer ~12,
// outfits 6–10, invitations ~8 weeks, final numbers ~3 weeks) — a starting point
// the couple can change per task.
//
// Legal steps that follow a rule (notice, schedule, certificates…) are dated in
// checklist.ts from the law, not from here.

import type { TemplateId } from '../types'

export interface Lead {
  /** Months before the wedding (negative = after). */
  m?: number
  /** Weeks before the wedding (negative = after). */
  w?: number
}

export interface CatalogueTask {
  key: string
  title: string
  stage: string
  /** Short advice shown under the task. */
  body: string
  lead?: Lead
  template: TemplateId
  preset?: Record<string, string>
  legal?: boolean
  officialUrl?: string
  officialLabel?: string
}

/** When this catalogue first shipped. Worked-out dates before it count as "catch up", not overdue. */
export const CATALOGUE_INTRODUCED = '2026-11-11'

const t = (
  key: string,
  stage: string,
  title: string,
  lead: Lead | undefined,
  template: TemplateId,
  body: string,
  extra: Partial<CatalogueTask> = {},
): CatalogueTask => ({ key, stage, title, lead, template, body, ...extra })

const cat = (category: string) => ({ preset: { category } })

export const CATALOGUE_TASKS: CatalogueTask[] = [
  // ---- vision ----
  t('vision-budget', 'vision', 'Agree your total budget', { m: 18 }, 'vision',
    'One overall figure for the day. The Budget tab fills up against it as you book things and note prices.'),
  t('vision-guests', 'vision', 'Make a first-pass guest number', { m: 18 }, 'vision',
    'A rough day and evening count is enough to know which venues will fit.'),
  t('vision-contributions', 'vision', 'Talk about who is contributing and how much', { m: 18 }, 'generic',
    'Agree early whether family are helping and whether that comes with expectations — it changes the guest list and the budget.'),
  t('vision-style', 'vision', 'Agree the feel of the day', { m: 17 }, 'research',
    'Big or small, town or country, daytime or late party. Save a few pictures you both like; it makes venue viewings quicker.'),
  t('vision-ceremony', 'vision', 'Decide on a civil, religious or humanist ceremony', { m: 16 }, 'generic',
    'It decides who marries you, where it can happen and which notice forms you need. Humanist ceremonies are legally recognised in Northern Ireland.'),
  t('vision-planner', 'vision', 'Decide whether you want a planner or on-the-day coordinator', { m: 15 }, 'booking',
    'Many venues include a coordinator; ask before paying for one.', cat('planner')),
  t('details-insurance', 'vision', 'Take out wedding insurance', { m: 15 }, 'admin',
    'Best done before you pay big deposits, so they are covered if a supplier goes out of business.', cat('insurance')),

  // ---- venue ----
  t('venue-shortlist', 'venue', 'Shortlist venues in your area', { m: 16 }, 'research',
    'Start with approved places if you want the registrar to come to you — Find lists every one in Northern Ireland.'),
  t('venue-viewings', 'venue', 'Book viewings', { m: 15 }, 'research',
    'Take your rough guest count and budget with you, and ask what is included.'),
  t('venue-questions', 'venue', 'Ask each venue the awkward questions', { m: 15 }, 'research',
    'Exclusive use? Finish time and noise limits? Corkage? Minimum numbers? What happens if numbers drop? Accessible rooms?'),

  // ---- date ----
  t('date-compare', 'date', 'Compare a few possible dates', { m: 15 }, 'decision',
    'Saturdays and bank holidays cost more for the registrar, and popular venues fill those first.'),
  t('date-registrar-free', 'date', 'Check the registrar or officiant is free on your date', { m: 14 }, 'generic',
    'Do this before signing the venue contract — a civil ceremony needs a registrar on the day.'),

  // ---- book the big pieces ----
  t('book-venue', 'book', 'Book your venue', { m: 14 }, 'booking',
    'Read the contract for deposits, cancellation terms and what happens if guest numbers change.', cat('venue')),
  t('book-officiant', 'book', 'Book the registrar or celebrant for the ceremony', { m: 13 }, 'booking',
    'For a civil ceremony the council books the registrar; for humanist or religious ceremonies book your celebrant or minister.', cat('officiant')),
  t('book-photo', 'book', 'Book a photographer', { m: 12 }, 'booking',
    'The popular ones are often reserved more than a year ahead.', cat('photographer')),
  t('book-video', 'book', 'Book a videographer (if you want one)', { m: 12 }, 'booking',
    'Many photographers work with a regular videographer and offer a joint price.', cat('videographer')),
  t('book-catering', 'book', 'Book catering (if the venue doesn’t provide it)', { m: 11 }, 'booking',
    'Ask about tastings, staffing, crockery hire and whether service charge is included.', cat('catering')),
  t('book-music', 'book', 'Book a band or DJ for the evening', { m: 11 }, 'booking',
    'Check the venue’s finish time and any sound limits before you pay a deposit.', cat('entertainment')),
  t('book-stationer', 'book', 'Choose a stationer (or decide to make your own)', { m: 10 }, 'booking',
    'Save-the-dates, invitations and on-the-day signs can all come from one place.', cat('stationery')),
  t('details-flowers-cake', 'book', 'Book a florist', { m: 9 }, 'booking',
    'Bring pictures and your colours; ask what can be reused from the ceremony to the reception.', cat('florist')),
  t('book-hair', 'book', 'Book a hair stylist', { m: 9 }, 'booking',
    'Good stylists book up for summer Saturdays; ask how many people they can do and by what time.', cat('hair')),
  t('book-makeup', 'book', 'Book a make-up artist', { m: 9 }, 'booking',
    'Check whether a trial is included and whether they’ll come to where you’re getting ready.', cat('makeup')),
  t('book-ceremony-music', 'book', 'Book ceremony musicians (or choose recorded music)', { m: 8 }, 'booking',
    'Civil ceremonies can’t include religious music or readings — check with the registrar.', cat('entertainment')),
  t('book-transport', 'book', 'Book wedding cars or transport', { m: 7 }, 'booking',
    'Plan the route and timings between ceremony, photos and reception.', cat('transport')),
  t('book-cake', 'book', 'Order your cake', { m: 6 }, 'booking',
    'Book a tasting; ask about delivery, set-up and a cake stand.', cat('cake')),
  t('book-decor', 'book', 'Book decor, styling and hire items', { m: 6 }, 'booking',
    'Chair covers, backdrops, lighting, signs — check what the venue already has.', cat('decor')),
  t('book-bar', 'book', 'Sort the drinks: venue package, corkage or a mobile bar', { m: 6 }, 'generic',
    'Work out welcome drinks, wine with the meal and the toast — they add up quickly.'),
  t('book-evening-food', 'book', 'Plan evening food', { m: 5 }, 'booking',
    'Usually needed for evening guests; venues often quote per head.', cat('catering')),
  t('book-guest-transport', 'book', 'Arrange a coach or taxis for guests', { m: 4 }, 'booking',
    'Worth it for rural venues — and for getting everyone home safely.', cat('transport')),

  // ---- people ----
  t('people-households', 'people', 'Start the guest list by household', { m: 12 }, 'guests',
    'Mark who is invited for the day and who is evening only, and name plus-ones when you can.'),
  t('people-children', 'people', 'Decide about children and plus-ones', { m: 12 }, 'generic',
    'Agree the rule early and tell people kindly and consistently.'),
  t('people-party', 'people', 'Ask your wedding party', { m: 12 }, 'generic',
    'Best man, bridesmaids, ushers, flower girls — whoever you want beside you.'),
  t('people-travel', 'people', 'Note who is travelling from Great Britain or further', { m: 11 }, 'guests',
    'They will need earlier save-the-dates, ferry or flight options, and hotel ideas.'),
  t('people-accommodation', 'people', 'Reserve a block of rooms for guests', { m: 10 }, 'admin',
    'Many hotels hold rooms at a group rate until a release date — note it so guests book in time.', cat('other')),
  t('people-website', 'people', 'Make a wedding website or information page', { m: 9 }, 'generic',
    'Times, directions, parking, dress code, rooms and the gift list in one place.'),
  t('people-gift-list', 'people', 'Set up a gift list or honeymoon fund', { m: 6 }, 'admin',
    'Have it ready before the invitations go out.', cat('other-gifts')),
  t('people-rsvp-chase', 'people', 'Chase missing replies', { w: 5 }, 'guests',
    'A friendly message a week after the reply date usually does it.'),
  t('people-seating', 'people', 'Draft the seating plan', { w: 4 }, 'generic',
    'Start with family tables, then group friends who know each other.'),
  t('people-final-numbers', 'people', 'Give final numbers to the venue and caterer', { w: 3 }, 'guests',
    'Most contracts set a deadline for final numbers — check yours.'),
  t('people-dietary', 'people', 'Send meal choices and dietary needs to the caterer', { w: 3 }, 'generic',
    'Only share what guests agreed to share. Mark allergies clearly.'),

  // ---- the details ----
  t('details-outfits', 'details', 'Choose your outfits', { m: 10 }, 'purchase',
    'A made-to-order outfit can take about six months, plus fittings.', cat('attire')),
  t('details-honeymoon', 'details', 'Book your honeymoon', { m: 9 }, 'admin',
    'Book in the name on your passport — change names after you travel if you’re changing one.', cat('other-honeymoon')),
  t('details-menu', 'details', 'Choose the menu (go to a tasting)', { m: 5 }, 'generic',
    'Ask about children’s meals, vegetarian and vegan options, and supplier meals.'),
  t('details-invitations', 'details', 'Design and order invitations', { m: 5 }, 'purchase',
    'Order a few spares; include the reply date, meal choices and dietary question.', cat('stationery')),
  t('details-decor', 'details', 'Plan table decor and centrepieces', { m: 5 }, 'generic',
    'Agree colours with the florist and the venue so everything matches.'),
  t('details-suits', 'details', 'Sort outfits for the wedding party', { m: 4 }, 'purchase',
    'Hire suits usually need ordering two to three months ahead.', cat('attire')),
  t('details-rings', 'details', 'Choose and order your rings', { m: 4 }, 'purchase',
    'Allow time for sizing and engraving.', cat('attire-rings')),
  t('details-favours', 'details', 'Choose favours', { m: 3 }, 'purchase',
    'Optional — plenty of couples skip them or give to charity instead.', cat('decor')),
  t('details-accessories', 'details', 'Shoes, accessories and something borrowed', { m: 3 }, 'purchase',
    'Wear the shoes in at home before the day.', cat('attire')),
  t('details-hair-trial', 'details', 'Hair and make-up trial', { m: 3 }, 'generic',
    'Take photos in daylight, and wear something with a similar neckline to the outfit.'),
  t('details-fittings', 'details', 'Outfit fittings', { m: 3 }, 'purchase',
    'Usually two or three; bring the shoes and underwear you’ll wear on the day.', cat('attire')),
  t('details-ceremony-plan', 'details', 'Plan the ceremony: readings, vows and music', { m: 3 }, 'generic',
    'Run readings past the registrar or celebrant — civil ceremonies can’t be religious.'),
  t('details-day-stationery', 'details', 'Order on-the-day stationery', { m: 2 }, 'purchase',
    'Menus, place cards, table names, the seating chart and signs.', cat('stationery')),
  t('details-speeches', 'details', 'Agree who’s giving speeches and in what order', { m: 2 }, 'generic',
    'Tell the venue so they can plan the meal around them.'),
  t('details-music-lists', 'details', 'Write your music lists', { m: 2 }, 'generic',
    'Entrance, signing, exit, first dance, must-plays and do-not-plays.'),
  t('details-photo-list', 'details', 'Write the must-have photo list', { w: 6 }, 'generic',
    'Group shots with names, and someone who knows the families to round them up.'),
  t('details-honeymoon-docs', 'details', 'Check passports and travel documents', { w: 6 }, 'admin',
    'Passports often need six months left; check visas and travel insurance.', cat('other-honeymoon')),
  t('details-supplier-timeline', 'details', 'Send everyone your timeline for the day', { w: 4 }, 'generic',
    'One running order with times, addresses and contact numbers for every supplier.'),
  t('details-weather', 'details', 'Make a wet-weather plan', { w: 4 }, 'generic',
    'It’s Northern Ireland. Umbrellas, an indoor photo spot and a backup for outdoor ceremonies.'),
  t('details-gifts-party', 'details', 'Buy thank-you gifts for the wedding party and parents', { w: 3 }, 'purchase',
    'Hand them out at the rehearsal or the morning of the wedding.', cat('other')),

  // ---- the last month ----
  t('final-balances', 'final', 'Pay supplier balances', { w: 4 }, 'generic',
    'Most balances fall due two to four weeks before — Budget shows what’s left to pay.'),
  t('final-confirm', 'final', 'Confirm times and addresses with every supplier', { w: 2 }, 'generic',
    'A short message to each one, with the timeline attached.'),
  t('final-rings-collect', 'final', 'Collect the rings and check sizes and engraving', { w: 2 }, 'generic',
    'Then give them to whoever is looking after them on the day.'),
  t('final-delegate', 'final', 'Hand over the day to someone you trust', { w: 1 }, 'generic',
    'Give them the contacts, the timeline and the envelopes for any final payments or tips.'),
  t('final-rehearsal', 'final', 'Rehearse the ceremony', { w: 1 }, 'generic',
    'Walk through entrances, readings and where everyone stands.'),
  t('final-pack', 'final', 'Pack an emergency kit and your bags', { w: 1 }, 'generic',
    'Plasters, safety pins, painkillers, phone chargers — and the honeymoon cases.'),

  // ---- after ----
  t('after-thankyous', 'after', 'Send thank-you cards', { m: -2 }, 'guests',
    'Within about two months; mention the gift and the person by name.'),
  t('after-name-change', 'after', 'Change your name (if you’re changing it)', { m: -1 }, 'admin',
    'Banks, HMRC, GP, passport, driving licence — you’ll need the marriage certificate.', cat('legal')),
  t('after-outfit-care', 'after', 'Get the outfits cleaned or stored', { m: -1 }, 'generic',
    'Return hire suits on time to avoid late fees.'),
  t('after-reviews', 'after', 'Leave reviews for your suppliers', { m: -1 }, 'generic',
    'It helps the next couple — and small businesses.'),
  t('after-album', 'after', 'Choose photos for the album', { m: -3 }, 'generic',
    'Most photographers deliver within a few months.'),
]
