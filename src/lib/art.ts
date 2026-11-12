// Card imagery: which editorial photo a venue type or supplier category uses, and a stable per-card variation.
import type { VenueType } from '../data/venues'

const VENUE_IMG: Record<VenueType, string> = {
  hotel: 'hotel', castle: 'castle', house: 'house', estate: 'estate', barn: 'barn', club: 'club',
  restaurant: 'restaurant', hall: 'hall', culture: 'culture', registrar: 'registrar', other: 'officiant',
}
const CAT_IMG: Record<string, string> = {
  venue: 'estate', officiant: 'officiant', photographer: 'photographer', videographer: 'videographer', catering: 'catering',
  florist: 'florist', entertainment: 'entertainment', cake: 'cake', attire: 'attire', hair: 'hair', makeup: 'makeup',
  transport: 'transport', stationery: 'stationery', decor: 'decor', planner: 'planner', other: 'other',
}
export const venueImage = (type: VenueType) => `${import.meta.env.BASE_URL}images/cat/${VENUE_IMG[type] ?? 'officiant'}.webp`
export const categoryImage = (category: string) => `${import.meta.env.BASE_URL}images/cat/${CAT_IMG[category] ?? 'other'}.webp`

/** Crop and mirror chosen from the seed: same card, same look, every time. */
function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function photoVariant(seed: string): { flip: boolean; x: number; y: number } {
  const h = hash(seed)
  return { flip: h % 2 === 1, x: 30 + (h % 41), y: 35 + ((h >> 3) % 31) }
}

export interface CardPhoto {
  url: string
  attributions: { name: string; uri?: string }[]
}

