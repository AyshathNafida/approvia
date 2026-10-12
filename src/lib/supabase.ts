import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

// Keep the development notice available before deployment variables are set.
// Feature code must handle an unconfigured client before making requests.
export const supabase = url && publishableKey
  ? createClient(url, publishableKey)
  : null
