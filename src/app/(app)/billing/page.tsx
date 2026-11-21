'use client'
import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Check, Zap, Crown, Sparkles, Gem, ExternalLink, AlertCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { openBillingPortal, createCheckoutSession } from '@/lib/api'

interface PlanRow {
  id: string
  name: string // 'free' | 'pro' | 'plus' | 'elite'
  display_name: string
  description: string | null
  price_monthly: number
  price_yearly: number
  stripe_price_monthly_id: string | null
  stripe_price_yearly_id: string | null
  features: string[]
  is_active: boolean
  sort_order: number
}

const PLAN_ICON: Record<string, React.ReactNode> = {
  free: <Sparkles size={18} />,
  pro: <Zap size={18} />,
  plus: <Crown size={18} />,
  elite: <Gem size={18} />,
}
const PLAN_COLOR: Record<string, string> = {
  free: '#8E8E93',
  pro: 'var(--text-blue)',
  plus: 'var(--text-gold, var(--text-yellow))',
  elite: 'var(--text-green)',
}

export default function BillingPage() {
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [sub, setSub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: s } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setSub(s)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    try {
      // Real source of truth — the subscription_plans table, editable by
      // admins in the founder app. This used to be a hardcoded array here
      // that had drifted out of sync with the database (missing the Elite
      // plan, wrong Stripe env var names) — now there's exactly one place
      // plan info lives.
      const res = await fetch('/api/subscriptions/plans')
      const json = await res.json()
      if (json.success) setPlans(json.data ?? [])
    } catch (e) { console.error(e) }
    finally { setPlansLoading(false) }
  }, [])

  useEffect(() => { load(); loadPlans() }, [load, loadPlans])

  const handleUpgrade = async (plan: PlanRow) => {
    const priceId = billingInterval === 'yearly' ? plan.stripe_price_yearly_id : plan.stripe_price_monthly_id
    if (!priceId) {
      setError(`This plan isn't fully set up for checkout yet — its Stripe price ID hasn't been configured. Contact support.`)
      return
    }
    setActionLoading(plan.name)
    setError(null)
    try {
      const { url } = await createCheckoutSession(priceId, billingInterval)
      window.location.href = url
    } catch (e: any) {
      setError(e.message ?? 'Failed to start checkout. Make sure the backend is running.')
    } finally { setActionLoading(null) }
  }

  const handlePortal = async () => {
    setActionLoading('portal')
    setError(null)
    try {
      const { url } = await openBillingPortal()
      window.open(url, '_blank')
    } catch (e: any) {
      setError(e.message ?? 'Failed to open billing portal. Make sure the backend is running.')
    } finally { setActionLoading(null) }
  }

  const currentPlan = sub?.status === 'active' ? (sub.plan ?? 'free') : 'free'

  return (
    <div className="page-container fade-in">
      <PageHeader title="Billing" description="Manage your Finora subscription" />

      {error && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 12, marginBottom: 20 }}>
          <AlertCircle size={15} color="var(--text-red)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: 'var(--text-red)', lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {!loading && (
        <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>Current Plan</div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'capitalize' }}>{currentPlan}</div>
            {sub?.current_period_end && (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                Renews {formatDate(sub.current_period_end, 'short')}
              </div>
            )}
          </div>
          {currentPlan !== 'free' && (
            <button className="btn btn-secondary btn-md" onClick={handlePortal} disabled={actionLoading === 'portal'}>
              <CreditCard size={14} /> {actionLoading === 'portal' ? 'Opening...' : 'Manage Subscription'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
          {(['monthly', 'yearly'] as const).map(i => (
            <button key={i} onClick={() => setBillingInterval(i)} style={{ padding: '8px 20px', borderRadius: 9, fontSize: 13, fontWeight: 500, background: billingInterval === i ? 'var(--bg-tertiary)' : 'transparent', color: billingInterval === i ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {i.charAt(0).toUpperCase() + i.slice(1)}
              {i === 'yearly' && (
                <span style={{ fontSize: 10, background: 'var(--green-400)', color: '#000', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                  Save more
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px', marginBottom: 16,
        background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 10,
      }}>
        <AlertCircle size={13} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Subscriptions are non-refundable except where required by law. Read our{' '}
          <a href="/legal/refund-policy" target="_blank" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
            Refund Policy
          </a>{' '}
          before subscribing. You can cancel anytime — it takes effect at the end of your current billing period.
        </span>
      </div>

      {plansLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>Loading plans…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${plans.length}, 1fr)`, gap: 16, marginBottom: 24 }}>
          {plans.map(plan => {
            const isCurrent = currentPlan === plan.name
            const color = PLAN_COLOR[plan.name] ?? 'var(--text-blue)'
            const rawPrice = billingInterval === 'yearly' ? plan.price_yearly : plan.price_monthly
            const displayPrice = billingInterval === 'yearly' ? Math.round(plan.price_yearly / 12) : plan.price_monthly
            const priceId = billingInterval === 'yearly' ? plan.stripe_price_yearly_id : plan.stripe_price_monthly_id
            const isPopular = plan.name === 'pro'

            return (
              <div key={plan.id} style={{ position: 'relative' }}>
                {isPopular && (
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap', zIndex: 1 }}>
                    Most Popular
                  </div>
                )}
                <div className="card" style={{ padding: 24, border: isCurrent ? `1.5px solid ${color}` : '1px solid var(--border)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 24%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                      {PLAN_ICON[plan.name] ?? <Sparkles size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{plan.display_name}</div>
                      {isCurrent && <div style={{ fontSize: 11, color, fontWeight: 600 }}>Current plan</div>}
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>${displayPrice}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>/month</span>
                    {billingInterval === 'yearly' && rawPrice > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>billed ${rawPrice}/year</div>
                    )}
                  </div>

                  {plan.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>{plan.description}</div>
                  )}

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {plan.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <Check size={13} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className={isCurrent ? 'btn btn-secondary btn-md' : 'btn btn-md'}
                    style={{
                      width: '100%', justifyContent: 'center',
                      ...(isCurrent ? {} : { background: `color-mix(in srgb, ${color} 12%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 24%, transparent)` }),
                    }}
                    onClick={() => !isCurrent && plan.price_monthly > 0 ? handleUpgrade(plan) : undefined}
                    disabled={isCurrent || actionLoading === plan.name}
                  >
                    {actionLoading === plan.name
                      ? 'Loading...'
                      : isCurrent
                        ? 'Current Plan'
                        : plan.price_monthly === 0
                          ? 'Downgrade'
                          : 'Upgrade'}
                  </button>

                  {!isCurrent && plan.price_monthly > 0 && !priceId && (
                    <div style={{ fontSize: 10, color: 'var(--text-quaternary)', textAlign: 'center', marginTop: 6 }}>
                      Checkout not yet configured for this plan
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {currentPlan !== 'free' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Billing Management</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            View invoices, update payment method, or cancel your subscription.
          </div>
          <button className="btn btn-secondary btn-md" onClick={handlePortal} disabled={actionLoading === 'portal'}>
            <ExternalLink size={14} /> {actionLoading === 'portal' ? 'Opening...' : 'Open Billing Portal'}
          </button>
        </div>
      )}
    </div>
  )
}
