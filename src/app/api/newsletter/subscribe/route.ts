import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIP } from '@/lib/security/rbac'
import { z } from 'zod'

const schema = z.object({ email: z.string().email().max(320) })

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  // Generous but real limit — this is a public, unauthenticated form,
  // a common target for scraping/spam bots.
  if (!checkRateLimit(ip, 'newsletter-subscribe', 10, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase().trim()
  const db = createAdminClient()

  // Upsert: a returning visitor who previously unsubscribed and signs up
  // again should be re-subscribed, not silently rejected on the unique
  // constraint.
  const { error } = await db
    .from('newsletter_subscribers')
    .upsert(
      { email, status: 'subscribed', subscribed_at: new Date().toISOString(), unsubscribed_at: null, source: 'landing_page' },
      { onConflict: 'email' },
    )

  if (error) {
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
