import { useEffect, useMemo, useState } from 'react'
import {
  allGroups,
  allTags,
  DEFAULT_QUERY,
  dietaryOf,
  guestCounts,
  guestName,
  invitedToFor,
  isComing,
  isEveningOnly,
  parseGuestLine,
  planningNumbers,
  queryHouseholds,
  queryPeople,
  recordsFor,
  sideLabel,
  UNSORTED_ID,
  type GuestQuery,
  type GuestSort,
  type GuestStatus,
} from '../data/guests'
import { formatShort } from '../data/legal'
import { newGuest, useStore } from '../state/store'
import type { Guest, Household } from '../types'
import { AddControls, type AddDefaults } from '../components/guests/AddControls'
import { BulkPasteSheet } from '../components/guests/BulkPasteSheet'
import { ExportSheet } from '../components/guests/ExportSheet'
import { GuestSheet } from '../components/guests/GuestSheet'
import { HouseholdSheet } from '../components/guests/HouseholdSheet'

type Removed = { label: string; household?: Household; householdIndex?: number; guests: Guest[]; guestIndex?: number }

const STATUS: { id: GuestStatus; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'toInvite', label: 'Invite not sent' },
  { id: 'invited', label: 'Invite sent' },
  { id: 'unnamed', label: 'Needs a name' },
  { id: 'children', label: 'Children' },
  { id: 'plusOnes', label: 'Plus-ones' },
  { id: 'dietary', label: 'Dietary' },
  { id: 'notComing', label: 'Can’t come' },
]
const SORTS: { id: GuestSort; label: string }[] = [
  { id: 'name', label: 'Household A–Z' },
  { id: 'surname', label: 'Surname A–Z' },
  { id: 'side', label: 'Side' },
  { id: 'group', label: 'Group' },
  { id: 'added', label: 'Recently added' },
]

export function Guests() {
  const { state, dispatch } = useStore()
  const names = { a: state.profile.partnerAName || 'Partner 1', b: state.profile.partnerBName || 'Partner 2' }
  const [q, setQ] = useState<GuestQuery>(DEFAULT_QUERY)
  const [view, setView] = useState<'households' | 'people'>('households')
  const [defaults, setDefaults] = useState<AddDefaults>({ side: 'both', invite: 'day', group: '' })
  const [quick, setQuick] = useState('')
  const [sheet, setSheetRaw] = useState<{ kind: 'guest' | 'household'; id: string } | { kind: 'bulk' | 'export' } | null>(null)
  const [removed, setRemoved] = useState<Removed | null>(null)
  const [note, setNote] = useState('')
  const set = (patch: Partial<GuestQuery>) => setQ((o) => ({ ...o, ...patch }))
  const setSheet = (next: typeof sheet) => {
    // A sheet covers the bottom of the screen: drop a plain "Added…" note rather than float it over the form.
    if (next) setNote('')
    setSheetRaw(next)
  }

  useEffect(() => {
    if (!removed && !note) return
    const t = window.setTimeout(() => {
      setRemoved(null)
      setNote('')
    }, 10000)
    return () => window.clearTimeout(t)
  }, [removed, note])

  const c = guestCounts(state)
  const numbers = planningNumbers(state)
  const groups = allGroups(state)
  const tags = allTags(state)
  const rows = useMemo(() => queryHouseholds(state, q), [state, q])
  const people = useMemo(() => (view === 'people' ? queryPeople(state, q) : []), [state, q, view])
  const shownPeople = rows.reduce((n, r) => n + r.guests.length, 0)
  const filtered = JSON.stringify({ ...q, sort: 'name' }) !== JSON.stringify({ ...DEFAULT_QUERY, sort: 'name' })
  const toMark = rows.filter((r) => r.household.id !== UNSORTED_ID && !r.household.inviteSent && r.members.some(isComing))

  const preview = parseGuestLine(quick, { ...defaults, names })
  const quickAdd = () => {
    if (!preview) return
    const r = recordsFor([preview])
    dispatch({ type: 'addGuests', households: r.households, guests: r.guests })
    setQuick('')
    setNote(`Added ${r.households[0].name}${r.guests.length ? ` (${r.guests.length})` : ''}`)
  }

  const removeHousehold = (hh: Household) => {
    const ppl = state.guests.filter((g) => (hh.id === UNSORTED_ID ? !state.households.some((h) => h.id === g.householdId) : g.householdId === hh.id))
    const who = ppl.length ? ` and ${ppl.length === 1 ? 'the 1 person' : `all ${ppl.length} people`} in it` : ''
    if (!window.confirm(`Remove ${hh.name || 'this household'}${who} from the guest list?`)) return
    dispatch({ type: 'removeHousehold', id: hh.id })
    setSheet(null)
    setRemoved({
      label: `${hh.name || 'Household'} removed`,
      household: hh.id === UNSORTED_ID ? undefined : hh,
      householdIndex: state.households.findIndex((h) => h.id === hh.id),
      guests: ppl,
      guestIndex: state.guests.findIndex((g) => g.id === ppl[0]?.id),
    })
  }
  const removeGuest = (g: Guest) => {
    const name = guestName(g, state.guests)
    if (!window.confirm(`Remove ${name} from the guest list?`)) return
    dispatch({ type: 'removeGuest', id: g.id })
    setSheet(null)
    setRemoved({ label: `${name} removed`, guests: [g], guestIndex: state.guests.findIndex((x) => x.id === g.id) })
  }
  const addPerson = (hh: Household, kind: 'person' | 'plusOne' | 'child') => {
    const members = state.guests.filter((g) => g.householdId === hh.id)
    const host = members.find((g) => !g.isPlusOne && !g.child)
    const g = newGuest(hh.id, '')
    g.lastName = kind === 'plusOne' ? '' : (host?.lastName ?? '')
    g.invitedTo = host ? [...host.invitedTo] : invitedToFor(defaults.invite)
    if (kind === 'plusOne') {
      g.isPlusOne = true
      g.plusOneNamed = false
      g.plusOneOfGuestId = host?.id
    }
    if (kind === 'child') g.child = true
    dispatch({ type: 'addGuest', guest: g })
    if (kind !== 'plusOne') setSheet({ kind: 'guest', id: g.id })
  }

  const openGuest = sheet?.kind === 'guest' ? state.guests.find((g) => g.id === sheet.id) : undefined
  const openHh = sheet?.kind === 'household' ? state.households.find((h) => h.id === sheet.id) : undefined

  return (
    <div className="grid guests">
      <header className="page-head guests-head">
        <div>
          <div className="kicker">People</div>
          <h1>Guest list</h1>
          <p>Just for the two of you — nothing here is ever sent to guests.</p>
        </div>
        <div className="btn-row">
          <button className="btn secondary small" type="button" onClick={() => setSheet({ kind: 'bulk' })}>
            Paste a list
          </button>
          <button className="btn ghost small" type="button" onClick={() => setSheet({ kind: 'export' })} disabled={!state.guests.length}>
            Export
          </button>
        </div>
      </header>

      <section className="card guest-stats" aria-label="Numbers">
        <div className="stat-big">
          <div>
            <b>{numbers.day}</b>
            <span>day guests</span>
          </div>
          <div>
            <b>{numbers.evening}</b>
            <span>evening only</span>
          </div>
          <div>
            <b>{numbers.day + numbers.evening}</b>
            <span>in total</span>
          </div>
        </div>
        {numbers.fromList ? (
          <>
            <div className="stat-line tiny">
              {c.households} {c.households === 1 ? 'household' : 'households'} · {c.adults} adults · {c.children} children · {c.plusOnes} plus-ones
              {c.unnamedPlusOnes ? ` (${c.unnamedPlusOnes} unnamed)` : ''}
              {c.notComing ? ` · ${c.notComing} can’t come` : ''}
            </div>
            <div className="side-bar" aria-label="By side">
              {(['a', 'b', 'both'] as const).map((s) =>
                c.bySide[s] ? (
                  <span key={s} className={`side-seg side-${s}`} style={{ flexGrow: c.bySide[s] }}>
                    {sideLabel(s, names)} {c.bySide[s]}
                  </span>
                ) : null,
              )}
            </div>
            <div className="stat-line tiny">
              Invitations sent: <strong>{c.invitesSent}</strong> of {c.invitesSent + c.invitesToSend} households
              {c.saveDatesSent ? ` · save the dates: ${c.saveDatesSent}` : ''}
              {c.dietary ? ` · ${c.dietary} dietary ${c.dietary === 1 ? 'note' : 'notes'}` : ''}
            </div>
            <p className="tiny feeds">
              Venue search, supplier enquiry drafts, catering per head and final numbers use these counts. Your first guess was{' '}
              {state.profile.estimatedDayGuests} day + {state.profile.estimatedEveningGuests} evening.
            </p>
          </>
        ) : (
          <p className="tiny feeds">Your first guess, from setup. Add people and these become your real numbers everywhere in the app.</p>
        )}
      </section>

      <section className="card quick-add">
        <h2>Quick add</h2>
        <div className="qa-row">
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
            placeholder="Anna & Tom Smith +1"
            aria-label="Quick add a household"
            autoComplete="off"
          />
          <button className="btn" type="button" onClick={quickAdd} disabled={!preview}>
            Add
          </button>
        </div>
        <AddControls value={defaults} onChange={setDefaults} state={state} idPrefix="qa" />
        <p className="tiny qa-preview" aria-live="polite">
          {preview
            ? `Adds ${preview.name}: ${preview.people.map((p) => (p.plusOne ? 'a plus-one' : `${p.first}${p.child ? ' (child)' : ''}`)).join(', ') || 'no names yet'} · ${
                preview.invite === 'day' ? 'day' : 'evening only'
              } · ${sideLabel(preview.side, names)} side${preview.group ? ` · ${preview.group}` : ''}`
            : 'Type names: “&” for couples, “+1” for a plus-one, “kids: Ben, Ella”, “(evening)”, “#tag”.'}
        </p>
      </section>

      {state.guests.length + state.households.length > 0 && (
        <section className="card guest-tools">
          <input type="search" value={q.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search names, groups, tags, notes" aria-label="Search guests" />
          <div className="chips scroll" role="group" aria-label="Side">
            {(['all', 'a', 'b', 'both'] as const).map((s) => (
              <button key={s} type="button" className={`chip small${q.side === s ? ' on' : ''}`} aria-pressed={q.side === s} onClick={() => set({ side: s })}>
                {s === 'all' ? 'All sides' : sideLabel(s, names)}
              </button>
            ))}
            <span className="chip-sep" aria-hidden="true" />
            {(['all', 'day', 'evening'] as const).map((i) => (
              <button key={i} type="button" className={`chip small${q.invite === i ? ' on' : ''}`} aria-pressed={q.invite === i} onClick={() => set({ invite: i })}>
                {i === 'all' ? 'Day & evening' : i === 'day' ? 'Day' : 'Evening only'}
              </button>
            ))}
          </div>
          <div className="chips scroll" role="group" aria-label="Show">
            {STATUS.map((s) => (
              <button key={s.id} type="button" className={`chip small${q.status === s.id ? ' on' : ''}`} aria-pressed={q.status === s.id} onClick={() => set({ status: s.id })}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="tools-row">
            {groups.length > 0 && (
              <select value={q.group} onChange={(e) => set({ group: e.target.value })} aria-label="Group">
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            {tags.length > 0 && (
              <select value={q.tag} onChange={(e) => set({ tag: e.target.value })} aria-label="Tag">
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            )}
            <select value={q.sort} onChange={(e) => set({ sort: e.target.value as GuestSort })} aria-label="Sort">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="seg seg-2 view-toggle" role="radiogroup" aria-label="View">
              {(['households', 'people'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} className={`seg-btn${view === v ? ' on' : ''}`} onClick={() => setView(v)}>
                  {v === 'households' ? 'Households' : 'People'}
                </button>
              ))}
            </div>
          </div>
          <div className="tools-foot tiny">
            <span>
              Showing {shownPeople} {shownPeople === 1 ? 'person' : 'people'} in {rows.length} {rows.length === 1 ? 'household' : 'households'}
            </span>
            {filtered && (
              <button type="button" className="td-link" onClick={() => setQ({ ...DEFAULT_QUERY, sort: q.sort })}>
                Clear filters
              </button>
            )}
            {q.status === 'toInvite' && toMark.length > 0 && (
              <button
                type="button"
                className="td-link"
                onClick={() => {
                  if (window.confirm(`Tick “invitation sent” for these ${toMark.length} households?`))
                    dispatch({ type: 'setInvitesSent', ids: toMark.map((r) => r.household.id), sent: true })
                }}
              >
                Mark these {toMark.length} as sent
              </button>
            )}
          </div>
        </section>
      )}

      {state.households.length === 0 && state.guests.length === 0 && (
        <div className="card empty">Add your first household above, or paste a whole list from your notes or a spreadsheet.</div>
      )}
      {state.households.length + state.guests.length > 0 && rows.length === 0 && <div className="card empty">Nobody matches. Try clearing the filters.</div>}

      {view === 'households' ? (
        <div className="hh-grid">
          {rows.map(({ household: hh, guests, members }) => {
            const orphan = hh.id === UNSORTED_ID
            const hidden = members.length - guests.length
            return (
              <section className={`card hh-card side-${hh.side}`} key={hh.id} aria-label={hh.name}>
                <div className="hh-head">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3>{hh.name || 'Unnamed household'}</h3>
                    <div className="hh-meta">
                      <span className={`who who-${hh.side === 'both' ? 'both' : hh.side}`}>{sideLabel(hh.side, names)}</span>
                      {hh.group && <span className="grp">{hh.group}</span>}
                      <span className="tiny">
                        {members.filter(isComing).length} {members.filter(isComing).length === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                  </div>
                  {!orphan && (
                    <button type="button" className="td-link" onClick={() => setSheet({ kind: 'household', id: hh.id })} aria-label={`Edit household ${hh.name}`}>
                      Edit
                    </button>
                  )}
                </div>
                {orphan && <p className="tiny">Their household was removed on the other phone. Move them to a household, or remove them.</p>}
                <ul className="people">
                  {guests.map((g) => (
                    <li key={g.id}>
                      <button type="button" className={`person${isComing(g) ? '' : ' out'}`} onClick={() => setSheet({ kind: 'guest', id: g.id })}>
                        <span className="pname">{guestName(g, state.guests)}</span>
                        <span className="badges">
                          {isEveningOnly(g) && <span className="b eve">Evening</span>}
                          {g.child && <span className="b">Child</span>}
                          {g.isPlusOne && <span className="b">+1</span>}
                          {dietaryOf(g) && (
                            <span className="b diet" title={dietaryOf(g)}>
                              Dietary
                            </span>
                          )}
                          {!isComing(g) && <span className="b out">Can’t come</span>}
                          {(g.tags ?? []).map((t) => (
                            <span key={t} className="b tag">
                              #{t}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                  {hidden > 0 && <li className="tiny more">+ {hidden} more not matching the filters</li>}
                </ul>
                {!orphan ? (
                  <div className="hh-foot">
                    <label className="inline invite-tick">
                      <input
                        type="checkbox"
                        checked={!!hh.inviteSent}
                        onChange={(e) => dispatch({ type: 'updateHousehold', id: hh.id, patch: { inviteSent: e.target.checked } })}
                      />
                      Invitation sent{hh.inviteSent && hh.inviteSentOn ? ` · ${formatShort(hh.inviteSentOn)}` : ''}
                    </label>
                    <div className="hh-add">
                      <button type="button" className="td-link" onClick={() => addPerson(hh, 'person')}>
                        + Person
                      </button>
                      <button type="button" className="td-link" onClick={() => addPerson(hh, 'plusOne')}>
                        + Plus-one
                      </button>
                      <button type="button" className="td-link" onClick={() => addPerson(hh, 'child')}>
                        + Child
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="hh-foot">
                    <button type="button" className="text-btn danger" onClick={() => removeHousehold(hh)}>
                      Remove these people
                    </button>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <section className="card people-table-card">
          <table className="people-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Household</th>
                <th>Side</th>
                <th>Invited for</th>
                <th>Notes</th>
                <th>Invite</th>
              </tr>
            </thead>
            <tbody>
              {people.map(({ guest: g, household: hh }) => (
                <tr key={g.id} className={isComing(g) ? '' : 'out'}>
                  <td>
                    <button type="button" className="td-link pname" onClick={() => setSheet({ kind: 'guest', id: g.id })}>
                      {guestName(g, state.guests)}
                    </button>
                  </td>
                  <td className="hh">{hh.name}</td>
                  <td>{sideLabel(hh.side, names)}</td>
                  <td>{isEveningOnly(g) ? 'Evening' : 'Day'}</td>
                  <td className="flags">
                    {[g.child && 'Child', g.isPlusOne && '+1', dietaryOf(g) && 'Dietary', !isComing(g) && 'Can’t come', ...(g.tags ?? []).map((t) => `#${t}`)]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                  <td>{hh.id === UNSORTED_ID ? '—' : hh.inviteSent ? 'Sent' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {openGuest && <GuestSheet key={openGuest.id} guest={openGuest} onClose={() => setSheet(null)} onRemove={removeGuest} />}
      {openHh && <HouseholdSheet key={openHh.id} household={openHh} onClose={() => setSheet(null)} onRemove={removeHousehold} />}
      {sheet?.kind === 'bulk' && (
        <BulkPasteSheet
          defaults={defaults}
          onClose={() => setSheet(null)}
          onAdded={(h, p) => setNote(`Added ${h} ${h === 1 ? 'household' : 'households'} and ${p} ${p === 1 ? 'person' : 'people'}`)}
        />
      )}
      {sheet?.kind === 'export' && <ExportSheet onClose={() => setSheet(null)} />}
      {(removed || note) && (
        <div className="toast" role="status">
          <span>{removed?.label ?? note}</span>
          {removed && (
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
          )}
        </div>
      )}
    </div>
  )
}
