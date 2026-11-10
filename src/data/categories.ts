import type { SupplierCategory } from '../types'

export const CATEGORIES: { id: SupplierCategory; label: string; search: string }[] = [
  { id: 'venue', label: 'Venues', search: 'wedding venue' },
  { id: 'officiant', label: 'Registrar & celebrant', search: 'wedding registrar celebrant' },
  { id: 'photographer', label: 'Photographer', search: 'wedding photographer' },
  { id: 'videographer', label: 'Videographer', search: 'wedding videographer' },
  { id: 'catering', label: 'Catering', search: 'wedding caterer' },
  { id: 'florist', label: 'Florist', search: 'wedding florist' },
  { id: 'entertainment', label: 'Music & entertainment', search: 'wedding band DJ' },
  { id: 'cake', label: 'Cake', search: 'wedding cake' },
  { id: 'attire', label: 'Outfits', search: 'wedding dress suit' },
  { id: 'hair', label: 'Hair', search: 'wedding hair stylist' },
  { id: 'makeup', label: 'Makeup', search: 'wedding makeup artist' },
  { id: 'transport', label: 'Transport', search: 'wedding car transport' },
  { id: 'stationery', label: 'Stationery', search: 'wedding stationery invitations' },
  { id: 'decor', label: 'Decor & hire', search: 'wedding decor hire' },
  { id: 'planner', label: 'Planner', search: 'wedding planner' },
  { id: 'other', label: 'Other', search: 'wedding supplier' },
]

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id
}
