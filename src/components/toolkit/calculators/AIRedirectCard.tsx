'use client'

import Link from 'next/link'
import { MessageCircle, ArrowRight } from 'lucide-react'

export function AIRedirectCard({ title, description, examplePrompts }: { title: string; description: string; examplePrompts: string[] }) {
  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 20px' }}>
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
          background: 'color-mix(in srgb, var(--text-green) 14%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageCircle size={24} color="var(--text-green)" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>{title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>{description}</p>

        <div style={{ textAlign: 'left', background: 'var(--bg-tertiary)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            Try asking
          </div>
          {examplePrompts.map(p => (
            <div key={p} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '6px 0', borderBottom: '1px solid var(--separator)' }}>
              "{p}"
            </div>
          ))}
        </div>

        <Link
          href="/ai-coach"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--green-400)', color: '#000', fontWeight: 600, fontSize: 14,
            padding: '11px 22px', borderRadius: 10, textDecoration: 'none',
          }}
        >
          Open AI Coach <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}
