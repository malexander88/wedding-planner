import { currencySymbol } from '../lib/money'
import { useState } from 'react'
import { BrandMark, IconQr } from '../components/Icons'
import { JoinPartnerPanel } from '../components/JoinPartnerPanel'
import { useSync } from '../sync/SyncProvider'
import { useNavigate } from 'react-router-dom'
import type { CeremonyType, Season, StyleTag, WeddingProfile } from '../types'
import { useStore } from '../state/store'

const styles: { id: StyleTag; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'rustic', label: 'Rustic barn' },
  { id: 'garden', label: 'Garden' },
  { id: 'castle', label: 'Castle & historic' },
  { id: 'modern', label: 'Modern hotel' },
  { id: 'intimate', label: 'Intimate' },
  { id: 'other', label: 'Something else' },
]

const seasons: { id: Season; label: string }[] = [
  { id: 'any', label: 'No preference yet' },
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
]

const ceremonies: { id: CeremonyType; label: string }[] = [
  { id: 'undecided', label: 'Not sure yet' },
  { id: 'civil', label: 'Civil (registrar)' },
  { id: 'religious', label: 'Religious' },
  { id: 'humanist', label: 'Humanist / belief' },
]

export function Onboarding() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const sync = useSync()
  const [joinMode, setJoinMode] = useState(false)
  const [p, setP] = useState<WeddingProfile>({ ...state.profile })

  const patch = (x: Partial<WeddingProfile>) => setP((cur) => ({ ...cur, ...x }))

  const finish = () => {
    dispatch({ type: 'completeOnboarding', profile: p })
    navigate('/')
  }

  if (joinMode) {
    return (
      <div className="wizard">
        <div className="wizard-brand">
          <div className="brand-mark"><BrandMark /></div>
          <div className="brand-name">Wedding Planner</div>
        </div>
        <div className="kicker">Welcome</div>
        <h1>Join your partner’s plan</h1>
        <p>
          On your partner’s phone, open Wedding Planner and tap <b>Pair with your partner</b> on Home. It shows a QR code and a link — scan the
          code here, or paste the link they sent you.
        </p>
        <div className="card">
          <JoinPartnerPanel cta="Join the shared plan" />
        </div>
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn ghost" type="button" onClick={() => setJoinMode(false)}>
            Start our own plan instead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard">
      <div className="wizard-brand">
        <div className="brand-mark"><BrandMark /></div>
        <div className="brand-name">Wedding Planner</div>
      </div>
      <div className="kicker">Welcome</div>
      <h1>Let’s start from the beginning</h1>
      <p>You do not need a date or anything booked. A few rough answers will shape your checklist and the places we suggest first.</p>
      <div className="step-dots">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && sync.configured && (
        <button type="button" className="card join-entry" onClick={() => setJoinMode(true)}>
          <div className="well"><IconQr /></div>
          <div className="grow">
            <strong>Join my partner’s plan</strong>
            <span>Already started on their phone? Scan their QR code or paste their link.</span>
          </div>
          <span className="btn small">Join</span>
        </button>
      )}

      {step === 0 && (
        <div className="card">
          <h2>Your names</h2>
          <label className="field">
            <span>Partner one</span>
            <input value={p.partnerAName} onChange={(e) => patch({ partnerAName: e.target.value })} placeholder="Alex" />
          </label>
          <label className="field">
            <span>Partner two</span>
            <input value={p.partnerBName} onChange={(e) => patch({ partnerBName: e.target.value })} placeholder="Jordan" />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2>Roughly how many guests?</h2>
          <p>A UK wedding often has a smaller ceremony and meal, then more people in the evening. You can change this later.</p>
          <label className="field">
            <span>Day guests (ceremony and meal) — {p.estimatedDayGuests}</span>
            <input type="range" min={10} max={250} value={p.estimatedDayGuests} onChange={(e) => patch({ estimatedDayGuests: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Evening guests (extra people) — {p.estimatedEveningGuests}</span>
            <input type="range" min={0} max={250} value={p.estimatedEveningGuests} onChange={(e) => patch({ estimatedEveningGuests: Number(e.target.value) })} />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>Your budget</h2>
          <p>One overall figure for the whole day. As you book things, the Budget tab shows how much is committed against it. Not sure yet? Leave it blank and add it later.</p>
          <label className="field">
            <span>Total budget ({currencySymbol()}) — optional</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              placeholder="e.g. 18000"
              value={p.totalBudget || ''}
              onChange={(e) => patch({ totalBudget: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>When and where?</h2>
          <p className="tiny">Season</p>
          <div className="chips" style={{ marginBottom: 16 }}>
            {seasons.map((s) => (
              <button key={s.id} className={`chip ${p.season === s.id ? 'on' : ''}`} onClick={() => patch({ season: s.id })} type="button">
                {s.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Area</span>
            <input value={p.area} onChange={(e) => patch({ area: e.target.value })} />
          </label>
          <p className="tiny">This defaults to Belfast, Antrim and Newtownabbey. Change it if you like — search buttons will follow whatever you type.</p>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h2>The feel of the day</h2>
          <div className="chips" style={{ marginBottom: 16 }}>
            {styles.map((s) => (
              <button key={s.id} className={`chip ${p.style === s.id ? 'on' : ''}`} onClick={() => patch({ style: s.id })} type="button">
                {s.label}
              </button>
            ))}
          </div>
          <p className="tiny">Kind of ceremony</p>
          <div className="chips" style={{ marginBottom: 16 }}>
            {ceremonies.map((s) => (
              <button key={s.id} className={`chip ${p.ceremonyType === s.id ? 'on' : ''}`} onClick={() => patch({ ceremonyType: s.id })} type="button">
                {s.label}
              </button>
            ))}
          </div>
          <label className="inline">
            <input type="checkbox" checked={p.previouslyMarried} onChange={(e) => patch({ previouslyMarried: e.target.checked })} />
            Either of us has been married or in a civil partnership before
          </label>
          <p className="tiny">If so, Northern Ireland recommends giving notice 10 weeks before the wedding instead of 8.</p>
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 18 }}>
        {step > 0 && (
          <button className="btn secondary" type="button" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < 4 ? (
          <button className="btn" type="button" onClick={() => setStep((s) => s + 1)}>
            Continue
          </button>
        ) : (
          <button className="btn" type="button" onClick={finish}>
            Start planning
          </button>
        )}
      </div>
    </div>
  )
}
