import { Link } from 'react-router-dom'
import { IconBack } from '../components/Icons'
import { SharingCard } from '../components/SharingCard'

/** One place to pair two phones: show this phone's QR code and link, or join the partner's plan. */
export function Pair() {
  return (
    <div className="grid pair-page">
      <header className="page-head">
        <Link to="/" className="text-btn back-link">
          <IconBack style={{ width: 16, height: 16 }} /> Home
        </Link>
        <h1>Pair with your partner</h1>
        <p>Plan together on two phones. One of you shows a QR code, the other scans it — or send the link instead.</p>
      </header>
      <SharingCard title="Your two phones" />
    </div>
  )
}
