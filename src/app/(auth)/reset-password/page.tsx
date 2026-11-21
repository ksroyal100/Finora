'use client'

import { FinoraGlyph } from '@/components/brand/FinoraGlyph'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password&purpose=password_reset`,
      })
      if (resetError) { setError(resetError.message); return }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% -20%, rgba(48,209,88,0.12), transparent)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 40px rgba(48,209,88,0.3)' }}>
            <FinoraGlyph size={26} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px', color: 'var(--text-primary)' }}>
            {success ? 'Check your email' : 'Reset your password'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
            {success ? `We sent a reset link to ${email}` : "We'll email you a reset link"}
          </p>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check size={24} color="var(--text-green)" />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                Click the link in your email to reset your password. Check your spam folder if you don't see it.
              </p>
              <Link href="/signin" className="btn btn-green btn-md" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
                <ArrowLeft size={15} /> Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, marginBottom: 16 }}>
                  <AlertCircle size={14} color="var(--text-red)" />
                  <span style={{ fontSize: 13, color: 'var(--text-red)' }}>{error}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email address</label>
                  <input type="email" className="input-field" placeholder="you@example.com" required autoFocus value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-green btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Sending...' : <><span>Send Reset Link</span><ArrowRight size={17} /></>}
                </button>
              </form>
            </>
          )}
        </div>

        {!success && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', marginTop: 20 }}>
            <Link href="/signin" style={{ color: 'var(--green-400)', textDecoration: 'none', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={12} /> Back to Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
