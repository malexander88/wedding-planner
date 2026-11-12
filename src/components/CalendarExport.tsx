import { useState } from 'react'
import { buildCalendar, deadlineEvents, downloadIcs, googleCalendarUrl, taskEvent } from '../lib/ics'
import { localToday } from '../data/plan'
import { useStore } from '../state/store'
import type { PlanTask } from '../types'
import { IconCalendar } from './Icons'

/** One download with every upcoming deadline (and reminders) for Apple Calendar, Google Calendar or Outlook. */
export function CalendarCard() {
  const { state, allTasks } = useStore()
  const [done, setDone] = useState<number | null>(null)
  const today = localToday()
  const names = [state.profile.partnerAName, state.profile.partnerBName].filter(Boolean).join(' & ') || 'Our'
  const { events, skippedPast } = deadlineEvents(allTasks, today, { date: state.profile.date, names })
  const taskCount = events.filter((e) => e.uid.startsWith('task-')).length
  if (!state.profile.date) return null
  const download = () => {
    downloadIcs(buildCalendar(events, `${names} — wedding deadlines`), 'wedding-deadlines.ics')
    setDone(taskCount)
  }
  return (
    <section className="card calendar-card" aria-labelledby="cal-export-title">
      <div className="well" aria-hidden="true">
        <IconCalendar />
      </div>
      <div className="grow">
        <h2 id="cal-export-title">Deadlines in your calendar</h2>
        <p className="tiny">
          {taskCount} upcoming {taskCount === 1 ? 'task' : 'tasks'} and the day itself, each with a reminder at 9am a week before and on the day. Works with
          Apple Calendar, Outlook and Google Calendar (import the file). If dates change, download again — tasks keep the same IDs, so most calendars update
          rather than duplicate.
          {skippedPast > 0 && ` ${skippedPast} overdue ${skippedPast === 1 ? 'task isn’t' : 'tasks aren’t'} included.`}
        </p>
        {done !== null && <p className="tiny ok-text" role="status">Saved wedding-deadlines.ics — open it to add the events.</p>}
      </div>
      <button type="button" className="btn small" onClick={download} disabled={!events.length}>
        Download .ics
      </button>
    </section>
  )
}

/** Per-task "Add to calendar": an .ics for Apple/Outlook, or Google Calendar's add-event page. */
export function TaskCalendarLinks({ task }: { task: PlanTask }) {
  const [open, setOpen] = useState(false)
  if (task.done || !task.dueDate) return null
  const ev = taskEvent(task)
  return (
    <span className="cal-links">
      <button type="button" className="td-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Add to calendar
      </button>
      {open && (
        <span className="cal-links-menu">
          <button type="button" className="td-link" onClick={() => downloadIcs(buildCalendar([ev], 'Wedding'), `${task.key}.ics`)}>
            Apple / Outlook (.ics)
          </button>
          <a className="td-link" href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">
            Google Calendar
          </a>
        </span>
      )}
    </span>
  )
}
