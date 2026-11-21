// ============================================================
// FINORA — Email Service (Resend)
// ============================================================

import { Resend } from 'resend'
import { COMPANY_NAME, APP_NAME } from '@/config/constants'

// Created on first send, not at import time (a missing key must not break the build).
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not set. Email sending is disabled until you add it.')
    _resend = new Resend(apiKey)
  }
  return _resend
}

const FROM = `${process.env.EMAIL_FROM_NAME ?? 'Finora'} <${process.env.EMAIL_FROM ?? 'noreply@finora.app'}>`

// ── EMAIL TEMPLATES ───────────────────────────────────────────

type EmailTemplate =
  | 'subscription_welcome'
  | 'subscription_canceled'
  | 'order_receipt'
  | 'password_reset'
  | 'email_verification'
  | 'weekly_digest'
  | 'goal_achieved'
  | 'agent_report'
  | 'security_alert'
  | 'creator_payout'
  | 'research_published'
  | 'course_completed'
  | 'generic'

interface EmailOptions {
  to: string | string[]
  subject: string
  template: EmailTemplate
  data: Record<string, unknown>
  replyTo?: string
  bcc?: string[]
}

// ── HTML BUILDERS ─────────────────────────────────────────────

const baseHtml = (content: string, preheader = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Finora</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
            💰 Finora
          </h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your Wealth Creation Platform</p>
        </td></tr>
        <!-- BODY -->
        <tr><td style="background:#111118;padding:40px;border-left:1px solid #222;border-right:1px solid #222;">
          ${content}
        </td></tr>
        <!-- FOOTER -->
        <tr><td style="background:#0d0d14;border:1px solid #222;border-radius:0 0 16px 16px;padding:24px;text-align:center;">
          <p style="margin:0;color:#555;font-size:12px;">
            © ${new Date().getFullYear()} ${COMPANY_NAME} · ${APP_NAME} · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://finora.app'}/settings" style="color:#7c3aed;">Notification settings</a> · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://finora.app'}/legal/privacy" style="color:#7c3aed;">Privacy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const btn = (href: string, text: string) =>
  `<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;margin:24px 0;">${text}</a>`

const h2 = (text: string) =>
  `<h2 style="margin:0 0 16px;color:#fff;font-size:22px;font-weight:700;">${text}</h2>`

const p = (text: string) =>
  `<p style="margin:0 0 16px;color:#aaa;font-size:16px;line-height:1.6;">${text}</p>`

const highlight = (text: string) =>
  `<div style="background:#1a1a2e;border:1px solid #7c3aed33;border-radius:8px;padding:16px;margin:16px 0;color:#c4b5fd;font-size:16px;font-weight:600;">${text}</div>`

// ── TEMPLATE RENDERERS ────────────────────────────────────────

function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): { subject: string; html: string } {
  switch (template) {

    case 'subscription_welcome':
      return {
        subject: `Welcome to Finora ${String(data.plan).toUpperCase()}! 🚀`,
        html: baseHtml(`
          ${h2(`You're now a Finora ${String(data.plan).toUpperCase()} member!`)}
          ${p(`Hey ${data.name}, welcome to the wealth-building revolution.`)}
          ${p('Your subscription is active and all premium features are unlocked.')}
          ${highlight(`✅ Plan: ${String(data.plan).toUpperCase()}<br>✅ AI Wealth Coach: Unlimited<br>✅ Research Center: Full Access<br>✅ Marketplace: Full Access`)}
          ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`, 'Start Building Wealth →')}
          ${p('Your AI Wealth Coach is ready to create your personalized wealth roadmap.')}
        `, `Welcome to Finora ${data.plan}!`),
      }

    case 'subscription_canceled':
      return {
        subject: 'Your Finora subscription has ended',
        html: baseHtml(`
          ${h2('We hate to see you go')}
          ${p(`${data.name}, your subscription has ended and you've been moved to the Free plan.`)}
          ${p('You still have access to:')}
          ${highlight('✅ Basic Dashboard<br>✅ 5 Portfolio Assets<br>✅ 3 Goals<br>✅ AI Coach (3 queries/week)')}
          ${p('Upgrade anytime to restore full access:')}
          ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/billing`, 'Upgrade Now →')}
        `),
      }

    case 'order_receipt':
      return {
        subject: `Order Confirmed: #${data.order_id}`,
        html: baseHtml(`
          ${h2('Purchase Confirmed! 🎉')}
          ${p(`Thanks ${data.name}! Your order has been completed.`)}
          ${highlight(`Order #${data.order_id}<br>Total: $${data.total}`)}
          ${p('Your downloads are now available in your library.')}
          ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/library`, 'View My Library →')}
        `),
      }

    case 'goal_achieved':
      return {
        subject: `🎯 Goal Achieved: ${data.goal_title}`,
        html: baseHtml(`
          ${h2(`Congratulations! Goal Achieved! 🏆`)}
          ${p(`${data.name}, you've reached your goal:`)}
          ${highlight(`🎯 ${data.goal_title}<br>💰 $${data.amount} / $${data.target}`)}
          ${p('This is a massive milestone in your wealth journey. Set your next goal!')}
          ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/goals`, 'Set Next Goal →')}
        `),
      }

    case 'agent_report':
      return {
        subject: `📊 Executive Report: ${data.report_title}`,
        html: baseHtml(`
          ${h2(`Executive Report: ${data.report_title}`)}
          ${p(`From: ${data.agent_name} (${data.agent_title})`)}
          ${highlight(String(data.summary))}
          ${btn(`${process.env.NEXT_PUBLIC_ADMIN_URL ?? ''}/cc/agents`, 'View Full Report →')}
        `),
      }

    case 'security_alert':
      return {
        subject: `🔐 Security Alert: ${data.event_type}`,
        html: baseHtml(`
          ${h2('Security Alert')}
          ${p(`A security event was detected on your account:`)}
          ${highlight(`Event: ${data.event_type}<br>Time: ${data.time}<br>IP: ${data.ip}<br>Location: ${data.location}`)}
          ${p('If this was not you, please change your password immediately.')}
          ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/settings/security`, 'Secure My Account →')}
        `),
      }

    case 'creator_payout':
      return {
        subject: `💸 Payout Sent: $${data.amount}`,
        html: baseHtml(`
          ${h2('Payout Sent!')}
          ${p(`${data.name}, your creator payout has been processed.`)}
          ${highlight(`Amount: $${data.amount}<br>Period: ${data.period}<br>Products: ${data.order_count} sales`)}
          ${p('Funds typically arrive within 2-3 business days.')}
          ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/creator/dashboard`, 'View Dashboard →')}
        `),
      }

    case 'weekly_digest':
      return {
        subject: `📈 Your Finora Weekly Report`,
        html: baseHtml(`
          ${h2('Your Weekly Wealth Summary')}
          ${p(`Hey ${data.name}, here's your financial recap:`)}
          ${highlight(`
            💰 Net Worth: $${data.net_worth} (${Number(data.net_worth_change) > 0 ? '+' : ''}${data.net_worth_change}%)<br>
            📈 Portfolio: ${Number(data.portfolio_change) > 0 ? '▲' : '▼'} ${Math.abs(Number(data.portfolio_change))}%<br>
            💸 Spent vs Budget: ${data.budget_pct}% used<br>
            🎯 Goals on Track: ${data.goals_on_track}/${data.total_goals}
          `)}
          ${btn(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`, 'View Full Dashboard →')}
        `),
      }

    case 'course_completed':
      return {
        subject: `🎓 Course Completed: ${data.course_title}`,
        html: baseHtml(`
          ${h2('Course Completed! 🎓')}
          ${p(`Congratulations ${data.name}! You've completed:`)}
          ${highlight(String(data.course_title))}
          ${data.certificate_url ? `
            ${p('Your certificate is ready to download:')}
            ${btn(String(data.certificate_url), 'Download Certificate →')}
          ` : ''}
          ${p('Keep learning and building your wealth knowledge!')}
        `),
      }

    default:
      return {
        subject: data.subject as string ?? 'Finora Notification',
        html: baseHtml(`
          ${h2(String(data.title ?? 'Notification'))}
          ${p(String(data.body ?? ''))}
          ${data.action_url ? btn(String(data.action_url), String(data.action_label ?? 'View')) : ''}
        `),
      }
  }
}

// ── SEND EMAIL ────────────────────────────────────────────────

export async function sendEmail(options: EmailOptions) {
  try {
    const { html } = renderTemplate(options.template, options.data)

    const result = await getResend().emails.send({
      from: FROM,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html,
      replyTo: options.replyTo,
      bcc: options.bcc,
    })

    // See note in sendRawEmail below: the Resend SDK resolves normally
    // (doesn't throw) on API-level rejections and puts the error in
    // result.error instead — this was previously being reported as a
    // success regardless, meaning password-reset, security-alert, and
    // subscription emails could silently never arrive while the calling
    // code believed they'd sent fine.
    if (result.error) {
      console.error('[Email] Resend rejected the send:', result.error)
      return { success: false, error: result.error.message ?? JSON.stringify(result.error) }
    }
    if (!result.data?.id) {
      console.error('[Email] Resend returned no error but no message id either')
      return { success: false, error: 'Resend returned no error but also no message id.' }
    }

    return { success: true, id: result.data.id }
  } catch (error) {
    console.error('[Email] Failed to send:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// ── RAW HTML SEND (used by newsletters, which render their own HTML) ──

export async function sendRawEmail(params: { to: string; subject: string; html: string; fromOverride?: string }) {
  try {
    const result = await getResend().emails.send({
      from: params.fromOverride ?? FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    })
    // IMPORTANT: the Resend SDK does not throw on API-level rejections
    // (unverified sending domain, invalid API key, recipient blocked by
    // sandbox restrictions, etc.) — it resolves successfully with the
    // error inside `result.error`. Treating any non-thrown call as a
    // success meant every one of those rejections was silently counted
    // as "sent," which is exactly why campaigns showed as delivered in
    // the app while no email actually arrived.
    if (result.error) {
      return { success: false, error: result.error.message ?? JSON.stringify(result.error) }
    }
    if (!result.data?.id) {
      return { success: false, error: 'Resend returned no error but also no message id — treating as failed.' }
    }
    return { success: true, id: result.data.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown send error' }
  }
}

// Sends in small batches with a short delay between them — Resend's
// standard rate limit is 2 requests/second on most plans, so blasting
// thousands of sends concurrently gets throttled or rejected outright.
// A large list (say 20k+ recipients) will exceed a single serverless
// function's execution time limit; for now this is designed for lists
// up to a few thousand. Beyond that, this should move to a queued
// background job instead of a single request.
export async function sendRawEmailBatch(
  emails: { to: string; subject: string; html: string }[],
  onProgress?: (sent: number, total: number) => void,
): Promise<{ to: string; success: boolean; error?: string }[]> {
  const BATCH_SIZE = 10
  const DELAY_MS = 600
  const results: { to: string; success: boolean; error?: string }[] = []

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(batch.map(e => sendRawEmail(e)))
    batchResults.forEach((r, idx) => {
      results.push({
        to: batch[idx].to,
        success: r.status === 'fulfilled' && r.value.success,
        error: r.status === 'fulfilled' ? (r.value.success ? undefined : String(r.value.error)) : String(r.reason),
      })
    })
    onProgress?.(results.length, emails.length)
    if (i + BATCH_SIZE < emails.length) await new Promise(res => setTimeout(res, DELAY_MS))
  }

  return results
}

// ── BULK EMAIL ────────────────────────────────────────────────

export async function sendBulkEmail(emails: EmailOptions[]) {
  const results = await Promise.allSettled(emails.map(e => sendEmail(e)))
  return results.map((r, i) => ({
    to: emails[i].to,
    success: r.status === 'fulfilled' && r.value.success,
    error: r.status === 'rejected' ? r.reason : undefined,
  }))
}

// ── NOTIFICATION EMAIL ────────────────────────────────────────

export async function sendNotificationEmail(params: {
  to: string
  title: string
  body: string
  actionUrl?: string
  actionLabel?: string
}) {
  return sendEmail({
    to: params.to,
    subject: params.title,
    template: 'generic',
    data: {
      title: params.title,
      body: params.body,
      action_url: params.actionUrl,
      action_label: params.actionLabel,
    },
  })
}
