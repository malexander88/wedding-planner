import { useEffect, useRef, useState } from 'react'
import { formatShort } from '../data/legal'
import { useStore } from '../state/store'
import type { Assignee, PlanTask } from '../types'

const ASSIGNEES: (Assignee | '')[] = ['a', 'b', 'both', '']

/** Edit a task: title, due date, who's doing it, notes; hide or delete it. */
export function TaskEditSheet({
  task,
  onClose,
  onDetails,
  onDelete,
}: {
  task: PlanTask
  onClose: () => void
  onDetails: () => void
  onDelete: (task: PlanTask) => void
}) {
  const { state, dispatch } = useStore()
  const names = { a: state.profile.partnerAName || 'Partner 1', b: state.profile.partnerBName || 'Partner 2' }
  const [title, setTitle] = useState(task.title)
  const [due, setDue] = useState(task.dueDate || '')
  const [assignee, setAssignee] = useState<Assignee | ''>(task.assignee ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const ref = useRef<HTMLDivElement>(null)
  const gone = !!(task.hidden || task.removed)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const save = () => {
    dispatch({
      type: 'editTask',
      key: task.key,
      patch: {
        title: title.trim() || task.title,
        dueOverride: due || undefined,
        assignee: assignee || undefined,
        notes: notes.trim() || undefined,
      },
    })
    onClose()
  }
  const label = (a: Assignee | '') => (a === 'a' ? names.a : a === 'b' ? names.b : a === 'both' ? 'Both' : 'Not set')
  const custom = task.custom

  return (
    <div className="modal-back sheet-back" onClick={onClose}>
      <div
        className="modal sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="te-title"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <div className="kicker">Edit task{custom ? ' · your own' : ''}</div>
            <h2 id="te-title" style={{ margin: '2px 0 0' }}>
              {task.title}
            </h2>
          </div>
          <button type="button" className="icon-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {task.body && <p className="te-advice">{task.body}</p>}

        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="field">
          <span>Due date</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        {!custom && task.suggestedDue && (
          <div className="tiny te-suggest">
            {task.ruleDated ? 'Rule-based date' : 'Suggested'}: {formatShort(task.suggestedDue)}
            {due !== task.suggestedDue && (
              <button type="button" className="td-link" onClick={() => setDue(task.suggestedDue)}>
                Use suggested date
              </button>
            )}
          </div>
        )}
        {task.legal && task.ruleDated && due && due !== task.suggestedDue && (
          <p className="tiny warn-text">
            This is a legal step. Its suggested date comes from the notice rules, so moving it later can leave you short of time.
          </p>
        )}

        <div className="field">
          <span id="te-who">Who's doing it</span>
          <div className="seg" role="radiogroup" aria-labelledby="te-who">
            {ASSIGNEES.map((a) => (
              <button
                key={a || 'none'}
                type="button"
                role="radio"
                aria-checked={assignee === a}
                className={`seg-btn${assignee === a ? ' on' : ''}`}
                onClick={() => setAssignee(a)}
              >
                {label(a)}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" />
        </label>

        <div className="sheet-actions">
          <button className="btn" type="button" onClick={save}>
            Save
          </button>
          <button className="btn ghost" type="button" onClick={onDetails}>
            Details
          </button>
        </div>
        <div className="te-secondary">
          {gone ? (
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                dispatch({ type: 'editTask', key: task.key, patch: { hidden: undefined, removed: undefined } })
                onClose()
              }}
            >
              Show again
            </button>
          ) : (
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                dispatch({ type: 'editTask', key: task.key, patch: { hidden: true } })
                onClose()
              }}
            >
              Hide
            </button>
          )}
          {!task.removed && (
            <button className="text-btn danger" type="button" onClick={() => onDelete(task)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
