import Link from 'next/link'
import { ReactNode } from 'react'
import { copyrightLine } from '@/config/constants'

export function PublicPageShell({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', padding: '18px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
            Finora
          </Link>
          <Link href="/signin" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Back to app
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{title}</h1>
        {updated && <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 32 }}>Last updated: {updated}</p>}
        <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          {children}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

export function PublicFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '24px', marginTop: 40 }}>
      <div style={{
        maxWidth: 760, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '8px 20px',
        alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-tertiary)',
      }}>
        <span>{copyrightLine()}</span>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <Link href="/legal/privacy" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/legal/terms" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Terms</Link>
          <Link href="/legal/cookies" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Cookies</Link>
          <Link href="/legal/acceptable-use" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Acceptable Use</Link>
          <Link href="/legal/disclaimer" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Financial Disclaimer</Link>
          <Link href="/legal/refund-policy" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Refunds &amp; Cancellation</Link>
          <Link href="/contact" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>Contact</Link>
        </nav>
      </div>
    </footer>
  )
}
