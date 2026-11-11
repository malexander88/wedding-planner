import { useEffect, useState } from 'react'
import { guestsCsv, downloadText } from '../lib/csv'
import { newGuest, newHousehold, useStore } from '../state/store'
import type { Guest, Household, InvitePart } from '../types'

type Removed = { label: string; household?: Household; householdIndex?: number; guests: Guest[]; guestIndex?: number }

export function Guests() {
  const { state, dispatch } = useStore()
  const [hhName, setHhName] = useState('')
  const [removed, setRemoved] = useState<Removed | null>(null)
  useEffect(() => {
    if (!removed) return
    const t = window.setTimeout(() => setRemoved(null), 10000)
    return () => window.clearTimeout(t)
  }, [removed])

  const removeHousehold = (hh: Household) => {
    const people = state.guests.filter((g) => g.householdId === hh.id)
    const who = people.length ? ` and ${people.length === 1 ? 'the 1 person' : `all ${people.length} people`} in it` : ''
    if (!window.confirm(`Remove ${hh.name || 'this household'}${who} from the guest list?`)) return
    dispatch({ type: 'removeHousehold', id: hh.id })
    setRemoved({
      label: `${hh.name || 'Household'} removed`,
      household: hh,
      householdIndex: state.households.findIndex((h) => h.id === hh.id),
      guests: people,
      guestIndex: state.guests.findIndex((g) => g.householdId === hh.id),
    })
  }
  const removeGuest = (g: Guest) => {
    const name = [g.firstName, g.lastName].filter(Boolean).join(' ') || (g.isPlusOne ? 'this plus-one' : 'this person')
    if (!window.confirm(`Remove ${name} from the guest list?`)) return
    dispatch({ type: 'removeGuest', id: g.id })
    setRemoved({ label: `${name} removed`, guests: [g], guestIndex: state.guests.findIndex((x) => x.id === g.id) })
  }
  const day = state.guests.filter((g) => g.invitedTo.includes('day') && g.rsvp !== 'no').length
  const eve = state.guests.filter((g) => g.invitedTo.includes('evening') && g.rsvp !== 'no').length

  const toggleInvite = (g: Guest, part: InvitePart) => {
    const invitedTo = g.invitedTo.includes(part)
      ? g.invitedTo.filter((x) => x !== part)
      : [...g.invitedTo, part]
    dispatch({ type: 'updateGuest', id: g.id, patch: { invitedTo } })
  }

  return (
    <div className="grid">
      <header className="page-head">
        <div className="kicker">People</div>
        <h1>Guest list</h1>
        <p>
          {state.guests.length} {state.guests.length === 1 ? 'person' : 'people'} in {state.households.length}{' '}
          {state.households.length === 1 ? 'household' : 'households'}.
          About {day} for the day and {eve} for the evening (not counting people who have said no).
          Your first guess was {state.profile.estimatedDayGuests} day / {state.profile.estimatedEveningGuests} evening.
        </p>
        <div className="btn-row">
          <button
            className="btn secondary"
            type="button"
            onClick={() => downloadText('wedding-guests.csv', guestsCsv(state), 'text/csv')}
          >
            Export CSV
          </button>
        </div>
      </header>

      <section className="card">
        <h2>Add a household</h2>
        <div className="btn-row">
          <input
            style={{ flex: 1, minWidth: 180 }}
            value={hhName}
            onChange={(e) => setHhName(e.target.value)}
            placeholder="The Murrays, or Jordan + guest"
          />
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (!hhName.trim()) return
              const hh = newHousehold(hhName.trim())
              dispatch({ type: 'addHousehold', household: hh })
              setHhName('')
            }}
          >
            Add
          </button>
        </div>
      </section>

      {state.households.length === 0 && (
        <div className="card empty">Add a household to start naming people, plus-ones and who is coming for the day or just the evening.</div>
      )}

      {state.households.map((hh) => {
        const people = state.guests.filter((g) => g.householdId === hh.id)
        return (
          <section className="card" key={hh.id}>
            <div className="row" style={{ paddingTop: 0 }}>
              <input
                value={hh.name}
                onChange={(e) => dispatch({ type: 'updateHousehold', id: hh.id, patch: { name: e.target.value } })}
              />
              <button className="btn ghost small" type="button" onClick={() => removeHousehold(hh)}>
                Remove
              </button>
            </div>
            {people.map((g) => (
              <div key={g.id} className="grid" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
                <div className="grid-2">
                  <label className="field">
                    <span>First name</span>
                    <input value={g.firstName} onChange={(e) => dispatch({ type: 'updateGuest', id: g.id, patch: { firstName: e.target.value } })} />
                  </label>
                  <label className="field">
                    <span>Last name</span>
                    <input value={g.lastName} onChange={(e) => dispatch({ type: 'updateGuest', id: g.id, patch: { lastName: e.target.value } })} />
                  </label>
                </div>
                <div className="chips">
                  <button className={`chip ${g.invitedTo.includes('day') ? 'on' : ''}`} type="button" onClick={() => toggleInvite(g, 'day')}>Day</button>
                  <button className={`chip ${g.invitedTo.includes('evening') ? 'on' : ''}`} type="button" onClick={() => toggleInvite(g, 'evening')}>Evening</button>
                  <button className={`chip ${g.child ? 'on' : ''}`} type="button" onClick={() => dispatch({ type: 'updateGuest', id: g.id, patch: { child: !g.child } })}>Child</button>
                  <button className={`chip ${g.isPlusOne ? 'on' : ''}`} type="button" onClick={() => dispatch({ type: 'updateGuest', id: g.id, patch: { isPlusOne: !g.isPlusOne } })}>Plus-one</button>
                </div>
                <div className="grid-2">
                  <label className="field">
                    <span>Reply</span>
                    <select value={g.rsvp} onChange={(e) => dispatch({ type: 'updateGuest', id: g.id, patch: { rsvp: e.target.value as Guest['rsvp'] } })}>
                      <option value="pending">Waiting</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="maybe">Maybe</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Meal</span>
                    <input value={g.meal} onChange={(e) => dispatch({ type: 'updateGuest', id: g.id, patch: { meal: e.target.value } })} />
                  </label>
                  <label className="field">
                    <span>Dietary needs</span>
                    <input value={g.dietary} onChange={(e) => dispatch({ type: 'updateGuest', id: g.id, patch: { dietary: e.target.value } })} placeholder="Vegetarian, nut allergy…" />
                  </label>
                  <label className="field">
                    <span>Travelling from</span>
                    <input value={g.travelFrom} onChange={(e) => dispatch({ type: 'updateGuest', id: g.id, patch: { travelFrom: e.target.value } })} placeholder="Manchester, or local" />
                  </label>
                </div>
                {g.dietary && (
                  <label className="inline">
                    <input type="checkbox" checked={g.dietaryConsent} onChange={(e) => dispatch({ type: 'updateGuest', id: g.id, patch: { dietaryConsent: e.target.checked } })} />
                    They are happy for us to share this with the caterer
                  </label>
                )}
                {g.isPlusOne && !g.firstName && <p className="tiny">This plus-one still needs a name before you can seat or cater for them properly.</p>}
                <button className="btn ghost small" type="button" onClick={() => removeGuest(g)}>Remove person</button>
              </div>
            ))}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn small" type="button" onClick={() => dispatch({ type: 'addGuest', guest: newGuest(hh.id, '') })}>
                Add a person
              </button>
              <button
                className="btn secondary small"
                type="button"
                onClick={() => {
                  const host = people[0]
                  const plus = newGuest(hh.id, '')
                  plus.isPlusOne = true
                  plus.plusOneNamed = false
                  plus.plusOneOfGuestId = host?.id
                  plus.invitedTo = host?.invitedTo ?? ['day', 'evening']
                  dispatch({ type: 'addGuest', guest: plus })
                }}
              >
                Add a plus-one
              </button>
            </div>
          </section>
        )
      })}
      {removed && (
        <div className="toast" role="status">
          <span>{removed.label}</span>
          <button
            className="text-btn"
            type="button"
            onClick={() => {
              const { household, householdIndex, guests, guestIndex } = removed
              dispatch({ type: 'restoreGuests', household, householdIndex, guests, guestIndex })
              setRemoved(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
