import { AppearanceCard } from '../components/Appearance'
import { SharingCard } from '../components/SharingCard'
import { downloadText } from '../lib/csv'
import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { describePlan, isBlankPlan } from '../data/blank'
import { backupState, getBackups, getItem, type Backup } from '../storage/indexeddb'
import { useSync } from '../sync/SyncProvider'
import type { AppState, CeremonyType, Season, StyleTag } from '../types'

export function Settings() {
  const { state, dispatch } = useStore()
  const sync = useSync()
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
    if (isBlankPlan(data)) {
      alert('That backup is empty, so it was not loaded. Your plan is unchanged.')
      return
    }
    if (confirm('Replace everything on this device with the backup?')) {
      await backupState(state, { force: true }).catch(() => undefined)
      dispatch({ type: 'importState', state: data })
    }
  }

  return (
    <div className="grid">
      <header className="page-head">
        <div className="kicker">Settings</div>
        <h1>Your wedding details</h1>
        <p>
          These shape the checklist, search buttons and budget.{' '}
          {sync.paired ? 'Changes are shared with your partner’s phone.' : 'They stay on this phone until you switch on sharing.'}
        </p>
      </header>

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
            <span>Total budget (£)</span>
            <input type="number" min={0} placeholder="Not set" value={p.totalBudget || ''} onChange={(e) => dispatch({ type: 'patchProfile', patch: { totalBudget: Math.max(0, Number(e.target.value) || 0) } })} />
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

      <SharingCard />

      <AppearanceCard />

      <section className="card">
        <h2>Backup</h2>
        <p>Download a copy of everything on this phone, or restore one from a file.</p>
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

      <BackupsCard />

      <section className="card">
        <h2>Privacy</h2>
        <ul className="plain-list">
          <li>Everything is saved on this phone first, so the app works offline.</li>
          <li>
            When sharing is on, your plan is also stored with Supabase in its EU London region, so both phones see the same thing.
            There are no accounts — only someone with your sharing link can see or change the plan, so keep the link between the two of you.
          </li>
          <li>Guest details are never shared with anyone else, and never sold.</li>
          <li>Only note dietary needs with the guest’s consent, and only what the caterer needs. Don’t store passports or birth certificates here.</li>
        </ul>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            if (confirm(sync.paired
              ? 'Erase this wedding from this phone? It is shared, so this will also clear it on your partner’s phone the next time they sync. Use “Stop sharing on this phone” first if you only want to clear this phone.'
              : 'Erase this wedding from this device? This cannot be undone unless you have a backup.')) {
              void backupState(state, { force: true })
                .catch(() => undefined)
                .then(() => dispatch({ type: 'eraseAll' }))
            }
          }}
        >
          Erase this device
        </button>
      </section>
    </div>
  )
}

function BackupsCard() {
  const { state, dispatch } = useStore()
  const { paired } = useSync()
  const [backups, setBackups] = useState<(Backup & { label?: string })[] | null>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      const list: (Backup & { label?: string })[] = await getBackups().catch(() => [])
      const pre = await getItem<Backup>('preJoinBackup').catch(() => null)
      if (pre?.state && !isBlankPlan(pre.state)) list.push({ ...pre, label: 'Before joining a shared plan' })
      if (live) setBackups(list)
    })()
    return () => {
      live = false
    }
  }, [state.updatedAt])
  if (!backups?.length) return null
  return (
    <section className="card">
      <h2>Restore a backup</h2>
      <p className="tiny">
        This phone keeps the last {backups.length > 1 ? `${backups.length} versions` : 'version'} of your plan, taken at most every 10 minutes and
        before erasing or importing. Restoring replaces the plan{' '}
        {paired ? 'on both phones' : 'on this phone'}; the current one is backed up first.
      </p>
      <div className="list">
        {backups.map((b, i) => (
          <div className="row" key={`${b.savedAt}-${i}`} style={{ alignItems: 'center' }}>
            <div style={{ minWidth: 0 }}>
              <strong>{b.label ?? new Date(b.savedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
              <div className="tiny">{describePlan(b.state)}</div>
            </div>
            <button
              className="btn ghost small"
              type="button"
              onClick={async () => {
                if (!confirm('Restore this version of your plan? The current plan is backed up first.')) return
                await backupState(state, { force: true }).catch(() => undefined)
                dispatch({ type: 'importState', state: b.state })
              }}
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
