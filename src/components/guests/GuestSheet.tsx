import { useState } from 'react'
import { allTags, dietaryHeldWithoutConsent, guestName, invitedToFor, inviteOf, type Invite } from '../../data/guests'
import { useStore } from '../../state/store'
import type { Guest } from '../../types'
import { Sheet } from '../Sheet'
import { TagPicker } from './TagPicker'

export function GuestSheet({ guest, onClose, onRemove }: { guest: Guest; onClose: () => void; onRemove: (g: Guest) => void }) {
  const { state, dispatch } = useStore()
  const [d, setD] = useState<Guest>(guest)
  const set = (patch: Partial<Guest>) => setD((old) => ({ ...old, ...patch }))
  const legacy = dietaryHeldWithoutConsent(guest) && d.dietary === guest.dietary && !d.dietaryConsent
  const hosts = state.guests.filter((g) => g.householdId === d.householdId && g.id !== d.id && !g.isPlusOne)
  const title = guestName(guest, state.guests)

  const save = () => {
    dispatch({
      type: 'updateGuest',
      id: guest.id,
      patch: {
        ...d,
        firstName: d.firstName.trim(),
        lastName: d.lastName.trim(),
        plusOneNamed: !d.isPlusOne || !!d.firstName.trim(),
        plusOneOfGuestId: d.isPlusOne ? d.plusOneOfGuestId || hosts[0]?.id : undefined,
      },
    })
    onClose()
  }

  return (
    <Sheet id="gs" kicker={guest.isPlusOne ? 'Plus-one' : guest.child ? 'Child' : 'Guest'} title={title} onClose={onClose}>
      <div className="grid-2">
        <label className="field">
          <span>First name</span>
          <input value={d.firstName} onChange={(e) => set({ firstName: e.target.value })} autoComplete="off" />
        </label>
        <label className="field">
          <span>Last name</span>
          <input value={d.lastName} onChange={(e) => set({ lastName: e.target.value })} autoComplete="off" />
        </label>
      </div>
      {d.isPlusOne && !d.firstName.trim() && <p className="tiny">Fine to leave blank until you know who they’re bringing.</p>}

      <div className="field">
        <span id="gs-inv">Invited for</span>
        <div className="seg seg-2" role="radiogroup" aria-labelledby="gs-inv">
          {(['day', 'evening'] as Invite[]).map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={inviteOf(d) === i}
              className={`seg-btn${inviteOf(d) === i ? ' on' : ''}`}
              onClick={() => set({ invitedTo: invitedToFor(i) })}
            >
              {i === 'day' ? 'The whole day' : 'Evening only'}
            </button>
          ))}
        </div>
      </div>

      <div className="chips gs-flags">
        <button type="button" className={`chip${d.child ? ' on' : ''}`} aria-pressed={d.child} onClick={() => set({ child: !d.child })}>
          Child
        </button>
        <button type="button" className={`chip${d.isPlusOne ? ' on' : ''}`} aria-pressed={d.isPlusOne} onClick={() => set({ isPlusOne: !d.isPlusOne })}>
          Plus-one
        </button>
        <button
          type="button"
          className={`chip${d.rsvp === 'no' ? ' on' : ''}`}
          aria-pressed={d.rsvp === 'no'}
          onClick={() => set({ rsvp: d.rsvp === 'no' ? 'pending' : 'no' })}
        >
          Can’t come
        </button>
      </div>
      {d.isPlusOne && hosts.length > 1 && (
        <label className="field">
          <span>Plus-one of</span>
          <select value={d.plusOneOfGuestId ?? ''} onChange={(e) => set({ plusOneOfGuestId: e.target.value || undefined })}>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {guestName(h)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Household</span>
        <select value={d.householdId} onChange={(e) => set({ householdId: e.target.value, plusOneOfGuestId: undefined })}>
          {state.households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name || 'Unnamed household'}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Tags</span>
        <TagPicker value={d.tags ?? []} options={allTags(state)} onChange={(tags) => set({ tags })} />
      </div>

      <div className="grid-2">
        <label className="field">
          <span>Meal choice</span>
          <input value={d.meal} onChange={(e) => set({ meal: e.target.value })} placeholder="Beef, fish, veggie…" />
        </label>
        <label className="field">
          <span>Travelling from</span>
          <input value={d.travelFrom} onChange={(e) => set({ travelFrom: e.target.value })} placeholder="Manchester, or local" />
        </label>
      </div>

      <div className="consent-box">
        <label className="inline">
          <input
            type="checkbox"
            checked={d.dietaryConsent}
            onChange={(e) => set(e.target.checked ? { dietaryConsent: true } : { dietaryConsent: false, dietary: legacy ? d.dietary : '' })}
          />
          <span>
            <strong>{d.firstName.trim() || 'They'} said it’s fine to note dietary needs</strong>
            <br />
            <span className="tiny">Allergies and diets are health information. Only noted with their OK; shared with the caterer only in your exports.</span>
          </span>
        </label>
        {d.dietaryConsent ? (
          <label className="field" style={{ marginTop: 10 }}>
            <span>Dietary needs</span>
            <input value={d.dietary} onChange={(e) => set({ dietary: e.target.value })} placeholder="Vegetarian, nut allergy…" />
          </label>
        ) : legacy ? (
          <p className="tiny warn-text" style={{ margin: '8px 0 0' }}>
            A dietary note was saved before consent was asked. It’s hidden from counts and exports. Tick above to keep it, or{' '}
            <button type="button" className="td-link" onClick={() => set({ dietary: '' })}>
              delete it
            </button>
            .
          </p>
        ) : null}
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea rows={2} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
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
        <button className="text-btn danger" type="button" onClick={() => onRemove(guest)}>
          Remove from the list
        </button>
      </div>
    </Sheet>
  )
}
