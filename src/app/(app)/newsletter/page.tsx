'use client'

import { useEffect, useState, useCallback } from 'react'
import { Mail, Check, Loader2, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createClient } from '@/lib/supabase/client'

interface SentNewsletter {
  id: string
  subject: string
  preheader: string
  content: { headline: string; intro: string }
  sent_at: string
}

export default function NewsletterPage() {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [archive, setArchive] = useState<SentNewsletter[]>([])
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prefs, error: prefsError } = await supabase
        .from('notification_preferences')
        .select('marketing_emails')
        .eq('user_id', user.id)
        .single()
      if (prefsError) throw prefsError
      setSubscribed(!!prefs?.marketing_emails)

      // Public archive of past sends — read directly, RLS on `newsletters`
      // is admin-only, so this goes through a small public read instead.
      const res = await fetch('/api/newsletter/archive')
      if (res.ok) {
        const json = await res.json()
        setArchive(json.data?.newsletters ?? [])
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load your newsletter preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async () => {
    setSaving(true); setError(null)
    const next = !subscribed
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: updateError } = await supabase
        .from('notification_preferences')
        .update({ marketing_emails: next, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
      if (updateError) throw updateError
      setSubscribed(next)
    } catch (e: any) {
      setError(e.message ?? 'Failed to update your preference')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-container fade-in">
      <PageHeader
        eyebrow="Stay in the loop"
        title="Newsletter"
        description="Weekly-ish notes on markets, new Finora features, and wealth-building ideas."
      />

      {error && (
        <div style={{ background: 'color-mix(in srgb, var(--text-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--text-red) 25%, transparent)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-red)' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 22, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'color-mix(in srgb, var(--text-green) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Mail size={20} color="var(--text-green)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {loading ? 'Checking your subscription…' : subscribed ? "You're subscribed" : "You're not subscribed"}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {subscribed ? 'You\'ll get our newsletter by email. Unsubscribe anytime from any email or here.' : 'Turn this on to get our newsletter by email.'}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading || saving}
          className={subscribed ? 'btn btn-secondary btn-md' : 'btn btn-green btn-md'}
          style={{ flexShrink: 0, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : subscribed ? <Check size={14} /> : null}
          {saving ? 'Saving…' : subscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Past Issues</h2>
      <div className="card">
        {!loading && archive.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No newsletters sent yet — check back soon.
          </div>
        )}
        {archive.map((n, i) => (
          <div key={n.id} style={{ borderBottom: i < archive.length - 1 ? '1px solid var(--separator)' : 'none' }}>
            <button
              onClick={() => setOpenId(openId === n.id ? null : n.id)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{n.subject}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                  {new Date(n.sent_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-tertiary)" style={{ transform: openId === n.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
            {openId === n.id && (
              <div style={{ padding: '0 18px 18px' }}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{n.content?.headline}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{n.content?.intro}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
