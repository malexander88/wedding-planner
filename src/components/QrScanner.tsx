import { useEffect, useRef, useState } from 'react'
import { parseJoin } from '../sync/secret'

type Detect = (src: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>

interface BarcodeDetectorLike {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>
}

/** Uses the phone's own QR reader where there is one, otherwise jsQR (loaded only when scanning). */
async function makeDetector(): Promise<Detect> {
  // Never inside an Android WebView (our APK or anyone else's): there BarcodeDetector binds to Google Play
  // services' shape detection and crashes the host app unless it declares Play services. jsQR is fine.
  const inWebView = /; wv\)/.test(navigator.userAgent) || '__wpAndroid' in window
  const BD = inWebView ? undefined : (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): BarcodeDetectorLike; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
  if (BD) {
    try {
      const formats = (await BD.getSupportedFormats?.()) ?? ['qr_code']
      if (formats.includes('qr_code')) {
        const bd = new BD({ formats: ['qr_code'] })
        return async (video) => {
          const found = await bd.detect(video)
          return found[0]?.rawValue ?? null
        }
      }
    } catch {
      /* fall through to jsQR */
    }
  }
  const { default: jsQR } = await import('jsqr')
  return async (video, canvas) => {
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return null
    const scale = Math.min(1, 720 / Math.max(w, h))
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

function cameraError(e: unknown): string {
  const name = e instanceof DOMException || e instanceof Error ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera access was turned down. Allow the camera for this app in your phone’s settings, or paste the link instead.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. Paste the link instead.'
  if (name === 'NotReadableError') return 'The camera is busy in another app. Close it and try again, or paste the link instead.'
  return 'The camera could not be started here. Paste the link instead.'
}

export function canScanQr(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/** Full-screen camera view that reads a partner's sharing QR code. Calls onLink with the link it finds. */
export function QrScanner({ onLink, onClose }: { onLink: (link: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    ;(async () => {
      try {
        if (!canScanQr()) throw new Error('unsupported')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) return
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play().catch(() => undefined)
        const detect = await makeDetector()
        const tick = async () => {
          if (stopped || done.current) return
          try {
            const text = v.readyState >= 2 ? await detect(v, canvas) : null
            if (text) {
              if (parseJoin(text)) {
                done.current = true
                onLink(text)
                return
              }
              setHint('That QR code isn’t a Wedding Planner sharing link. Scan the code under Pair with your partner on their phone.')
            }
          } catch {
            /* keep trying */
          }
          timer = window.setTimeout(tick, 200)
        }
        void tick()
      } catch (e) {
        if (!stopped) setError(cameraError(e))
      }
    })()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onLink])

  return (
    <div className="modal-back scanner-back" role="dialog" aria-modal="true" aria-labelledby="scan-title">
      <div className="modal scanner">
        <div className="kicker">Join your partner’s plan</div>
        <h2 id="scan-title">Scan their QR code</h2>
        {error ? (
          <p className="warn-text">{error}</p>
        ) : (
          <>
            <div className="scanner-view">
              <video ref={videoRef} playsInline muted aria-label="Camera view" />
              <div className="scanner-frame" aria-hidden="true" />
            </div>
            <p className="tiny">
              On your partner’s phone open <b>Pair with your partner</b> and point this camera at the QR code.
            </p>
            {hint && <p className="tiny warn-text">{hint}</p>}
          </>
        )}
        <div className="btn-row">
          <button className="btn secondary" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
