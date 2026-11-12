import { allGroups, sideLabel, type Invite, type Side } from '../../data/guests'
import type { AppState } from '../../types'

export interface AddDefaults {
  side: Side
  invite: Invite
  group: string
}

/** Side, day/evening and group choices shared by quick add and bulk paste. */
export function AddControls({ value, onChange, state, idPrefix }: { value: AddDefaults; onChange: (v: AddDefaults) => void; state: AppState; idPrefix: string }) {
  const names = { a: state.profile.partnerAName || 'Partner 1', b: state.profile.partnerBName || 'Partner 2' }
  return (
    <div className="add-controls">
      <div className="seg seg-3" role="radiogroup" aria-label="Whose side">
        {(['a', 'b', 'both'] as Side[]).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={value.side === s} className={`seg-btn${value.side === s ? ' on' : ''}`} onClick={() => onChange({ ...value, side: s })}>
            {sideLabel(s, names)}
          </button>
        ))}
      </div>
      <div className="seg seg-2" role="radiogroup" aria-label="Invited for">
        {(['day', 'evening'] as Invite[]).map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value.invite === i} className={`seg-btn${value.invite === i ? ' on' : ''}`} onClick={() => onChange({ ...value, invite: i })}>
            {i === 'day' ? 'Day' : 'Evening'}
          </button>
        ))}
      </div>
      <input
        list={`${idPrefix}-groups`}
        value={value.group}
        onChange={(e) => onChange({ ...value, group: e.target.value })}
        placeholder="Group (optional)"
        aria-label="Group"
      />
      <datalist id={`${idPrefix}-groups`}>
        {allGroups(state).map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  )
}
