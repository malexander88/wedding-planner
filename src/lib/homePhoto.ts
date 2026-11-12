// The couple's own photo on Home. Resized and compressed in the browser, then kept in this device's
// IndexedDB (same database and store as the plan, under its own key, so no schema change). Deliberately
// NOT synced or included in plan backups: photos are large and personal, and each phone can have its own.
import { useEffect, useState } from 'react'
import { getItem, removeItem, setItem } from '../storage/indexeddb'

export const HOME_PHOTO_KEY = 'homePhoto'
export const MAX_EDGE = 1600
const TARGET_BYTES = 450 * 1024
const EVENT = 'wp-home-photo'

export interface HomePhoto {
  dataUrl: string
  width: number
  height: number
  bytes: number
  type: string
  updatedAt: string
  /** Vertical focus, 0 (top) – 100 (bottom). */
  focusY: number
}

/** Scale (w, h) down so the long edge is at most `max`, keeping the shape. Never scales up. */
export function fitWithin(w: number, h: number, max = MAX_EDGE): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/** Bytes of a base64 data URL's payload. */
export function dataUrlBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
}

async function decode(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number; close?: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { src: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    await img.decode()
    URL.revokeObjectURL(url)
    return { src: img, w: img.naturalWidth, h: img.naturalHeight }
  }
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q))
const toDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result))
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(b)
  })

/** Resize to ≤1600 px and compress (WebP where the browser can, else JPEG) to roughly ≤450 KB. */
export async function prepareHomePhoto(file: Blob): Promise<HomePhoto> {
  if (!file.type.startsWith('image/')) throw new Error('That isn’t a photo.')
  const img = await decode(file)
  let edge = MAX_EDGE
  let quality = 0.82
  let out: Blob | null = null
  let size = fitWithin(img.w, img.h, edge)
  for (let i = 0; i < 4; i++) {
    size = fitWithin(img.w, img.h, edge)
    const c = document.createElement('canvas')
    c.width = size.width
    c.height = size.height
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img.src, 0, 0, size.width, size.height)
    out = await toBlob(c, 'image/webp', quality)
    if (!out || out.type !== 'image/webp') out = await toBlob(c, 'image/jpeg', quality) // Safari can't write WebP
    if (out && out.size <= TARGET_BYTES) break
    edge = Math.round(edge * 0.8)
    quality = Math.max(0.6, quality - 0.08)
  }
  img.close?.()
  if (!out) throw new Error('Couldn’t read that photo.')
  const dataUrl = await toDataUrl(out)
  return { dataUrl, width: size.width, height: size.height, bytes: out.size, type: out.type, updatedAt: new Date().toISOString(), focusY: 45 }
}

export async function saveHomePhoto(p: HomePhoto | null): Promise<void> {
  if (p) await setItem(HOME_PHOTO_KEY, p)
  else await removeItem(HOME_PHOTO_KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function useHomePhoto(): HomePhoto | null | undefined {
  const [photo, setPhoto] = useState<HomePhoto | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    const load = () =>
      getItem<HomePhoto>(HOME_PHOTO_KEY)
        .then((p) => live && setPhoto(p ?? null))
        .catch(() => live && setPhoto(null))
    load()
    window.addEventListener(EVENT, load)
    return () => {
      live = false
      window.removeEventListener(EVENT, load)
    }
  }, [])
  return photo
}
