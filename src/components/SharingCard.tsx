import { useState } from 'react'
import { JoinPartnerPanel } from './JoinPartnerPanel'
import { QrCode } from './QrCode'
import { useSync, type SyncStatus } from '../sync/SyncProvider'

function ago(iso: string | null): string {
  if (!iso) return ''
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s} seconds ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const STATUS_TEXT: Record<SyncStatus, { label: string; tone: string }> = {
  off: { label: 'Not switched on yet', tone: 'neutral' },
  unpaired: { label: 'Only on this phone', tone: 'neutral' },
  syncing: { label: 'Syncing…', tone: '' },
  synced: { label: 'Shared and up to date', tone: 'ok' },
  offline: { label: 'Offline — changes are saved here', tone: 'neutral' },
  error: { label: 'Will retry shortly', tone: 'warn' },
  revoked: { label: 'Link replaced', tone: 'warn' },
}

export function SharingCard({ title = 'Pair with your partner' }: { title?: string }) {
  const sync = useSync()
  const [copied, setCopied] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const st = STATUS_TEXT[sync.status]

  const copy = async () => {
    if (!sync.link) return
    try {
      await navigator.clipboard.writeText(sync.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const share = async () => {
    if (!sync.link || !navigator.share) return
    try {
      await navigator.share({ title: 'Our wedding plan', text: 'Open this on your phone to share our wedding plan:', url: sync.link })
    } catch {
      /* cancelled */
    }
  }

  return (
    <section className="card sharing">
      <div className="sec-head">
        <h2>{title}</h2>
        <span className={`pill ${st.tone}`}>{st.label}</span>
      </div>

      {!sync.configured && (
        <p>
          Sharing between your two phones is being set up. Until then everything stays on this phone, and you can still use the backup file below.
        </p>
      )}

      {sync.configured && !sync.paired && (
        <>
          <p>
            Keep one plan across both your phones — no accounts or passwords. One of you shares from this screen; the other scans the QR code
            or opens the link.
          </p>
          <div className="pair-choice">
            <div className="pair-option">
              <h3>Share this phone’s plan</h3>
              <p className="tiny">Makes a private link and QR code for your partner.</p>
              <button className="btn" type="button" onClick={() => void sync.startSharing()} disabled={sync.status === 'syncing'}>
                {sync.status === 'syncing' ? 'Setting up…' : 'Show our QR code and link'}
              </button>
            </div>
            <div className="pair-option" id="join-partner">
              <h3>Join your partner’s plan</h3>
              <p className="tiny">Already started on their phone? Scan their code or paste their link.</p>
              <JoinPartnerPanel />
            </div>
          </div>
        </>
      )}

      {sync.configured && sync.paired && sync.link && (
        <>
          {sync.status !== 'revoked' && (
            <div className="share-link">
              <QrCode value={sync.link} label="QR code for the sharing link" />
              <div className="share-copy">
                <p style={{ marginTop: 0 }}>
                  On your partner’s phone, open Wedding Planner and tap Join your partner’s plan → Scan their QR code, or send them the link. Anyone with this link can see and change the plan, so keep it between the two of you.
                </p>
                <input type="text" readOnly value={sync.link} aria-label="Sharing link" onFocus={(e) => e.currentTarget.select()} />
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn" type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</button>
                  {'share' in navigator && (
                    <button className="btn secondary" type="button" onClick={() => void share()}>Send…</button>
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="tiny" style={{ margin: '12px 0 0' }}>
            {sync.lastSyncedAt ? `Last synced ${ago(sync.lastSyncedAt)}.` : 'Not synced yet.'} Changes made offline are kept on this phone and sent when you are back online.
          </p>
          {sync.error && <p className="tiny warn-text" style={{ margin: '6px 0 0' }}>{sync.error}</p>}

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn secondary small" type="button" onClick={() => void sync.syncNow()} disabled={sync.status === 'syncing'}>
              Sync now
            </button>
            {sync.status !== 'revoked' && !confirmRotate && (
              <button className="btn ghost small" type="button" onClick={() => setConfirmRotate(true)}>
                Make a new link
              </button>
            )}
          </div>

          {confirmRotate && (
            <div className="notice" style={{ marginTop: 12 }}>
              <p style={{ marginTop: 0 }}>
                The current link will stop working straight away — including on your partner’s phone. You’ll need to send them the new one.
              </p>
              <div className="btn-row">
                <button
                  className="btn small"
                  type="button"
                  onClick={() => {
                    setConfirmRotate(false)
                    void sync.rotateLink()
                  }}
                >
                  Make a new link
                </button>
                <button className="btn ghost small" type="button" onClick={() => setConfirmRotate(false)}>Cancel</button>
              </div>
            </div>
          )}

          {sync.status === 'revoked' && (
            <div className="notice" style={{ marginTop: 12 }}>
              <p style={{ marginTop: 0 }}>This link was replaced. Scan or paste the new one from your partner’s phone.</p>
              <JoinPartnerPanel cta="Join again" />
            </div>
          )}

          <button className="text-btn quiet-action" type="button" onClick={() => void sync.stopSharing()}>
            Stop sharing on this phone
          </button>
        </>
      )}
    </section>
  )
}
