import { createAdminClient } from '@/lib/supabase/server'
import { withAuth, apiSuccess, apiError } from '@/lib/security/rbac'

// GET /api/newsletter/archive — any logged-in user can see past sent
// newsletters (this is content that already went out to subscribers by
// email; there's nothing more sensitive here than what was already
// emailed). Only exposes the fields a reader needs — not recipient
// counts, internal status, or anything admin-only.
export const GET = withAuth(async () => {
  const db = createAdminClient()
  const { data, error } = await db
    .from('newsletters')
    .select('id, subject, preheader, content, sent_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(50)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ newsletters: data ?? [] })
})
