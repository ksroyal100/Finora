// src/app/api/contact/route.ts
//
// Public endpoint (no auth) — someone locked out of their account, or a
// prospective user with a pre-sales question, needs to reach support without
// signing in. Reuses the existing Resend email infrastructure exactly as
// notification.service.ts does, so no new email plumbing is introduced.

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP } from '@/lib/security/rbac'
import { sendNotificationEmail } from '@/lib/email/resend'
import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  topic: z.enum(['general', 'billing', 'bug', 'refund', 'account_deletion', 'security', 'other']).default('general'),
  message: z.string().min(10).max(4000),
  // Honeypot field — real users never fill this in; bots usually do
  company: z.string().max(0).optional(),
})

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL ?? 'support@finora.app'

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const limit = checkRateLimit(ip, 'contact-form', 5, 60_000) // 5 submissions/min/IP
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests. Please try again in a minute.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Please check your inputs and try again.' }, { status: 400 })
  }
  if (parsed.data.company) {
    // Honeypot tripped — silently succeed so the bot doesn't learn anything, but send nothing
    return NextResponse.json({ success: true })
  }

  const { name, email, topic, message } = parsed.data
  const topicLabel: Record<string, string> = {
    general: 'General question', billing: 'Billing issue', bug: 'Bug report',
    refund: 'Refund request', account_deletion: 'Account deletion help', security: 'Security concern', other: 'Other',
  }

  try {
    // Notify support, with reply-to set to the user so they can just hit "reply"
    await sendNotificationEmail({
      to: SUPPORT_INBOX,
      title: `[${topicLabel[topic]}] New contact form submission`,
      body: `From: ${name} (${email})\n\n${message}`,
    })

    // Confirm to the user their message was received
    await sendNotificationEmail({
      to: email,
      title: 'We received your message',
      body: `Hi ${name}, thanks for reaching out to Finora support. We've received your message and will get back to you as soon as possible.\n\nYour message:\n${message}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact] failed to send email:', err)
    return NextResponse.json({ success: false, error: 'Could not send your message right now. Please try again shortly.' }, { status: 500 })
  }
}
