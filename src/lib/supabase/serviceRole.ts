// src/lib/supabase/serviceRole.ts
//
// This is the ONLY place in the Finora frontend that uses the Supabase service role
// key. Every other part of this app deliberately uses the anon key + RLS
// (see src/lib/supabase/client.ts and server.ts) so that a bug can never
// accidentally bypass a user's row-level security. Account deletion is the
// one operation that genuinely needs elevated privileges — deleting a row
// from auth.users can only be done with the service role, via the Admin API.
//
// Never import this into a Client Component or expose SUPABASE_SERVICE_ROLE_KEY
// with a NEXT_PUBLIC_ prefix.

import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('[Finora] Missing SUPABASE_SERVICE_ROLE_KEY — required for account deletion.')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
