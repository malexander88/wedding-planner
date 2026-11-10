import { useState } from 'react'
import { guestsCsv, downloadText } from '../lib/csv'
import { newGuest, newHousehold, useStore } from '../state/store'
import type { Guest, InvitePart } from '../types'

export function Guests() {
  const { state, dispatch } = useStore()
  const [hhName, setHhName] = useState('')
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
      <section className="card hero">
        <div className="kicker">People</div>
        <h1>Guest list</h1>
        <p>
          {state.guests.length} people in {state.households.length} households.
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
      </section>

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
              <button className="btn ghost small" type="button" onClick={() => dispatch({ type: 'removeHousehold', id: hh.id })}>
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
                <button className="btn ghost small" type="button" onClick={() => dispatch({ type: 'removeGuest', id: g.id })}>Remove person</button>
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
    </div>
  )
}
