'use client'

import { useState } from 'react'
import { Mail, CheckCircle2, Loader2 } from 'lucide-react'
import { PublicPageShell } from '@/components/shared/PublicPageShell'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

const TOPICS = [
  { value: 'general', label: 'General question' },
  { value: 'billing', label: 'Billing issue' },
  { value: 'bug', label: 'Bug report' },
  { value: 'refund', label: 'Refund request' },
  { value: 'account_deletion', label: 'Account deletion help' },
  { value: 'security', label: 'Security concern' },
  { value: 'other', label: 'Other' },
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', topic: 'general', message: '', company: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || form.message.length < 10) {
      setError('Please fill in your name, email, and a message of at least 10 characters.')
      return
    }
    setStatus('sending')
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setError(body?.error ?? 'Something went wrong. Please try again.')
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch {
      setError('Network error — please try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <PublicPageShell title="Message sent">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckCircle2 size={40} color="var(--text-green)" style={{ marginBottom: 16 }} />
          <p>Thanks for reaching out — we've received your message and sent a confirmation to your email.
          We'll get back to you as soon as possible.</p>
        </div>
      </PublicPageShell>
    )
  }

  return (
    <PublicPageShell title="Contact Support">
      <p style={{ marginBottom: 28 }}>
        Have a question, found a bug, or need help with billing, refunds, or deleting your account? Send us
        a message below. For quick product questions while signed in, you can also use the Support Chat
        assistant inside the app.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        {/* Honeypot — hidden from real users via CSS, bots often fill every field */}
        <input
          type="text" name="company" value={form.company} onChange={e => update({ company: e.target.value })}
          tabIndex={-1} autoComplete="off"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />

        <Field label="Your Name">
          <input className="input-field" value={form.name} onChange={e => update({ name: e.target.value })} required />
        </Field>

        <Field label="Your Email">
          <input className="input-field" type="email" value={form.email} onChange={e => update({ email: e.target.value })} required />
        </Field>

        <Field label="Topic">
          <select className="input-field" value={form.topic} onChange={e => update({ topic: e.target.value })}>
            {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <Field label="Message">
          <textarea
            className="input-field"
            value={form.message}
            onChange={e => update({ message: e.target.value })}
            rows={6}
            required
            style={{ resize: 'vertical', paddingTop: 10 }}
          />
        </Field>

        {error && <div style={{ fontSize: 13, color: 'var(--text-red)' }}>{error}</div>}

        <button
          type="submit"
          className="btn btn-green"
          disabled={status === 'sending'}
          style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {status === 'sending' ? <Loader2 size={15} className="spin" /> : <Mail size={15} />}
          {status === 'sending' ? 'Sending…' : 'Send Message'}
        </button>
      </form>

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </PublicPageShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  )
}
