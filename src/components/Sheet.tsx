import { useEffect, useRef, type ReactNode } from 'react'

/** Bottom sheet on phones, centred dialog on desktop (same classes as the task sheets). */
export function Sheet({
  id,
  kicker,
  title,
  onClose,
  children,
  wide,
}: {
  id: string
  kicker?: string
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
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
  return (
    <div className="modal-back sheet-back" onClick={onClose}>
      <div
        className={`modal sheet${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            {kicker && <div className="kicker">{kicker}</div>}
            <h2 id={`${id}-title`} style={{ margin: '2px 0 0' }}>
              {title}
            </h2>
          </div>
          <button type="button" className="icon-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
