'use client'

import { FinoraGlyph } from '@/components/brand/FinoraGlyph'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // The /api/auth/callback route already exchanged the recovery link's code
  // for a real session before redirecting here — we just need to confirm
  // that session actually exists (e.g. someone didn't just navigate to this
  // URL directly with no valid link).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled) {
        setHasSession(!!session)
        setCheckingSession(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError, data: updateData } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      if (updateData.user) {
        // Non-critical audit trail — never let a logging failure block the
        // password change the user is waiting on
        supabase.from('security_events').insert({
          user_id: updateData.user.id,
          event_type: 'password_reset_completed',
          severity: 'low',
        }).then(() => {}, () => {})
      }
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1800)
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
            {success ? 'Password updated' : 'Set a new password'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
            {success ? 'Taking you to your dashboard…' : 'Choose a new password for your account'}
          </p>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
          {checkingSession ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <Loader2 size={20} className="spin" color="var(--text-tertiary)" />
            </div>
          ) : success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check size={24} color="var(--text-green)" />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Your password has been changed successfully.
              </p>
            </div>
          ) : !hasSession ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, marginBottom: 20, textAlign: 'left' }}>
                <AlertCircle size={14} color="var(--text-red)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-red)' }}>
                  This link has expired or already been used. Request a new one to continue.
                </span>
              </div>
              <Link href="/reset-password" className="btn btn-green btn-md" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%' }}>
                Request a new link
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
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>New password</label>
                  <input
                    type="password" className="input-field" placeholder="At least 8 characters" required autoFocus
                    value={password} onChange={e => setPassword(e.target.value)} disabled={loading}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Confirm new password</label>
                  <input
                    type="password" className="input-field" placeholder="Re-enter your new password" required
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={loading}
                  />
                </div>
                <button type="submit" className="btn btn-green btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                  {loading ? 'Updating...' : <><span>Update Password</span><ArrowRight size={17} /></>}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
