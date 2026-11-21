'use client'

import { FinoraGlyph } from '@/components/brand/FinoraGlyph'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, ArrowRight, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function getAppUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

/** Convert any Supabase AuthError to a human-readable string */
function parseAuthError(err: unknown): string {
  if (!err) return 'Unknown error — please try again.'

  // Supabase AuthError shape: { message, status, code }
  const e = err as Record<string, unknown>
  const msg = (e.message ?? e.msg ?? e.error_description ?? '') as string
  const status = Number(e.status ?? 0)
  const code = String(e.code ?? e.error_code ?? '')

  if (!msg && !status) return JSON.stringify(err)   // last resort — show raw

  // Friendly rewrites for common errors
  if (msg.includes('Database error') || code === 'unexpected_failure')
    return '⚙️ Database error during signup — the "handle_new_user" trigger failed. Run fix_trigger.sql in Supabase SQL Editor, then try again.'

  if (msg.includes('rate limit') || status === 429 || code === 'over_email_send_rate_limit')
    return '📧 Supabase email rate limit reached (2/hour on free plan). Disable email confirmation in Supabase → Authentication → Settings, then try again.'

  if (msg.includes('Email not confirmed'))
    return 'Please confirm your email — check your inbox for the confirmation link.'

  if (msg.includes('already registered') || msg.includes('User already registered'))
    return 'This email is already registered. Try signing in instead.'

  if (msg.includes('Password should be') || msg.includes('password'))
    return 'Password must be at least 8 characters.'

  if (msg.includes('invalid') && msg.includes('email'))
    return 'Please enter a valid email address.'

  if (msg.includes('redirect_uri') || msg.includes('redirect_url') || code === 'validation_failed')
    return `Redirect URL not whitelisted. Go to:\nSupabase → Authentication → URL Configuration\n• Site URL: ${getAppUrl()}\n• Redirect URLs: ${getAppUrl()}/**`

  // Return the raw message if we can — better than nothing
  return msg || `Auth error (status ${status})`
}

export default function SignUpForm() {
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)
  const router                    = useRouter()
  const searchParams              = useSearchParams()
  // decode the redirect param once (it may already be URL-encoded)
  const rawRedirect = searchParams.get('redirect') ?? '/dashboard'
  const redirect    = rawRedirect.startsWith('%') ? decodeURIComponent(rawRedirect) : rawRedirect

  const pwChecks = {
    length: password.length >= 8,
    upper:  /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  }
  const pwStrength = Object.values(pwChecks).filter(Boolean).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)

    try {
      const supabase = createClient()
      const appUrl   = getAppUrl()

      // Build the callback URL — redirect is already decoded, no double-encode
      const callbackUrl = `${appUrl}/api/auth/callback?next=${encodeURIComponent(redirect)}`

      const { data, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, display_name: fullName },
          emailRedirectTo: callbackUrl,
        },
      })

      if (authErr) {
        setError(parseAuthError(authErr))
        return
      }

      // Email confirmation disabled → session created immediately
      if (data?.session) {
        router.push(redirect)
        router.refresh()
        return
      }

      // Email confirmation enabled → tell user to check email
      setSuccess(true)
    } catch (e: unknown) {
      // Network-level error (no internet, CORS, etc.)
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Network error: ${msg}`)
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

  /* ── Success screen ── */
  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check size={32} color="var(--text-green)" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>Check your email</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            We sent a confirmation link to{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
          </p>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.7 }}>
              💡 <strong style={{ color: 'var(--text-secondary)' }}>Tip for local dev:</strong> Disable email confirmation at{' '}
              <strong>Supabase → Authentication → Settings → Enable email confirmations</strong>.
              Users will be signed in instantly without needing to click a link.
            </p>
          </div>
          <Link href="/signin" className="btn btn-green btn-md" style={{ display: 'inline-flex', justifyContent: 'center' }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  const strengthColor = pwStrength === 3 ? '#2FD968' : pwStrength === 2 ? '#FF9F0A' : '#FF453A'

  /* ── Main form ── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% -20%, rgba(48,209,88,0.12), transparent)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 40px rgba(48,209,88,0.3)' }}>
            <FinoraGlyph size={26} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 6px', color: 'var(--text-primary)' }}>Create your account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Start building wealth for free</p>
        </div>

        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 20, padding: 28 }}>
          {/* Error box */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 12, marginBottom: 16 }}>
              <AlertCircle size={15} color="var(--text-red)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: 'var(--text-red)', whiteSpace: 'pre-line', lineHeight: 1.6, wordBreak: 'break-word' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Full name */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Full Name</label>
              <input type="text" className="input-field" placeholder="Alex Chen" required autoFocus
                value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>

            {/* Email */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="email" className="input-field" placeholder="you@example.com" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} className="input-field"
                  placeholder="Min 8 characters" required autoComplete="new-password"
                  style={{ paddingRight: 44 }} minLength={8}
                  value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength */}
              {password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 3, background: 'var(--bg-quaternary)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${(pwStrength / 3) * 100}%`, background: strengthColor, borderRadius: 2, transition: 'all 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {(['length', 'upper', 'number'] as const).map((k, idx) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: pwChecks[k] ? '#2FD968' : 'var(--bg-quaternary)', border: `1px solid ${pwChecks[k] ? '#2FD968' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {pwChecks[k] && <Check size={7} color="#000" />}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {['8+ chars', 'Uppercase', 'Number'][idx]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <button type="submit" className="btn btn-green btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
              {loading
                ? <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                : <><span>Create Free Account</span><ArrowRight size={17} /></>}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--separator)' }} />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--separator)' }} />
            </div>

            {/* Google */}
            <button type="button" className="btn btn-secondary btn-md"
              style={{ width: '100%', justifyContent: 'center', gap: 10 }} onClick={handleGoogle}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <p style={{ fontSize: 11, color: 'var(--text-quaternary)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
            By signing up you agree to our{' '}
            <a href="/legal/terms" target="_blank" style={{ color: 'var(--text-tertiary)' }}>Terms</a>,{' '}
            <a href="/legal/privacy" target="_blank" style={{ color: 'var(--text-tertiary)' }}>Privacy Policy</a>, and{' '}
            <a href="/legal/disclaimer" target="_blank" style={{ color: 'var(--text-tertiary)' }}>Disclaimer</a>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', marginTop: 20 }}>
          Already have an account?{' '}
          <Link href="/signin" style={{ color: 'var(--green-400)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
        </p>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-quaternary)', marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/legal/refund-policy" style={{ color: 'var(--text-quaternary)', textDecoration: 'none' }}>Refund Policy</Link>
          <Link href="/contact" style={{ color: 'var(--text-quaternary)', textDecoration: 'none' }}>Contact</Link>
        </p>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  )
}
