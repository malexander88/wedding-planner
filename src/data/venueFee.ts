import type { Supplier } from '../types'
import { CATALOGUE } from './catalogue'
import { venueFeeBand } from './legal'

/** A shortlisted venue's registrar fee band, using the checked catalogue area when it came from the starter list. */
export function venueFee(v: Pick<Supplier, 'catalogueId' | 'council' | 'name' | 'area'>) {
  return venueFeeBand(v, v.catalogueId ? CATALOGUE.find((c) => c.id === v.catalogueId)?.area : undefined)
}
