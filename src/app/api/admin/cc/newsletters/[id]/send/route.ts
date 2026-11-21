import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { renderNewsletterHtml, NewsletterContent } from '@/lib/email/newsletter-template'
import { sendRawEmailBatch } from '@/lib/email/resend'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token'

// POST /api/admin/cc/newsletters/[id]/send
//
// Safe to retry: recipients already logged as 'sent' in a prior
// (possibly partial/failed) attempt are skipped, so re-running this
// after a timeout or partial failure won't double-send to anyone.
export const POST = withAdmin(async (req, { userId }) => {
  const segments = req.nextUrl.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 2] // .../newsletters/[id]/send

  const db = createAdminClient()

  const { data: newsletter, error: fetchError } = await db.from('newsletters').select('*').eq('id', id).single()
  if (fetchError || !newsletter) return apiError('Newsletter not found', 404)
  if (newsletter.status === 'sending') return apiError('This campaign is already sending', 409)
  if (newsletter.status === 'sent') return apiError('This campaign has already been sent', 409)

  // Mark as sending immediately so a second concurrent click can't
  // start a duplicate send while this one is in progress.
  await db.from('newsletters').update({ status: 'sending' }).eq('id', id)

  // Opted-in subscribers only. LEFT JOIN via a manual fetch since
  // Supabase's nested-filter syntax on a joined table can't filter
  // the parent by a child column directly in one call reliably here.
  const { data: optedIn, error: subError } = await db
    .from('notification_preferences')
    .select('user_id')
    .eq('marketing_emails', true)

  if (subError) {
    await db.from('newsletters').update({ status: 'failed' }).eq('id', id)
    return apiError('Failed to load subscriber list: ' + subError.message, 500)
  }

  const userIds = (optedIn ?? []).map(r => r.user_id)

  const { data: profiles, error: profileError } = userIds.length
    ? await db.from('profiles').select('id, email').in('id', userIds).not('email', 'is', null)
    : { data: [], error: null }

  if (profileError) {
    await db.from('newsletters').update({ status: 'failed' }).eq('id', id)
    return apiError('Failed to load recipient emails: ' + profileError.message, 500)
  }

  // Anonymous, pre-signup subscribers (landing-page email capture) — no
  // user_id, so they're tracked separately and merged in here.
  const { data: anonSubs, error: anonError } = await db
    .from('newsletter_subscribers')
    .select('id, email')
    .eq('status', 'subscribed')

  if (anonError) {
    await db.from('newsletters').update({ status: 'failed' }).eq('id', id)
    return apiError('Failed to load newsletter subscribers: ' + anonError.message, 500)
  }

  type Recipient = { email: string; userId: string | null; subscriberId: string | null }
  const byEmail = new Map<string, Recipient>()

  for (const p of profiles ?? []) {
    if (p.email) byEmail.set(p.email.toLowerCase(), { email: p.email, userId: p.id, subscriberId: null })
  }
  // A registered, opted-in user takes precedence if the same email also
  // appears as an anonymous subscriber (e.g. they signed up on the
  // landing page before creating an account) — avoids double-sending
  // and keeps the unsubscribe link pointed at the right table.
  for (const s of anonSubs ?? []) {
    const key = s.email.toLowerCase()
    if (!byEmail.has(key)) byEmail.set(key, { email: s.email, userId: null, subscriberId: s.id })
  }

  const recipients = Array.from(byEmail.values())
  if (recipients.length === 0) {
    await db.from('newsletters').update({ status: 'failed' }).eq('id', id)
    return apiError('No subscribers to send to', 400)
  }

  // Log every recipient up front (idempotent via the unique constraint
  // on newsletter_id+email) — this is what makes a retry safe.
  await db.from('newsletter_recipients').upsert(
    recipients.map(r => ({ newsletter_id: id, user_id: r.userId, email: r.email, status: 'pending' })),
    { onConflict: 'newsletter_id,email', ignoreDuplicates: true },
  )

  // Skip anyone already marked 'sent' from a previous attempt.
  const { data: alreadySent } = await db
    .from('newsletter_recipients')
    .select('email')
    .eq('newsletter_id', id)
    .eq('status', 'sent')

  const alreadySentEmails = new Set((alreadySent ?? []).map(r => r.email))
  const toSend = recipients.filter(r => !alreadySentEmails.has(r.email))

  await db.from('newsletters').update({ recipient_count: recipients.length }).eq('id', id)

  if (toSend.length === 0) {
    await db.from('newsletters').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id)
    return apiSuccess({ recipient_count: recipients.length, sent_count: alreadySentEmails.size, skipped: 'already sent to everyone in a prior attempt' })
  }

  const content = newsletter.content as NewsletterContent
  const emailJobs = toSend.map(r => ({
    to: r.email as string,
    subject: newsletter.subject as string,
    html: renderNewsletterHtml({
      subject: newsletter.subject,
      preheader: newsletter.preheader ?? '',
      fromName: newsletter.from_name ?? 'Finora',
      content,
      unsubscribeUrl: r.userId ? buildUnsubscribeUrl(r.userId, 'user') : buildUnsubscribeUrl(r.subscriberId as string, 'subscriber'),
    }),
  }))

  const results = await sendRawEmailBatch(emailJobs)

  const sentEmails = results.filter(r => r.success).map(r => r.to)
  const failedResults = results.filter(r => !r.success)

  if (sentEmails.length > 0) {
    await db
      .from('newsletter_recipients')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('newsletter_id', id)
      .in('email', sentEmails)
  }
  for (const f of failedResults) {
    await db
      .from('newsletter_recipients')
      .update({ status: 'failed', error: f.error ?? 'Unknown error' })
      .eq('newsletter_id', id)
      .eq('email', f.to)
  }

  const totalSent = alreadySentEmails.size + sentEmails.length
  const finalStatus = failedResults.length > 0 && sentEmails.length === 0 ? 'failed' : 'sent'
  // Surface the actual Resend error, not just a count — this is the
  // difference between "something failed" and "here's exactly why."
  const sampleError = failedResults[0]?.error ?? null

  await db
    .from('newsletters')
    .update({
      status: finalStatus,
      sent_count: totalSent,
      failed_count: failedResults.length,
      sent_at: new Date().toISOString(),
      html_snapshot: emailJobs[0]?.html ?? null,
    })
    .eq('id', id)

  await createAuditLog({
    adminId: userId,
    action: 'newsletter.send',
    resourceType: 'newsletter',
    resourceId: id as string,
    metadata: { recipient_count: recipients.length, sent_count: totalSent, failed_count: failedResults.length, sample_error: sampleError },
  })

  return apiSuccess({
    recipient_count: recipients.length,
    sent_count: totalSent,
    failed_count: failedResults.length,
    status: finalStatus,
    sample_error: sampleError,
  })
})
