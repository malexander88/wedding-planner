// Google Places (New) lookups — OFF until a key is set up (see PLAN.md, "Google Places").
// The key never reaches the browser: the app calls our Supabase Edge Function, which holds it.
// To switch on: deploy supabase/functions/places, then build with
//   VITE_PLACES_ENABLED=true VITE_PLACES_FUNCTION_URL=https://<project>.supabase.co/functions/v1/places
import { SUPABASE_URL } from './supabase'

const env = import.meta.env
export const PLACES_ENABLED = env.VITE_PLACES_ENABLED === 'true'
export const PLACES_FUNCTION_URL: string = env.VITE_PLACES_FUNCTION_URL || `${SUPABASE_URL}/functions/v1/places`
