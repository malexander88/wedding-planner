import { downloadText } from '../lib/csv'
import { useStore } from '../state/store'
import { useSync } from '../sync/SyncProvider'

/** Shown when a sharing link is opened on a phone that already has its own plan. */
export function JoinPrompt() {
  const { state } = useStore()
  const { pendingJoin, confirmJoin, cancelJoin } = useSync()
  if (!pendingJoin) return null

  if (pendingJoin.error || !pendingJoin.remote) {
    return (
      <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="join-title">
        <div className="modal">
          <div className="kicker">Sharing</div>
          <h2 id="join-title">Couldn’t open that link</h2>
          <p>{pendingJoin.error ?? 'Something went wrong.'}</p>
          <div className="btn-row">
            <button className="btn" type="button" onClick={cancelJoin}>OK</button>
          </div>
        </div>
      </div>
    )
  }

  const theirs = pendingJoin.remote.state.profile
  const names = [theirs.partnerAName, theirs.partnerBName].filter(Boolean).join(' & ') || 'your partner’s plan'

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="join-title">
      <div className="modal">
        <div className="kicker">Sharing</div>
        <h2 id="join-title">Join {names}?</h2>
        <p>
          This phone already has its own plan. Joining replaces it with the shared one, and from then on both phones stay in step.
          A copy of this phone’s plan is kept, and you can download it first.
        </p>
        <div className="btn-row">
          <button className="btn" type="button" onClick={() => void confirmJoin()}>Use the shared plan</button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => downloadText('wedding-planner-this-phone.json', JSON.stringify(state, null, 2), 'application/json')}
          >
            Download this phone’s plan
          </button>
          <button className="btn ghost" type="button" onClick={cancelJoin}>Not now</button>
        </div>
      </div>
    </div>
  )
}
