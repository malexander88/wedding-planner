import { useEffect, useState } from 'react'
import { prepareHomePhoto, saveHomePhoto, useHomePhoto } from '../lib/homePhoto'
import { ACCENTS, getAppearance, setAppearance, type Accent, type ThemePref } from '../lib/theme'
import { useStore } from '../state/store'
import { IconCamera } from './Icons'
import { Sheet } from './Sheet'

function usePartnerName() {
  const { state } = useStore()
  return state.profile.partnerBName || 'your partner'
}

/** Pick, preview and remove the Home photo. Kept on this device only (not synced, not in backups). */
export function HomePhotoPicker() {
  const photo = useHomePhoto()
  const partner = usePartnerName()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const choose = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await saveHomePhoto(await prepareHomePhoto(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t use that photo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="photo-picker">
      {photo ? (
        <div className="pp-preview">
          <img src={photo.dataUrl} alt="Your Home photo" style={{ objectPosition: `50% ${photo.focusY}%` }} />
        </div>
      ) : (
        <p className="tiny">No photo yet — Home shows our garden picture until you add one.</p>
      )}
      {photo && (
        <label className="field pp-focus">
          <span>Move the photo up or down</span>
          <input
            type="range"
            min={0}
            max={100}
            value={photo.focusY}
            aria-label="Photo position"
            onChange={(e) => saveHomePhoto({ ...photo, focusY: Number(e.target.value) })}
          />
        </label>
      )}
      <div className="btn-row">
        <label className={`btn${busy ? ' disabled' : ''}`}>
          <IconCamera /> {busy ? 'Preparing…' : photo ? 'Choose another photo' : 'Choose a photo'}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => choose(e.target.files?.[0])} data-testid="home-photo-input" />
        </label>
        {photo && (
          <button type="button" className="btn ghost" onClick={() => saveHomePhoto(null)}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="pill warn">{error}</p>}
      <p className="tiny pp-note">
        <strong>Saved on this device only.</strong> It isn’t synced to {partner}’s phone or included in backups, so each of you can pick your own.
        {photo && ` Stored at ${photo.width}×${photo.height}, ${Math.round(photo.bytes / 1024)} KB.`}
      </p>
    </div>
  )
}

export function HomePhotoSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet id="hp" kicker="Home" title="Your photo" onClose={onClose}>
      <HomePhotoPicker />
    </Sheet>
  )
}

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: 'Match phone' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

export function AppearanceCard() {
  const [pref, setPref] = useState(getAppearance)
  useEffect(() => {
    const on = () => setPref(getAppearance())
    window.addEventListener('wp-appearance', on)
    return () => window.removeEventListener('wp-appearance', on)
  }, [])
  const pick = (next: Partial<{ theme: ThemePref; accent: Accent }>) => setAppearance(next)
  return (
    <section className="card appearance" aria-labelledby="appearance-title">
      <h2 id="appearance-title">Appearance</h2>
      <p className="tiny">Just for this device.</p>
      <div className="field">
        <span id="theme-label">Theme</span>
        <div className="seg theme-seg" role="radiogroup" aria-labelledby="theme-label">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={pref.theme === t.id} className={`seg-btn${pref.theme === t.id ? ' on' : ''}`} onClick={() => pick({ theme: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span id="accent-label">Accent</span>
        <div className="swatches" role="radiogroup" aria-labelledby="accent-label">
          {ACCENTS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={pref.accent === a.id} className={`swatch${pref.accent === a.id ? ' on' : ''}`} onClick={() => pick({ accent: a.id })}>
              <i style={{ background: a.swatch }} aria-hidden="true" />
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Home photo</span>
        <HomePhotoPicker />
      </div>
    </section>
  )
}
