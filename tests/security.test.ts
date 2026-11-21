import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = path.resolve(__dirname, '../src')
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = walk(SRC)

describe('secret handling', () => {
  it('no client component reads a server-only secret from process.env', () => {
    const SECRETS = /process\.env\.(SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|GROQ_API_KEY|RESEND_API_KEY|CRON_SECRET|UNSUBSCRIBE_SECRET|QDRANT_API_KEY)/
    const offenders = files.filter(f => {
      const t = fs.readFileSync(f, 'utf8')
      return /^\s*['"]use client['"]/m.test(t) && SECRETS.test(t)
    })
    expect(offenders).toEqual([])
  })

  it('no live-looking API keys are hard-coded', () => {
    const KEY = /(sk_live_|sk_test_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}|re_[A-Za-z0-9]{24,}|gsk_[A-Za-z0-9]{20,})/
    const offenders = files.filter(f => KEY.test(fs.readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('Stripe webhook verifies the signature before acting', () => {
    const t = fs.readFileSync(path.join(SRC, 'app/api/webhooks/stripe/route.ts'), 'utf8')
    expect(t).toContain('constructStripeWebhookEvent')
    expect(t.indexOf('constructStripeWebhookEvent')).toBeLessThan(t.indexOf('createAdminClient()'))
  })

  it('admin-only links point at the separate admin app, not the main app', () => {
    for (const f of ['lib/email/resend.ts', 'services/notification.service.ts']) {
      const t = fs.readFileSync(path.join(SRC, f), 'utf8')
      expect(t).not.toMatch(/NEXT_PUBLIC_APP_URL\}?\/admin\/cc/)
      expect(t).not.toMatch(/['`]\/admin\/cc/)
    }
  })

  it('cron endpoint fails closed when CRON_SECRET is not configured', () => {
    const t = fs.readFileSync(path.join(SRC, 'app/api/admin/cc/revenue/cron/route.ts'), 'utf8')
    expect(t).toMatch(/!process\.env\.CRON_SECRET/)
  })
})
