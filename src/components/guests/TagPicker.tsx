import { useState } from 'react'

/** Toggle existing tags or type a new one. */
export function TagPicker({ value, options, onChange }: { value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('')
  const all = [...new Set([...options, ...value])]
  const add = () => {
    const t = text.trim().replace(/^#/, '')
    if (t && !value.includes(t)) onChange([...value, t])
    setText('')
  }
  return (
    <div className="tag-picker">
      <div className="chips">
        {all.map((t) => {
          const on = value.includes(t)
          return (
            <button
              key={t}
              type="button"
              className={`chip small${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}
            >
              #{t}
            </button>
          )
        })}
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="New tag, e.g. wedding party"
          aria-label="New tag"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="button" className="btn secondary small" onClick={add} disabled={!text.trim()}>
          Add tag
        </button>
      </div>
    </div>
  )
}
