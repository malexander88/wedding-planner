import type { Supplier } from '../types'
import { CATALOGUE } from './catalogue'
import { COUNCILS, venueFeeBand, type VenueFee } from './legal'
import { directoryVenue } from './venues'

/** A venue's registrar fee band, using the checked directory/starter facts when it came from there. */
export function venueFee(v: Pick<Supplier, 'catalogueId' | 'council' | 'name' | 'area'>): VenueFee {
  const dir = v.catalogueId ? directoryVenue(v.catalogueId) : undefined
  // Register-office ceremonies have their own (usually lower) fee, which most councils don't publish.
  // The approved-venue rate would be wrong, so say "ask" instead of guessing.
  if (dir?.kind === 'registrar') {
    const c = COUNCILS[v.council ?? dir.council]
    return { council: c.id, band: null, label: `${c.short} registrar office · office fee not published` }
  }
  const cat = v.catalogueId ? CATALOGUE.find((c) => c.id === v.catalogueId) : undefined
  return venueFeeBand(v, { area: dir?.town ?? cat?.area, council: dir?.council })
}
