import type { AppState, Task, WeddingProfile } from '../types'
import {
  LINKS,
  formatShort,
  noticeDueDate,
  noticeMinimumDate,
  scheduleFromDate,
  scheduleReturnDate,
} from './legal'

export const STAGES = [
  { id: 'vision', title: 'Set your vision', blurb: 'Agree the feel, the money and a rough guest number.' },
  { id: 'venue', title: 'Find a venue', blurb: 'Shortlist places that fit your area, style and numbers.' },
  { id: 'date', title: 'Compare dates', blurb: 'Weigh up Saturdays, weekdays, holidays and registrar fees.' },
  { id: 'book', title: 'Book the big pieces', blurb: 'Venue first, then photographer, video and music — they go quickly.' },
  { id: 'people', title: 'Sketch the guest list', blurb: 'Households, day and evening, plus-ones.' },
  { id: 'legal', title: 'Get the legal side ready', blurb: 'Northern Ireland notice, documents and the marriage schedule.' },
  { id: 'details', title: 'The details', blurb: 'Outfits, flowers, cake, transport and how the day will run.' },
]

type Spec = Omit<Task, 'id' | 'done'>

function spec(
  partial: Pick<Spec, 'key' | 'title' | 'stage'> & Partial<Omit<Spec, 'key' | 'title' | 'stage' | 'custom'>>,
): Spec {
  return { body: '', dueDate: '', officialUrl: '', officialLabel: '', legal: false, custom: false, ...partial }
}

export function generatedSpecs(profile: WeddingProfile): Spec[] {
  const items: Spec[] = [
    spec({
      key: 'vision-budget',
      title: 'Agree a working budget',
      body: 'Include a buffer of about 10–15% for extras such as VAT, corkage and overtime.',
      stage: 'vision',
    }),
    spec({
      key: 'vision-guests',
      title: 'Make a first-pass guest number',
      body: 'A rough day and evening count is enough to know which venues will fit.',
      stage: 'vision',
    }),
    spec({
      key: 'venue-shortlist',
      title: 'Shortlist venues in your area',
      body: 'Start with approved civil venues if you want the registrar to come to you. Look at council rooms, hotels and barns around Antrim, Newtownabbey and Belfast.',
      stage: 'venue',
      officialUrl: LINKS.anbcVenues,
      officialLabel: 'ANBC approved venues',
    }),
    spec({
      key: 'venue-viewings',
      title: 'Book viewings',
      body: 'Take your rough guest count and budget with you, and ask what is included.',
      stage: 'venue',
    }),
    spec({
      key: 'date-compare',
      title: 'Compare a few possible dates',
      body: 'Saturdays and public holidays cost more for the registrar in this borough, and popular venues fill those first.',
      stage: 'date',
    }),
    spec({
      key: 'book-venue',
      title: 'Book your venue',
      body: 'Read the contract for deposits, cancellation terms and what happens if guest numbers change. For a civil ceremony, check the registrar is free on that day too.',
      stage: 'book',
    }),
    spec({
      key: 'book-photo',
      title: 'Book a photographer (and videographer if you want one)',
      body: 'The popular ones are often reserved more than a year ahead.',
      stage: 'book',
    }),
    spec({
      key: 'book-music',
      title: 'Book a band, DJ or ceremony musicians',
      body: 'Check the venue’s finish time and any sound limits before you pay a deposit.',
      stage: 'book',
    }),
    spec({
      key: 'people-households',
      title: 'Start the guest list by household',
      body: 'Mark who is invited for the day and who is evening only, and name plus-ones when you can.',
      stage: 'people',
    }),
    spec({
      key: 'people-travel',
      title: 'Note who is travelling from Great Britain or further',
      body: 'They will need earlier save-the-dates, ferry or flight options, and hotel ideas.',
      stage: 'people',
    }),
    spec({
      key: 'legal-learn',
      title: 'Read how giving notice works in Northern Ireland',
      body: 'You give notice to the registrar in the district where you will marry, not necessarily where you live. That is different from England and Wales.',
      stage: 'legal',
      legal: true,
      officialUrl: LINKS.notice,
      officialLabel: 'nidirect: how and when to give notice',
    }),
    spec({
      key: 'legal-docs',
      title: 'Gather the documents for notice',
      body: 'Each of you needs the long birth or adoption certificate and a passport. Extra documents apply if either of you has been married or in a civil partnership before. Do not upload scans into this app — just tick this off when the originals are ready.',
      stage: 'legal',
      legal: true,
      officialUrl: LINKS.noticeForm,
      officialLabel: 'Download the GRO446 notice form',
    }),
    spec({
      key: 'legal-officiant',
      title: 'Speak to your officiant before filling in notice forms',
      body: 'For a religious or humanist ceremony the officiant needs to sign the forms, and must be registered with the Registrar General. For a civil ceremony, book the registrar early.',
      stage: 'legal',
      legal: true,
      officialUrl: LINKS.anbcMarriages,
      officialLabel: 'ANBC marriages page',
    }),
    spec({
      key: 'details-outfits',
      title: 'Start looking at outfits',
      body: 'A made-to-order outfit can take about six months, plus fittings.',
      stage: 'details',
    }),
    spec({
      key: 'details-flowers-cake',
      title: 'Shortlist a florist and a cake maker',
      body: 'These can wait a little longer than the venue and photographer, but popular names still book up.',
      stage: 'details',
    }),
    spec({
      key: 'details-insurance',
      title: 'Look at wedding insurance',
      body: 'Worth doing before you have paid many deposits.',
      stage: 'details',
    }),
  ]

  if (profile.date) {
    const rec = noticeDueDate(profile.date, profile.previouslyMarried)
    const min = noticeMinimumDate(profile.date)
    const schedFrom = scheduleFromDate(profile.date)
    const ret = scheduleReturnDate(profile.date)
    items.push(
      spec({
        key: 'legal-book-appointment',
        title: 'Book an appointment to give notice',
        body: `Antrim & Newtownabbey need an appointment. Newtownabbey is at Mossley Mill (028 9034 0180). Antrim Civic Centre is 028 9448 1315. Aim to have notice in around ${formatShort(rec)}. The absolute minimum is 28 days before (${formatShort(min)}), which is risky.`,
        stage: 'legal',
        legal: true,
        dueDate: rec,
        officialUrl: LINKS.newtownabbey,
        officialLabel: 'Newtownabbey registrar',
      }),
      spec({
        key: 'legal-give-notice',
        title: profile.previouslyMarried
          ? 'Give notice (recommended 10 weeks before)'
          : 'Give notice (recommended 8 weeks before)',
        body: `Both of you send a separate notice form to the registrar for the district where you will marry. The fee published on nidirect is £22 per form. Notice can only be given in the 12 months before the wedding and lasts 12 months. If an immigration check is needed, notice can stretch to 70 days.`,
        stage: 'legal',
        legal: true,
        dueDate: rec,
        officialUrl: LINKS.notice,
        officialLabel: 'nidirect: giving notice',
      }),
      spec({
        key: 'legal-schedule-collect',
        title: 'Collect the marriage schedule',
        body: `No ceremony can go ahead without it. It cannot be issued more than 14 days before the wedding (from ${formatShort(schedFrom)}) and only one of you can collect it — not a relative or friend. For a civil ceremony the registrar usually brings it.`,
        stage: 'legal',
        legal: true,
        dueDate: schedFrom,
        officialUrl: LINKS.religious,
        officialLabel: 'nidirect: the marriage schedule',
      }),
      spec({
        key: 'legal-witnesses',
        title: 'Ask two witnesses (aged 16 or over)',
        body: 'They sign the schedule with you and the officiant or registrar after the ceremony.',
        stage: 'legal',
        legal: true,
        dueDate: profile.date,
        officialUrl: LINKS.civil,
        officialLabel: 'nidirect: civil ceremony',
      }),
    )
    if (profile.ceremonyType === 'religious' || profile.ceremonyType === 'humanist') {
      items.push(
        spec({
          key: 'legal-schedule-return',
          title: 'Return the signed schedule within 3 days',
          body: `After a religious or humanist ceremony, take or post the signed schedule back to the issuing registrar by ${formatShort(ret)}. If it is not returned you cannot order a certified copy. Anyone can return it. After a civil ceremony the registrar keeps it.`,
          stage: 'legal',
          legal: true,
          dueDate: ret,
          officialUrl: LINKS.registration,
          officialLabel: 'nidirect: registering your marriage',
        }),
      )
    }
    items.push(
      spec({
        key: 'legal-certificates',
        title: 'Order extra marriage certificates if you need them',
        body: 'Useful if you plan to change a name or need several originals.',
        stage: 'legal',
        legal: true,
        dueDate: ret,
        officialUrl: LINKS.certificate,
        officialLabel: 'Order a marriage certificate',
      }),
      spec({
        key: 'people-savethedates',
        title: 'Send save-the-dates',
        body: 'Especially important if guests are travelling from Great Britain or further.',
        stage: 'people',
        dueDate: noticeDueDate(profile.date, false),
      }),
      spec({
        key: 'people-invites',
        title: 'Send invitations',
        body: 'About eight to ten weeks before is typical; earlier if people need to book travel. Ask for meal choices and dietary needs.',
        stage: 'people',
        dueDate: noticeDueDate(profile.date, false),
      }),
    )
  }

  return items
}

export function mergeTasks(state: AppState): Task[] {
  const specs = generatedSpecs(state.profile)
  const existing = new Map(state.tasks.map((t) => [t.key, t]))
  const merged: Task[] = specs.map((s) => {
    const prev = existing.get(s.key)
    return {
      ...s,
      id: prev?.id ?? `task_${s.key}`,
      done: state.taskDone[s.key] ?? prev?.done ?? false,
    }
  })
  for (const t of state.tasks) {
    if (t.custom && !merged.some((m) => m.key === t.key)) merged.push(t)
  }
  return merged
}

export function currentStage(state: AppState): string {
  const tasks = mergeTasks(state)
  for (const stage of STAGES) {
    const inStage = tasks.filter((t) => t.stage === stage.id)
    if (inStage.some((t) => !t.done)) return stage.id
  }
  return STAGES[STAGES.length - 1].id
}
