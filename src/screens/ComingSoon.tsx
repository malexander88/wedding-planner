import { Link } from 'react-router-dom'

const copy: Record<string, { title: string; body: string }> = {
  rsvp: {
    title: 'RSVP website',
    body: 'Next round: a page your guests can open from a link or QR code, with different details for day and evening guests, meals and dietary needs — no account needed.',
  },
  seating: {
    title: 'Seating plan',
    body: 'Next round: drag guests onto tables, keep people together or apart, and print a list for the venue. It will only seat people who have said yes.',
  },
  'run-sheet': {
    title: 'Day-of run sheet',
    body: 'Next round: the minute-by-minute plan. Bookings you make now already drop a placeholder row into the run sheet so nothing is lost.',
  },
  gifts: {
    title: 'Gifts and thank-yous',
    body: 'Next round: keep track of who gave what, and whether you have written to thank them.',
  },
  mood: {
    title: 'Mood board',
    body: 'Next round: save pictures and notes to share with your florist, stylist or venue.',
  },
  helpers: {
    title: 'Helpers',
    body: 'Next round: invite a parent or member of the wedding party to help with chosen jobs, without seeing everything (for example, not the budget).',
  },
}

export function ComingSoon({ kind }: { kind: keyof typeof copy }) {
  const item = copy[kind]
  return (
    <div className="card soon-page">
      <div className="mark">W</div>
      <h1>{item.title}</h1>
      <p>{item.body}</p>
      <p className="tiny">This first version focuses on finding a date, a venue and your key suppliers, then keeping the budget and guest list in one place.</p>
      <Link to="/" className="btn">Back home</Link>
    </div>
  )
}
