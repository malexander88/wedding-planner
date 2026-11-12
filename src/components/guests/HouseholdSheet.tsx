import { useState } from 'react'
import { allGroups, sideLabel, type Side } from '../../data/guests'
import { formatShort } from '../../data/legal'
import { useStore } from '../../state/store'
import type { Household } from '../../types'
import { Sheet } from '../Sheet'

export function HouseholdSheet({
  household,
  onClose,
  onRemove,
}: {
  household: Household
  onClose: () => void
  onRemove: (h: Household) => void
}) {
  const { state, dispatch } = useStore()
  const names = { a: state.profile.partnerAName || 'Partner 1', b: state.profile.partnerBName || 'Partner 2' }
  const [d, setD] = useState<Household>(household)
  const set = (patch: Partial<Household>) => setD((o) => ({ ...o, ...patch }))
  const hasContact = !!(household.address || household.postcode || household.email || household.phone)
  const groups = allGroups(state)

  const save = () => {
    dispatch({ type: 'updateHousehold', id: household.id, patch: { ...d, name: d.name.trim() || household.name, group: d.group?.trim() || undefined } })
    onClose()
  }

  return (
    <Sheet id="hs" kicker="Household" title={household.name || 'Household'} onClose={onClose}>
      <label className="field">
        <span>Name on the invitation</span>
        <input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="The Murrays" />
      </label>

      <div className="field">
        <span id="hs-side">Whose side</span>
        <div className="seg seg-3" role="radiogroup" aria-labelledby="hs-side">
          {(['a', 'b', 'both'] as Side[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={d.side === s} className={`seg-btn${d.side === s ? ' on' : ''}`} onClick={() => set({ side: s })}>
              {sideLabel(s, names)}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Group</span>
        <input list="hs-groups" value={d.group ?? ''} onChange={(e) => set({ group: e.target.value })} placeholder="Matt’s family, Uni friends, Work…" />
        <datalist id="hs-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>

      <div className="grid-2 hs-ticks">
        <label className="inline">
          <input type="checkbox" checked={!!d.saveDateSent} onChange={(e) => set({ saveDateSent: e.target.checked || undefined })} />
          Save the date sent
        </label>
        <label className="inline">
          <input type="checkbox" checked={!!d.inviteSent} onChange={(e) => set({ inviteSent: e.target.checked })} />
          Invitation sent
          {household.inviteSent && household.inviteSentOn && d.inviteSent && <span className="tiny"> · {formatShort(household.inviteSentOn)}</span>}
        </label>
      </div>

      <details className="private-box" open={hasContact}>
        <summary>
          <strong>Contact details for invitations</strong>
          <span className="tiny"> · private to the two of you</span>
        </summary>
        <p className="tiny">
          Kept on your phones and your private shared plan only. Never shown in the list or put in supplier emails, and only exported when you
          choose to include them.
        </p>
        <label className="field">
          <span>Postal address</span>
          <textarea rows={3} value={d.address ?? ''} onChange={(e) => set({ address: e.target.value })} autoComplete="off" />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Postcode</span>
            <input value={d.postcode ?? ''} onChange={(e) => set({ postcode: e.target.value.toUpperCase() })} autoComplete="off" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input type="tel" value={d.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} autoComplete="off" />
          </label>
        </div>
        <label className="field">
          <span>Email</span>
          <input type="email" value={d.email ?? ''} onChange={(e) => set({ email: e.target.value })} autoComplete="off" />
        </label>
      </details>

      <label className="field">
        <span>Notes</span>
        <textarea rows={2} value={d.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </label>

      <div className="sheet-actions">
        <button className="btn" type="button" onClick={save}>
          Save
        </button>
        <button className="btn ghost" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="te-secondary">
        <span />
        <button className="text-btn danger" type="button" onClick={() => onRemove(household)}>
          Remove household
        </button>
      </div>
    </Sheet>
  )
}
