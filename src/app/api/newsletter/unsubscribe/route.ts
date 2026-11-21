import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'

function page(title: string, message: string, ok: boolean) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="max-width:420px;padding:40px 32px;text-align:center;">
    <div style="color:${ok ? '#2FD968' : '#FF6B67'};font-size:22px;font-weight:800;margin-bottom:12px;">Finora</div>
    <h1 style="color:#fff;font-size:20px;margin:0 0 12px;">${title}</h1>
    <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0;">${message}</p>
  </div>
</body></html>`
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid')
  const token = req.nextUrl.searchParams.get('token')
  const kind = req.nextUrl.searchParams.get('kind') === 'subscriber' ? 'subscriber' : 'user'

  if (!uid || !token || !verifyUnsubscribeToken(uid, token)) {
    return new NextResponse(page('Link not valid', 'This unsubscribe link is invalid or has expired. If you\'d still like to stop receiving emails, please contact support.', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const db = createAdminClient()
  const { error } = kind === 'subscriber'
    ? await db.from('newsletter_subscribers').update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() }).eq('id', uid)
    : await db.from('notification_preferences').update({ marketing_emails: false, updated_at: new Date().toISOString() }).eq('user_id', uid)

  if (error) {
    return new NextResponse(page('Something went wrong', 'We couldn\'t process your request right now. Please try again shortly.', false), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new NextResponse(page('You\'re unsubscribed', 'You won\'t receive marketing emails from Finora anymore. You may still receive essential account and security emails.', true), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}
