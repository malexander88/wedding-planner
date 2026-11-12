import { useState, type ReactNode } from 'react'
import type { VenueType } from '../data/venues'
import { CategoryIcon } from './Icons'
import { categoryImage, photoVariant, venueImage, type CardPhoto } from '../lib/art'

/** Background tones per venue type, so a results list isn't a wall of the same green tile. */
const TONES: Record<VenueType | 'category', [string, string]> = {
  hotel: ['#264A3B', '#132219'],
  castle: ['#34495A', '#18232C'],
  house: ['#4A5233', '#20261A'],
  estate: ['#32563A', '#15261A'],
  barn: ['#5A3F2A', '#2A1C13'],
  culture: ['#2B4C55', '#132327'],
  hall: ['#4A4639', '#211F1A'],
  restaurant: ['#5A2F3A', '#26131A'],
  club: ['#2F5A3E', '#14271B'],
  registrar: ['#2D3A5A', '#141A29'],
  other: ['#1F3B2D', '#16281F'],
  category: ['#2A4634', '#16281F'],
}

const G = '#D9BC7E' // gold line
const I = '#F8F1DF' // ivory accents

function Drawing({ type }: { type: VenueType }) {
  const s = { fill: 'none', stroke: G, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (type) {
    case 'hotel':
      return (
        <g {...s}>
          <path d="M38 64V24h44v40M30 64h60" />
          {[30, 39, 48].map((y) => [45, 56, 67].map((x) => <rect key={`${x}${y}`} x={x} y={y} width="6" height="5" rx="1" />))}
          <path d="M55 64v-8h10v8M60 24v-9l8 3-8 3" />
        </g>
      )
    case 'castle':
      return (
        <g {...s}>
          <path d="M30 64V30h8v5h6v-5h8v34M68 64V30h8v5h6v-5h8v34M52 64V40h16v24M26 64h68" />
          <path d="M56 64v-9a4 4 0 0 1 8 0v9M34 42v5M86 42v5" />
          <path d="M72 30v-12l7 3-7 3" />
        </g>
      )
    case 'house':
      return (
        <g {...s}>
          <path d="M28 64V40h64v24M24 64h72M40 40l20-16 20 16M60 64V52M54 64V52h12v12" />
          {[34, 44, 72, 80].map((x) => <rect key={x} x={x} y="46" width="5" height="7" rx="1" />)}
          <circle cx="60" cy="34" r="2.5" />
        </g>
      )
    case 'estate':
      return (
        <g {...s}>
          <path d="M22 64h76M40 64V48M40 48c-9 0-12-8-7-13 0-7 9-10 13-5 6-2 11 4 8 9 4 5-1 9-6 9zM70 64V40h18v24M70 40l9-7 9 7" />
          <path d="M92 64v-6M98 64v-6M64 64v-6M58 64v-6" />
        </g>
      )
    case 'barn':
      return (
        <g {...s}>
          <path d="M34 64V38l26-16 26 16v26M28 64h64M48 64V46h24v18M48 46l24 18M72 46L48 64" />
          <path d="M26 30c10 6 20 6 34 0s24-6 34 0" strokeDasharray="1 4" stroke={I} />
        </g>
      )
    case 'culture':
      return (
        <g {...s}>
          <path d="M30 36l30-14 30 14H30zM32 64h56M34 60h52M38 40v20M50 40v20M70 40v20M82 40v20" />
          <circle cx="60" cy="30" r="2.5" />
        </g>
      )
    case 'hall':
      return (
        <g {...s}>
          <path d="M30 64V40h60v24M26 64h68M52 40V24h16v16M60 18v6" />
          <circle cx="60" cy="31" r="4" />
          <path d="M60 31v-2M60 31h2M40 64V50a4 4 0 0 1 8 0v14M72 64V50a4 4 0 0 1 8 0v14M56 64V52h8v12" />
        </g>
      )
    case 'restaurant':
      return (
        <g {...s}>
          <path d="M44 26h14l-2 14a5 5 0 0 1-10 0zM51 45v15M45 60h12M62 26h14l-2 14a5 5 0 0 1-10 0zM69 45v15M63 60h12" />
          <path d="M57 22l3-5 3 5" stroke={I} />
        </g>
      )
    case 'club':
      return (
        <g {...s}>
          <path d="M20 64c14-10 28-12 40-8s26 4 40-4M58 56V22l16 6-16 6" />
          <ellipse cx="58" cy="57" rx="6" ry="2" />
        </g>
      )
    case 'registrar':
      return (
        <g {...s}>
          <rect x="42" y="20" width="36" height="44" rx="3" />
          <path d="M49 30h22M49 37h22M49 44h14" />
          <circle cx="68" cy="55" r="5" />
          <circle cx="62" cy="55" r="5" />
        </g>
      )
    default:
      return (
        <g {...s}>
          <circle cx="54" cy="44" r="11" />
          <circle cx="67" cy="44" r="11" />
          <path d="M60 24l2 4 4 1-4 1-2 4-2-4-4-1 4-1z" fill={G} stroke="none" />
        </g>
      )
  }
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Line drawing for the kind of place (fallback when a photo can't load). */
function VenueLineArt({ type, seed, photo, alt = '', className = '' }: { type: VenueType; seed: string; photo?: string; alt?: string; className?: string }) {
  if (photo) return <img className={`venue-art ${className}`} src={photo} alt={alt} loading="lazy" />
  const [a, b] = TONES[type]
  const h = hash(seed)
  const angle = 120 + (h % 60)
  const glowX = 20 + (h % 60)
  const id = `va${h % 100000}`
  return (
    <svg className={`venue-art ${className}`} viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <defs>
        <linearGradient id={`${id}g`} gradientTransform={`rotate(${angle - 90} .5 .5)`}>
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
        <radialGradient id={`${id}r`} cx={`${glowX}%`} cy="20%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity=".14" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="80" fill={`url(#${id}g)`} />
      <rect width="120" height="80" fill={`url(#${id}r)`} />
      <Drawing type={type} />
    </svg>
  )
}

/** Same treatment for non-venue suppliers: the category icon on a tinted card. */
function CategoryLineArt({ category, className = '' }: { category: string; className?: string }) {
  return (
    <div className={`venue-art cat-art ${className}`} data-cat={category}>
      <CategoryIcon category={category} />
    </div>
  )
}

// ---- Photographic imagery (round 8b) ----
// One editorial photo per kind of venue and per supplier category (public/images/cat/*.webp), varied per
// card by crop and mirroring so a list of hotels doesn't look copy-pasted. A Google photo is shown instead
// only when that place was already opened this session (never fetched just to fill a card), with its credit.

function Photo({ src, seed, alt, className, fallback, credit }: { src: string; seed: string; alt: string; className: string; fallback: ReactNode; credit?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  const v = photoVariant(seed)
  const img = (
    <img
      className={`venue-art photo ${className}`}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={credit ? undefined : { objectPosition: `${v.x}% ${v.y}%`, transform: v.flip ? 'scaleX(-1)' : undefined }}
    />
  )
  if (!credit) return img
  return (
    <span className={`art-wrap ${className}`}>
      {img}
      <span className="art-credit">Photo: {credit} · Google</span>
    </span>
  )
}

/** Venue picture: its own photo, else a Google photo already loaded this session, else the editorial photo for its type. */
export function VenueArt({ type, seed, photo, google, alt = '', className = '' }: { type: VenueType; seed: string; photo?: string; google?: CardPhoto | null; alt?: string; className?: string }) {
  const fallback = <VenueLineArt type={type} seed={seed} alt={alt} className={className} />
  if (photo) return <img className={`venue-art ${className}`} src={photo} alt={alt} loading="lazy" />
  if (google) return <Photo src={google.url} seed={seed} alt={alt} className={className} fallback={fallback} credit={google.attributions.map((a) => a.name).join(', ') || 'Google user'} />
  return <Photo src={venueImage(type)} seed={seed} alt={alt} className={className} fallback={fallback} />
}

export function CategoryArt({ category, seed = category, google, className = '' }: { category: string; seed?: string; google?: CardPhoto | null; className?: string }) {
  const fallback = <CategoryLineArt category={category} className={className} />
  if (google) return <Photo src={google.url} seed={seed} alt="" className={className} fallback={fallback} credit={google.attributions.map((a) => a.name).join(', ') || 'Google user'} />
  return <Photo src={categoryImage(category)} seed={seed} alt="" className={className} fallback={fallback} />
}
