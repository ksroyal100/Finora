'use client'

import { FinoraGlyph } from '@/components/brand/FinoraGlyph'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function getAppUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export default function SignInForm() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const router                = useRouter()
  const searchParams          = useSearchParams()
  const redirect              = searchParams.get('redirect') ?? '/dashboard'

  useEffect(() => {
    const urlErr = searchParams.get('error')
    if (urlErr) setError(decodeURIComponent(urlErr))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) {
        if (authErr.message.includes('Email not confirmed')) {
          setError('Please confirm your email first. Check your inbox for a confirmation link.')
        } else if (authErr.message.includes('Invalid login')) {
          setError('Invalid email or password. Please try again.')
        } else {
          setError(authErr.message)
        }
        return
      }
      router.push(redirect)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const supabase = createClient()
    const appUrl   = getAppUrl()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(redirect)}` },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% -20%, rgba(48,209,88,0.12), transparent)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 40px rgba(48,209,88,0.3)' }}>
            <FinoraGlyph size={26} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px', color: 'var(--text-primary)' }}>Welcome back</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Sign in to your Finora account</p>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 12, marginBottom: 16 }}>
              <AlertCircle size={15} color="var(--text-red)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'var(--text-red)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" className="input-field" placeholder="you@example.com" required autoComplete="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                <Link href="/reset-password" style={{ fontSize: 12, color: 'var(--green-400)', textDecoration: 'none' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="input-field" placeholder="••••••••" required autoComplete="current-password" style={{ paddingRight: 44 }} value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-green btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
              {loading
                ? <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}</div>
                : <><span>Sign In</span><ArrowRight size={17} /></>}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--separator)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--separator)' }} />
            </div>

            <button type="button" className="btn btn-secondary btn-md" style={{ width: '100%', justifyContent: 'center', gap: 10 }} onClick={handleGoogle}>
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Continue with Google
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', marginTop: 20 }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: 'var(--green-400)', textDecoration: 'none', fontWeight: 500 }}>Sign up free</Link>
        </p>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-quaternary)', marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/legal/privacy" style={{ color: 'var(--text-quaternary)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/legal/terms" style={{ color: 'var(--text-quaternary)', textDecoration: 'none' }}>Terms</Link>
          <Link href="/contact" style={{ color: 'var(--text-quaternary)', textDecoration: 'none' }}>Contact</Link>
        </p>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  )
}
