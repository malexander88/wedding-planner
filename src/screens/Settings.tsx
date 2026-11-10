import { downloadText } from '../lib/csv'
import { emptyState, useStore } from '../state/store'
import type { AppState, CeremonyType, Season, StyleTag } from '../types'

export function Settings() {
  const { state, dispatch } = useStore()
  const p = state.profile

  const exportJson = () => {
    downloadText(
      'wedding-planner-backup.json',
      JSON.stringify(state, null, 2),
      'application/json',
    )
  }

  const importJson = async (file: File) => {
    const text = await file.text()
    const data = JSON.parse(text) as AppState
    if (data?.version !== 1 || !data.profile) {
      alert('That file does not look like a Wedding Planner backup.')
      return
    }
    if (confirm('Replace everything on this device with the backup?')) {
      dispatch({ type: 'importState', state: data })
    }
  }

  return (
    <div className="grid">
      <section className="card hero">
        <div className="kicker">Settings</div>
        <h1>Your wedding details</h1>
        <p>These shape the checklist, search buttons and budget. They stay on this device until cloud sharing is switched on.</p>
      </section>

      <section className="card">
        <h2>The basics</h2>
        <div className="grid-2">
          <label className="field">
            <span>Partner one</span>
            <input value={p.partnerAName} onChange={(e) => dispatch({ type: 'patchProfile', patch: { partnerAName: e.target.value } })} />
          </label>
          <label className="field">
            <span>Partner two</span>
            <input value={p.partnerBName} onChange={(e) => dispatch({ type: 'patchProfile', patch: { partnerBName: e.target.value } })} />
          </label>
          <label className="field">
            <span>Area</span>
            <input value={p.area} onChange={(e) => dispatch({ type: 'patchProfile', patch: { area: e.target.value } })} />
          </label>
          <label className="field">
            <span>Working budget (£)</span>
            <input type="number" value={p.totalBudget} onChange={(e) => dispatch({ type: 'patchProfile', patch: { totalBudget: Number(e.target.value) } })} />
          </label>
          <label className="field">
            <span>Season</span>
            <select value={p.season} onChange={(e) => dispatch({ type: 'patchProfile', patch: { season: e.target.value as Season } })}>
              <option value="any">No preference</option>
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="autumn">Autumn</option>
              <option value="winter">Winter</option>
            </select>
          </label>
          <label className="field">
            <span>Style</span>
            <select value={p.style} onChange={(e) => dispatch({ type: 'patchProfile', patch: { style: e.target.value as StyleTag } })}>
              <option value="classic">Classic</option>
              <option value="rustic">Rustic barn</option>
              <option value="garden">Garden</option>
              <option value="castle">Castle & historic</option>
              <option value="modern">Modern hotel</option>
              <option value="intimate">Intimate</option>
              <option value="other">Something else</option>
            </select>
          </label>
          <label className="field">
            <span>Ceremony</span>
            <select value={p.ceremonyType} onChange={(e) => dispatch({ type: 'patchProfile', patch: { ceremonyType: e.target.value as CeremonyType } })}>
              <option value="undecided">Not sure yet</option>
              <option value="civil">Civil</option>
              <option value="religious">Religious</option>
              <option value="humanist">Humanist / belief</option>
            </select>
          </label>
        </div>
        <label className="inline">
          <input type="checkbox" checked={p.previouslyMarried} onChange={(e) => dispatch({ type: 'patchProfile', patch: { previouslyMarried: e.target.checked } })} />
          Either of us has been married or in a civil partnership before
        </label>
        {p.date && (
          <p className="tiny" style={{ marginTop: 12 }}>
            Chosen date: {p.date}{' '}
            <button className="btn ghost small" type="button" onClick={() => dispatch({ type: 'setDate', date: undefined })}>
              Clear date
            </button>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p>Download a copy of everything on this phone, or restore one. This is how you can share with your partner until cloud sync is set up — send the file privately.</p>
        <div className="btn-row">
          <button className="btn" type="button" onClick={exportJson}>Download JSON backup</button>
          <label className="btn secondary">
            Restore from a file
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) importJson(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <p>
          Guest names, emails and dietary notes stay in this browser. Dietary needs can be sensitive — only store what the caterer needs,
          and do not upload passports or birth certificates here. Sharing between two phones and a public RSVP page will need a European cloud database (Supabase), which has not been connected yet.
        </p>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            if (confirm('Erase this wedding from this device? This cannot be undone unless you have a backup.')) {
              dispatch({ type: 'importState', state: emptyState() })
            }
          }}
        >
          Erase this device
        </button>
      </section>
    </div>
  )
}
