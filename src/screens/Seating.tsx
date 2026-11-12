import { useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { IconBack, IconLeaf, IconPrint } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { DEFAULT_SEATS, householdToSeat, nextTableName, seatFinder, seatingCsv, seatingView, SHAPE_LABEL, type SeatedGuest, type TableView } from '../data/seating'
import { uid } from '../lib/ids'
import { useStore } from '../state/store'
import type { SeatingTable } from '../types'

type Pick =
  | { kind: 'household'; id: string; name: string; guestIds: string[] }
  | { kind: 'guest'; id: string; name: string; householdId: string; tableId: string }

const DRAG_TYPE = 'application/x-wp-seat'

/** Little top-down drawing: filled dots are taken seats. */
function TableArt({ t }: { t: TableView }) {
  const n = Math.min(t.table.seats, 24)
  const taken = Math.min(t.guests.length, n)
  const dots: { x: number; y: number }[] = []
  if (t.table.shape === 'round') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      dots.push({ x: 40 + Math.cos(a) * 31, y: 40 + Math.sin(a) * 31 })
    }
  } else {
    const per = Math.ceil(n / 2)
    for (let i = 0; i < n; i++) {
      const top = i < per
      const j = top ? i : i - per
      const cols = top ? per : n - per
      dots.push({ x: 12 + ((j + 0.5) * 56) / cols, y: top ? 18 : 62 })
    }
  }
  return (
    <svg className="table-art" viewBox="0 0 80 80" aria-hidden="true">
      {t.table.shape === 'round' ? <circle cx="40" cy="40" r="21" className="ta-top" /> : <rect x="10" y="28" width="60" height="24" rx="4" className="ta-top" />}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={n > 14 ? 3.2 : 4.4} className={i < taken ? 'ta-seat on' : 'ta-seat'} />
      ))}
    </svg>
  )
}

function Diet({ g }: { g: SeatedGuest }) {
  if (!g.dietary) return null
  return (
    <span className="diet" title={`Dietary: ${g.dietary}`} aria-label={`Dietary: ${g.dietary}`}>
      <IconLeaf aria-hidden="true" />
      <span className="print-inline">{g.dietary}</span>
    </span>
  )
}

export function Seating() {
  const { state, dispatch } = useStore()
  const view = useMemo(() => seatingView(state), [state])
  const [pick, setPick] = useState<Pick | null>(null)
  const [editing, setEditing] = useState<SeatingTable | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)
  const finder = useMemo(() => seatFinder(state), [state])

  const addTable = (shape: SeatingTable['shape']) =>
    dispatch({ type: 'upsertSeatingTable', table: { id: uid('tbl'), name: nextTableName(state.seatingTables), seats: DEFAULT_SEATS[shape], shape } })

  const seat = (guestIds: string[], t: TableView, label: string) => {
    const already = t.guests.filter((g) => guestIds.includes(g.guest.id)).length
    const need = guestIds.length - already
    if (need > t.free && !confirm(`${t.table.name} has ${Math.max(0, t.free)} free ${t.free === 1 ? 'seat' : 'seats'}; ${label} needs ${need}. Seat them anyway?`)) return
    dispatch({ type: 'seatGuests', guestIds, tableId: t.table.id })
    setPick(null)
  }

  const onTable = (t: TableView) => {
    if (!pick) return
    if (pick.kind === 'household') seat(pick.guestIds, t, `the ${pick.name} household`)
    else if (pick.tableId !== t.table.id) seat([pick.id], t, pick.name)
    else setPick(null)
  }

  const dragData = (e: DragEvent, p: Pick) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(p))
    e.dataTransfer.setData('text/plain', p.name)
    e.dataTransfer.effectAllowed = 'move'
    setPick(p)
  }
  const readDrag = (e: DragEvent): Pick | null => {
    try {
      return JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as Pick
    } catch {
      return null
    }
  }

  const exportCsv = () => {
    const blob = new Blob(['\ufeff' + seatingCsv(state)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'seating-plan.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const names = [state.profile.partnerAName, state.profile.partnerBName].filter(Boolean).join(' & ')

  return (
    <div className="grid seating-page">
      <header className="page-head">
        <Link to="/guests" className="text-btn back-link no-print">
          <IconBack style={{ width: 16, height: 16 }} /> Guests
        </Link>
        <h1>Seating plan</h1>
        <p className="no-print">
          Seat your day guests at tables. Tap a household, then tap a table (or drag on a computer). Households move together; tap one person to move just them.
        </p>
        <p className="print-only">{names}{state.profile.date ? ` · ${state.profile.date}` : ''}</p>
      </header>

      <div className="card seat-summary no-print">
        <div>
          <strong>{view.seated} of {view.total}</strong> day guests seated
          <span className="tiny"> · {state.seatingTables.length} {state.seatingTables.length === 1 ? 'table' : 'tables'}, {view.seats} seats</span>
        </div>
        <div className="btn-row">
          <button className="btn secondary small" type="button" onClick={() => addTable('round')}>+ Round table</button>
          <button className="btn secondary small" type="button" onClick={() => addTable('rect')}>+ Long table</button>
          <button className="btn ghost small" type="button" onClick={() => window.print()} disabled={!state.seatingTables.length}>
            <IconPrint style={{ width: 16, height: 16 }} /> Print
          </button>
          <button className="btn ghost small" type="button" onClick={exportCsv} disabled={!view.total}>Export CSV</button>
        </div>
        {view.total > 0 && view.seats < view.total && (
          <p className="tiny warn-text">You need {view.total - view.seats} more {view.total - view.seats === 1 ? 'seat' : 'seats'} for everyone.</p>
        )}
      </div>

      {view.total === 0 ? (
        <div className="card empty">
          Add day guests to your <Link to="/guests">guest list</Link> first. Evening-only guests and anyone marked as not coming aren’t seated.
        </div>
      ) : (
        <div className="seating-layout">
          <section
            className={`card seat-waiting no-print${dropOn === 'waiting' ? ' drop' : ''}`}
            aria-label="Not seated yet"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                e.preventDefault()
                setDropOn('waiting')
              }
            }}
            onDragLeave={() => setDropOn(null)}
            onDrop={(e) => {
              e.preventDefault()
              setDropOn(null)
              const p = readDrag(e)
              if (p?.kind === 'guest') dispatch({ type: 'seatGuests', guestIds: [p.id], tableId: null })
              setPick(null)
            }}
          >
            <h2>Not seated yet <span className="count">{view.total - view.seated}</span></h2>
            {view.waiting.length === 0 ? (
              <p className="tiny">Everyone has a seat.</p>
            ) : (
              <ul className="hh-list">
                {view.waiting.map((w) => {
                  const p: Pick = { kind: 'household', id: w.id, name: w.name, guestIds: householdToSeat(state, w.id) }
                  const on = pick?.kind === 'household' && pick.id === w.id
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        className={`hh-chip${on ? ' on' : ''}`}
                        draggable
                        aria-pressed={on}
                        onDragStart={(e) => dragData(e, p)}
                        onDragEnd={() => setDropOn(null)}
                        onClick={() => setPick(on ? null : p)}
                      >
                        <span className="hh-name">{w.name} <span className="count">{w.guests.length}</span></span>
                        <span className="hh-people">
                          {w.guests.map((g) => (
                            <span key={g.guest.id} className="hh-person">
                              {g.name}
                              {g.guest.child && <span className="kid">child</span>}
                              <Diet g={g} />
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="table-grid">
            {view.tables.length === 0 && (
              <div className="card empty no-print">Add your first table above. Round tables start with 8 seats, long tables with 10. Change either any time.</div>
            )}
            {view.tables.map((t) => {
              const target = !!pick && !(pick.kind === 'guest' && pick.tableId === t.table.id)
              return (
                <section
                  key={t.table.id}
                  className={`card seat-table${t.over ? ' over' : ''}${target ? ' target' : ''}${dropOn === t.table.id ? ' drop' : ''}`}
                  aria-label={t.table.name}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                      e.preventDefault()
                      setDropOn(t.table.id)
                    }
                  }}
                  onDragLeave={() => setDropOn((d) => (d === t.table.id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDropOn(null)
                    const p = readDrag(e)
                    if (!p) return
                    if (p.kind === 'household') seat(p.guestIds, t, `the ${p.name} household`)
                    else if (p.tableId !== t.table.id) seat([p.id], t, p.name)
                  }}
                >
                  <header className="st-head">
                    <TableArt t={t} />
                    <div>
                      <h2>{t.table.name}</h2>
                      <span className={`tiny${t.over ? ' warn-text' : ''}`}>
                        {SHAPE_LABEL[t.table.shape]} · {t.guests.length}/{t.table.seats} {t.over ? '· over capacity' : t.free ? `· ${t.free} free` : '· full'}
                      </span>
                    </div>
                    <button type="button" className="text-btn no-print" onClick={() => setEditing(t.table)} aria-label={`Edit ${t.table.name}`}>
                      Edit
                    </button>
                  </header>
                  {t.guests.length > 0 ? (
                    <ul className="st-guests">
                      {t.guests.map((g) => {
                        const on = pick?.kind === 'guest' && pick.id === g.guest.id
                        const p: Pick = { kind: 'guest', id: g.guest.id, name: g.name, householdId: g.guest.householdId, tableId: t.table.id }
                        return (
                          <li key={g.guest.id}>
                            <button
                              type="button"
                              className={`st-guest${on ? ' on' : ''}`}
                              draggable
                              aria-pressed={on}
                              onDragStart={(e) => dragData(e, p)}
                              onDragEnd={() => setDropOn(null)}
                              onClick={(e) => {
                                e.stopPropagation()
                                setPick(on ? null : p)
                              }}
                            >
                              {g.name}
                              {g.guest.child && <span className="kid">child</span>}
                              <Diet g={g} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="tiny no-print">No one here yet.</p>
                  )}
                  {t.split.length > 0 && <p className="tiny split-note no-print">Split household: {t.split.join(', ')}</p>}
                  {target && (
                    <button type="button" className="btn small seat-here no-print" onClick={() => onTable(t)}>
                      Seat {pick!.kind === 'household' ? `the ${pick!.name} household` : pick!.name} here
                    </button>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      )}

      {finder.length > 0 && (
        <section className="card print-only finder">
          <h2>Find your seat</h2>
          <ul>
            {finder.map((f, i) => (
              <li key={i}>
                <span>{f.name}</span>
                <span>{f.table}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pick && (
        <div className="pick-bar no-print" role="status">
          <span>
            {pick.kind === 'household' ? `Seating the ${pick.name} household (${pick.guestIds.length})` : `Moving ${pick.name}`}: tap a table
          </span>
          {pick.kind === 'guest' && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                dispatch({ type: 'seatGuests', guestIds: [pick.id], tableId: null })
                setPick(null)
              }}
            >
              Unseat
            </button>
          )}
          <button type="button" className="btn ghost small" onClick={() => setPick(null)}>Cancel</button>
        </div>
      )}

      {editing && <TableSheet table={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TableSheet({ table, onClose }: { table: SeatingTable; onClose: () => void }) {
  const { dispatch } = useStore()
  const [t, setT] = useState(table)
  return (
    <Sheet id="table-sheet" kicker="Seating plan" title={`Edit ${table.name}`} onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="e.g. Top table" />
      </label>
      <div className="seg seg-2" role="radiogroup" aria-label="Shape">
        {(['round', 'rect'] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={t.shape === s} className={`seg-btn${t.shape === s ? ' on' : ''}`} onClick={() => setT({ ...t, shape: s })}>
            {SHAPE_LABEL[s]}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Seats</span>
        <input type="number" min={1} max={40} value={t.seats} onChange={(e) => setT({ ...t, seats: Number(e.target.value) })} />
      </label>
      <div className="btn-row">
        <button
          className="btn"
          type="button"
          onClick={() => {
            dispatch({ type: 'upsertSeatingTable', table: t })
            onClose()
          }}
        >
          Save
        </button>
        <button
          className="text-btn danger"
          type="button"
          onClick={() => {
            if (!confirm(`Remove ${table.name}? Anyone seated there goes back to “Not seated yet”.`)) return
            dispatch({ type: 'removeSeatingTable', id: table.id })
            onClose()
          }}
        >
          Remove table
        </button>
      </div>
    </Sheet>
  )
}
