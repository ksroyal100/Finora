import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/security/rbac'
import { renderNewsletterHtml, NewsletterContent } from '@/lib/email/newsletter-template'
import { sendRawEmail } from '@/lib/email/resend'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

// POST /api/admin/cc/newsletters/[id]/test — sends ONE email to the given
// address using the real template and Resend call, so you can confirm
// actual delivery (domain verification, API key, spam placement) before
// trusting a send to your whole subscriber list.
export const POST = withAdmin(async (req) => {
  const segments = req.nextUrl.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 2] // .../newsletters/[id]/test

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Please provide a valid email address', 400)

  const db = createAdminClient()
  const { data: newsletter, error } = await db.from('newsletters').select('*').eq('id', id).single()
  if (error || !newsletter) return apiError('Newsletter not found', 404)

  const content = newsletter.content as NewsletterContent
  const html = renderNewsletterHtml({
    subject: `[TEST] ${newsletter.subject}`,
    preheader: newsletter.preheader ?? '',
    fromName: newsletter.from_name ?? 'Finora',
    content,
    // A fake but validly-signed identifier — clicking unsubscribe on a
    // test send is harmless (no real recipient row exists to update).
    unsubscribeUrl: buildUnsubscribeUrl('test-send', 'subscriber'),
  })

  const result = await sendRawEmail({ to: parsed.data.email, subject: `[TEST] ${newsletter.subject}`, html })

  if (!result.success) {
    // Surface the RAW error from Resend — this is the actual diagnostic
    // value here. "Something went wrong" would hide exactly the
    // information needed to fix a delivery problem (unverified domain,
    // invalid API key, sandbox restrictions, etc.).
    return apiError(`Resend rejected the test send: ${result.error}`, 502)
  }

  return apiSuccess({ sent: true, resend_id: result.id })
})
