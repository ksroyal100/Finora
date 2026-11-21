import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

// slug -> expected customer-facing title after migration 017
const REQUIRED: Record<string, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
  disclaimer: 'Financial Disclaimer',
  'refund-policy': 'Refund and Cancellation Policy',
  'acceptable-use': 'Acceptable Use Policy',
}

describe('legal document set', () => {
  const migrations = fs.readdirSync(path.join(ROOT, 'supabase/migrations'))
    .filter(f => f.endsWith('.sql')).sort().map(f => read('supabase/migrations/' + f)).join('\n')

  for (const [slug, title] of Object.entries(REQUIRED)) {
    it(`${slug}: has a public route`, () => {
      expect(fs.existsSync(path.join(ROOT, 'src/app/legal', slug, 'page.tsx'))).toBe(true)
      expect(read(`src/app/legal/${slug}/page.tsx`)).toContain(`getLegalDocument('${slug}')`)
    })
    it(`${slug}: is seeded or titled "${title}" by migrations`, () => {
      expect(migrations).toContain(`'${slug}'`)
      expect(migrations).toContain(title)
    })
  }

  it('migration 017 is additive, idempotent and documents rollback', () => {
    const m = read('supabase/migrations/017_complete_legal_documents.sql')
    expect(m).toMatch(/ON CONFLICT \(slug\) DO NOTHING/)
    expect(m).toMatch(/ROLLBACK/)
    expect(m).not.toMatch(/^\s*(DROP|TRUNCATE|ALTER TABLE)/im)
  })

  it('new documents disclose WEALTHOS as owner/operator and invent no company details', () => {
    // inspect document content only, not the explanatory SQL comments
    const m = read('supabase/migrations/017_complete_legal_documents.sql').split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    expect(m).toMatch(/owned and operated by WEALTHOS/)
    expect(m).not.toMatch(/registration (no|number)|company number|incorporated in|licen[cs]e number/i)
  })

  it('cookie policy matches reality: no client analytics mounted', () => {
    // If PostHog is ever mounted client-side, the Cookie Policy must be updated first.
    const mounted = fs.readdirSync(path.join(ROOT, 'src/app'), { recursive: true } as any)
      .map(String).filter(f => /layout\.tsx$/.test(f))
      .some(f => read('src/app/' + f).includes('PostHogProvider'))
    expect(mounted).toBe(false)
  })

  it('public footer links to all customer-facing legal pages', () => {
    const shell = read('src/components/shared/PublicPageShell.tsx')
    for (const slug of Object.keys(REQUIRED)) expect(shell).toContain(`/legal/${slug}`)
  })
})
