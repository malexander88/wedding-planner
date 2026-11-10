import { CATEGORIES } from './categories'
import type { SupplierCategory } from '../types'

export function searchUrls(category: SupplierCategory, area: string) {
  const label = CATEGORIES.find((c) => c.id === category)?.search ?? `wedding ${category}`
  const q = `${label} ${area}`
  return {
    google: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    hitched: `https://www.google.com/search?q=${encodeURIComponent(`site:hitched.co.uk ${q}`)}`,
    bridebook: `https://www.google.com/search?q=${encodeURIComponent(`site:bridebook.com ${q}`)}`,
  }
}
