import { useCallback, useState } from 'react'
import { parseJoin } from '../sync/secret'
import { useSync } from '../sync/SyncProvider'
import { canScanQr, QrScanner } from './QrScanner'

/** Paste a partner's link or scan their QR code. Joining goes through the usual checks
 *  (a phone with its own plan is asked first, and a copy of its plan is kept). */
export function JoinPartnerPanel({ cta = 'Join their plan' }: { cta?: string }) {
  const sync = useSync()
  const [paste, setPaste] = useState('')
  const [scanning, setScanning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const join = useCallback(
    async (text: string) => {
      setMsg(null)
      if (!parseJoin(text)) {
        setMsg('That doesn’t look like a sharing link. It should end with #join= and a long code.')
        return
      }
      const ok = await sync.joinWith(text)
      if (ok) setPaste('')
    },
    [sync],
  )

  const onScanned = useCallback(
    (link: string) => {
      setScanning(false)
      setPaste(link)
      void join(link)
    },
    [join],
  )

  if (!sync.configured) {
    return <p className="tiny">Sharing between phones isn’t available in this build yet.</p>
  }

  return (
    <div className="join-panel">
      {canScanQr() && (
        <button className="btn" type="button" onClick={() => setScanning(true)} disabled={sync.joining}>
          Scan their QR code
        </button>
      )}
      <label className="field" style={{ marginTop: 12 }}>
        <span>Or paste the link they sent you</span>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="https://…#join=…"
        />
      </label>
      <button className="btn secondary" type="button" onClick={() => void join(paste)} disabled={!paste.trim() || sync.joining}>
        {sync.joining ? 'Joining…' : cta}
      </button>
      {msg && <p className="tiny warn-text" role="alert">{msg}</p>}
      {scanning && <QrScanner onLink={onScanned} onClose={() => setScanning(false)} />}
    </div>
  )
}
