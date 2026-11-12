import { useState } from 'react'
import { addressesCsv, catererCsv, downloadText, guestsCsv } from '../../lib/csv'
import { guestCounts } from '../../data/guests'
import { useStore } from '../../state/store'
import { Sheet } from '../Sheet'

export function ExportSheet({ onClose }: { onClose: () => void }) {
  const { state } = useStore()
  const [contacts, setContacts] = useState(false)
  const c = guestCounts(state)
  return (
    <Sheet id="ex" kicker="Export" title="Download your guest list" onClose={onClose}>
      <p className="tiny">
        Files save to this device. Dietary needs are only included for guests who said that’s fine ({c.dietary} {c.dietary === 1 ? 'person' : 'people'}).
      </p>
      <div className="export-opts">
        <div className="export-opt">
          <div>
            <strong>Full guest list</strong>
            <p className="tiny">Everyone, with sides, groups, tags and invitation ticks.</p>
            <label className="inline tiny">
              <input type="checkbox" checked={contacts} onChange={(e) => setContacts(e.target.checked)} />
              Include private contact details (addresses, email, phone)
            </label>
          </div>
          <button className="btn secondary small" type="button" onClick={() => downloadText('wedding-guests.csv', guestsCsv(state, { contacts }), 'text/csv')}>
            Download
          </button>
        </div>
        <div className="export-opt">
          <div>
            <strong>For the caterer</strong>
            <p className="tiny">Names, day or evening, children, meals and consented dietary needs. No contact details.</p>
          </div>
          <button className="btn secondary small" type="button" onClick={() => downloadText('wedding-catering.csv', catererCsv(state), 'text/csv')}>
            Download
          </button>
        </div>
        <div className="export-opt">
          <div>
            <strong>Addresses for invitations</strong>
            <p className="tiny">Household names and postal addresses, for envelopes or a stationer. Private — share carefully.</p>
          </div>
          <button className="btn secondary small" type="button" onClick={() => downloadText('wedding-addresses.csv', addressesCsv(state), 'text/csv')}>
            Download
          </button>
        </div>
      </div>
    </Sheet>
  )
}
