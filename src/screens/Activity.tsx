import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBack, IconChevron } from '../components/Icons'
import { partnerName, useMe } from '../lib/me'
import { useStore } from '../state/store'
import type { ActivityItem } from '../sync/activity'
import { clearActivity, markActivitySeen, useActivity } from '../sync/activityLog'
import { useSync } from '../sync/SyncProvider'

const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

function dayLabel(t: number, now = new Date()): string {
  const d = new Date(t)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(now) - start(d)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

function byDay(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const out: { label: string; items: ActivityItem[] }[] = []
  for (const it of [...items].sort((a, b) => b.t - a.t)) {
    const label = dayLabel(it.t)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(it)
    else out.push({ label, items: [it] })
  }
  return out
}

export function Activity() {
  const { state } = useStore()
  const sync = useSync()
  const [me] = useMe()
  const who = partnerName(state.profile, me)
  const { log, seenAt, loaded } = useActivity()
  // Keep this visit's highlights even after we mark everything as seen.
  const [visitSeenAt] = useState(seenAt)
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => markActivitySeen(), 1200)
    return () => clearTimeout(t)
  }, [loaded, log.length])

  const fresh = log.filter((x) => x.at > visitSeenAt).length

  return (
    <div className="grid activity-page">
      <header className="page-head">
        <Link to="/" className="text-btn back-link">
          <IconBack style={{ width: 16, height: 16 }} /> Home
        </Link>
        <h1>{who}’s changes</h1>
        <p>What {who} changed on their phone, picked up when your phones sync. Kept on this phone only.</p>
      </header>

      {!sync.paired && !log.length ? (
        <div className="card empty">
          Once your phones are paired, anything {who} changes shows up here in plain words.{' '}
          <Link to="/settings">Pair in Settings</Link>.
        </div>
      ) : !log.length ? (
        <div className="card empty">Nothing yet. When {who} changes something, it will show up here.</div>
      ) : (
        <>
          {fresh > 0 && (
            <p className="activity-new-note" role="status">
              <span className="dot-new" aria-hidden="true" /> {fresh} new since you last looked
            </p>
          )}
          {byDay(log).map((g) => (
            <section key={g.label} className="card activity-day">
              <h2 className="activity-day-label">{g.label}</h2>
              <ul className="activity-list">
                {g.items.map((it) => {
                  const unseen = it.at > visitSeenAt
                  const body = (
                    <>
                      <span className="activity-time">{time(it.t)}</span>
                      <span className="activity-text">
                        <strong>{who}</strong> {it.text}
                        {unseen && <span className="badge-new">New</span>}
                      </span>
                      {it.href && <IconChevron className="activity-go" aria-hidden="true" />}
                    </>
                  )
                  return (
                    <li key={it.id} className={unseen ? 'unseen' : undefined}>
                      {it.href ? <Link to={it.href}>{body}</Link> : <div>{body}</div>}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          <div className="btn-row">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (confirm('Clear this list on this phone? Nothing in your plan changes.')) void clearActivity()
              }}
            >
              Clear this list
            </button>
          </div>
        </>
      )}
    </div>
  )
}
