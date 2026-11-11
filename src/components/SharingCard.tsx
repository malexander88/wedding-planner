import { useState } from 'react'
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

export function SharingCard() {
  const sync = useSync()
  const [copied, setCopied] = useState(false)
  const [paste, setPaste] = useState('')
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
        <h2>Sharing</h2>
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
            Keep one plan across both your phones — no accounts or passwords. This phone makes a private link; open it on your partner’s phone and you’re done.
          </p>
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => void sync.startSharing()} disabled={sync.status === 'syncing'}>
              {sync.status === 'syncing' ? 'Setting up…' : 'Share with my partner'}
            </button>
          </div>
          <details className="fold" style={{ marginTop: 12 }}>
            <summary>Got a link from your partner?</summary>
            <div className="fold-body">
              <label className="field">
                <span>Paste the link</span>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder="https://…#join=…"
                />
              </label>
              <button className="btn secondary" type="button" onClick={() => void sync.joinWith(paste).then((ok) => ok && setPaste(''))}>
                Join the shared plan
              </button>
            </div>
          </details>
        </>
      )}

      {sync.configured && sync.paired && sync.link && (
        <>
          {sync.status !== 'revoked' && (
            <div className="share-link">
              <QrCode value={sync.link} label="QR code for the sharing link" />
              <div className="share-copy">
                <p style={{ marginTop: 0 }}>
                  Scan this with your partner’s phone camera, or send them the link. Anyone with this link can see and change the plan, so keep it between the two of you.
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
            <details className="fold" open style={{ marginTop: 12 }}>
              <summary>Paste the new link</summary>
              <div className="fold-body">
                <input type="url" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="https://…#join=…" />
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <button className="btn" type="button" onClick={() => void sync.joinWith(paste)}>Join again</button>
                </div>
              </div>
            </details>
          )}

          <button className="text-btn quiet-action" type="button" onClick={() => void sync.stopSharing()}>
            Stop sharing on this phone
          </button>
        </>
      )}
    </section>
  )
}
