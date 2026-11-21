'use client'

import { FinoraGlyph } from '@/components/brand/FinoraGlyph'
import { copyrightLine } from '@/config/constants'
import Link from 'next/link'
import { useState } from 'react'
import {
  Sparkles, TrendingUp, Bot, ShoppingBag, Users, GraduationCap,
  Search, ArrowRight, Check, Zap, Shield, Star,
  ChevronDown, Mail, Lock, BarChart3, Target, DollarSign,
  Calculator, Globe, Award, BookOpen, Bell, CreditCard,
} from 'lucide-react'

// ── DATA ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: TrendingUp, title: 'Portfolio Tracking', tag: 'Core', color: '#2FD968',
    desc: 'Track stocks, ETFs, crypto, and real estate in one unified dashboard. Real-time performance, allocation analysis, and rebalancing alerts.' },
  { icon: Bot, title: 'AI Wealth Coach', tag: 'AI', color: '#0A84FF',
    desc: 'Your personal AI financial advisor powered by Llama 3.3 70B. Personalized wealth roadmaps, budget analysis, and investment guidance — 24/7.' },
  { icon: Search, title: 'Research Center', tag: 'Pro+', color: '#BF5AF2',
    desc: 'Deep market intelligence. Analyst reports, sector analysis, startup ecosystem insights, and macro trend monitoring at your fingertips.' },
  { icon: GraduationCap, title: 'Learning Hub', tag: 'Free', color: '#FF9F0A',
    desc: 'Expert-led courses on investing, real estate, business, and AI. Structured learning paths with certificates to validate your financial literacy.' },
  { icon: ShoppingBag, title: 'Marketplace', tag: 'Plus+', color: '#64D2FF',
    desc: 'Buy and sell financial tools, templates, courses, and research reports. Build a creator income stream from your wealth-building expertise.' },
  { icon: Users, title: 'Community', tag: 'Free', color: '#FF453A',
    desc: '50,000+ wealth builders sharing insights, milestones, and opportunities. Your tribe of ambitious investors building financial freedom together.' },
]

const AGENTS = [
  { name: 'JARVIS', role: 'CEO · Orchestrator', color: '#2FD968', desc: 'Strategic oversight and cross-agent workflow coordination.' },
  { name: 'ATHENA', role: 'CFO · Revenue', color: '#0A84FF', desc: 'Financial modeling, MRR analysis, and revenue forecasting.' },
  { name: 'ORION', role: 'CPO · Product', color: '#BF5AF2', desc: 'Roadmap prioritization and user experience optimization.' },
  { name: 'TITAN', role: 'CTO · Infrastructure', color: '#FF9F0A', desc: 'System health, scaling decisions, and tech architecture.' },
  { name: 'PHOENIX', role: 'CGO · Growth', color: '#64D2FF', desc: 'User acquisition, retention strategies, and viral loops.' },
  { name: 'MERLIN', role: 'CRO · Research', color: '#FF453A', desc: 'Market intelligence, competitive analysis, and trend reports.' },
  { name: 'SENTINEL', role: 'CSO · Security', color: '#FFD60A', desc: 'Threat detection, compliance monitoring, and access control.' },
]

const TESTIMONIALS = [
  { name: 'Priya Sharma', handle: '@priyainvests', plan: 'Pro', avatar: 'PS', color: '#2FD968',
    text: 'Finora completely changed how I track my investments. I went from 6 spreadsheets to one dashboard. My net worth is up 34% since I started using it seriously.',
    result: '+$41,200 net worth growth' },
  { name: 'Marcus Johnson', handle: '@mj_portfolio', plan: 'Elite', avatar: 'MJ', color: '#0A84FF',
    text: "The AI Coach is genuinely like having a CFO in my pocket. It spotted I was overpaying in fund fees by $3,400/year — paid for itself in the first week.",
    result: 'Saved $3,400/yr in fees' },
  { name: 'Sarah Chen', handle: '@sarahbuilds', plan: 'Plus', avatar: 'SC', color: '#BF5AF2',
    text: "I've built a $2,300/month side income selling investment templates on the Marketplace. The creator tools are incredible and the community buys quality content.",
    result: '$2,300/mo creator income' },
  { name: 'James Okafor', handle: '@james_okaf', plan: 'Pro', avatar: 'JO', color: '#FF9F0A',
    text: "Went from knowing nothing about investing to confidently managing a $120K portfolio. The learning hub is structured perfectly — got my first certificate in 3 weeks.",
    result: '$120K portfolio, self-managed' },
  { name: 'Elena Vasquez', handle: '@elena_wealth', plan: 'Pro', avatar: 'EV', color: '#64D2FF',
    text: "The community keeps me accountable. I share my monthly goals publicly and the support is incredible. Hit my $50K emergency fund goal last month!",
    result: '$50K emergency fund ✓' },
  { name: 'David Kim', handle: '@dkim_finance', plan: 'Elite', avatar: 'DK', color: '#FF453A',
    text: "Research Center alone is worth the subscription. The analyst reports and watchlists save me 8 hours a week compared to building my own research pipeline.",
    result: 'Saves 8 hrs/week on research' },
]

const PLANS = [
  { name: 'Free', price: 0, icon: Sparkles, color: '#94A3B8',
    features: ['Dashboard & net worth tracking', 'AI Coach (3 queries/week)', '5 portfolio assets', '3 wealth goals', 'Community access', 'Learning hub (basic)'] },
  { name: 'Pro', price: 19, icon: Zap, color: '#2FD968', popular: true,
    features: ['Everything in Free', 'Unlimited portfolio assets', 'Unlimited goals', 'AI Coach unlimited', 'Research Center', 'Full Marketplace access', 'Advanced analytics'] },
  { name: 'Plus', price: 39, icon: Shield, color: '#0A84FF',
    features: ['Everything in Pro', 'Creator Store & revenue sharing', 'API Access', 'Priority support', 'Advanced research tools', 'Early access to new features'] },
]

const STATS = [
  { value: '77', label: 'Financial calculators', icon: DollarSign },
  { value: '24/7', label: 'AI Coach availability', icon: Users },
  { value: '6', label: 'Core modules', icon: Star },
  { value: '100%', label: 'Your data, never sold', icon: TrendingUp },
]

const STEPS = [
  { num: '01', title: 'Create your free account', color: '#2FD968',
    desc: 'Sign up in 60 seconds. No credit card required. Connect your accounts or add assets manually — your data, your control.' },
  { num: '02', title: 'Map your wealth picture', color: '#0A84FF',
    desc: 'Input your portfolio, goals, and budget. Finora calculates your net worth in real-time and gives you a financial health score.' },
  { num: '03', title: 'Grow with AI guidance', color: '#BF5AF2',
    desc: 'Your AI Wealth Coach analyzes your situation and gives personalized advice. Track progress, learn, and connect with the community.' },
]

interface CompareRow {
  feature: string
  finora: boolean | string
  sheets: boolean | string
  apps: boolean | string
}

const COMPARE: CompareRow[] = [
  { feature: 'Portfolio tracking',    finora: true,      sheets: 'Manual',  apps: true },
  { feature: 'AI financial coach',    finora: true,      sheets: false,     apps: false },
  { feature: 'Net worth calculator',  finora: true,      sheets: 'Manual',  apps: 'Partial' },
  { feature: 'Goal tracking',         finora: true,      sheets: 'Manual',  apps: 'Partial' },
  { feature: 'Research & analysis',   finora: true,      sheets: false,     apps: false },
  { feature: 'Learning hub',          finora: true,      sheets: false,     apps: false },
  { feature: 'Community',             finora: true,      sheets: false,     apps: false },
  { feature: 'Marketplace',           finora: true,      sheets: false,     apps: false },
  { feature: 'Budget management',     finora: true,      sheets: 'Manual',  apps: true },
]

const FAQS = [
  { q: 'Is my financial data safe on Finora?',
    a: 'Absolutely. Finora uses bank-grade security: row-level encryption, Supabase JWT auth, and we never store raw banking credentials. All data is encrypted at rest and in transit. Your financial data is never sold or shared with third parties.' },
  { q: 'Do I need to connect my bank accounts?',
    a: 'No. You can manually add all your assets, portfolio holdings, and transactions. Bank integrations are optional and opt-in. You stay in full control of what data you share.' },
  { q: 'How does the AI Wealth Coach work?',
    a: 'Your AI Coach is powered by Llama 3.3 70B — a state-of-the-art language model. It analyzes your financial profile (portfolio, goals, budget, net worth) and gives personalized, contextual advice. Free plan includes 3 queries per week; Pro and above get unlimited access.' },
  { q: 'Can I cancel my subscription anytime?',
    a: 'Yes. No long-term contracts, no cancellation fees. Cancel anytime and your account reverts to the free plan. All your data is preserved.' },
  { q: 'What makes Finora different from other finance apps?',
    a: 'Most apps do one thing — budgeting, or portfolio tracking, or learning. Finora is the first unified platform for wealth: tracking + AI coaching + research + learning + community + marketplace in one place with an Apple-grade interface.' },
  { q: 'Is the Marketplace real? Can I actually earn money?',
    a: 'Yes! The Marketplace is live. Plus and Elite members can list financial templates, courses, tools, and research reports. Several creators are earning $1,000–$5,000/month. Revenue sharing is built into the platform.' },
]

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [newsletterDone, setNewsletterDone] = useState(false)
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterError, setNewsletterError] = useState<string | null>(null)

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setNewsletterLoading(true)
    setNewsletterError(null)
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Something went wrong')
      setNewsletterDone(true)
    } catch (err: any) {
      setNewsletterError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setNewsletterLoading(false)
    }
  }

  const cellIcon = (val: boolean | string) => {
    if (val === true) return <span style={{ color: '#2FD968', fontSize: 17 }}>✓</span>
    if (val === false) return <span style={{ color: 'var(--text-tertiary)', opacity: 0.35, fontSize: 17 }}>✕</span>
    return <span style={{ fontSize: 11, color: '#FF9F0A', fontWeight: 600 }}>{val}</span>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-system)', overflowX: 'hidden' }}>

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: '1px solid var(--separator)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FinoraGlyph size={16} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em' }}>Finora</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {[['Features', '#features'], ['How it works', '#how-it-works'], ['Pricing', '#pricing'], ['AI Agents', '#agents'], ['Community', '#testimonials']].map(([label, href]) => (
            <a key={label} href={href} style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', letterSpacing: '-0.01em', transition: 'color 0.15s ease' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>{label}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/signin" className="btn btn-ghost btn-md" style={{ fontSize: 14 }}>Sign in</Link>
          <Link href="/signup" className="btn btn-green btn-md" style={{ fontSize: 14 }}>Get started free</Link>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 160, paddingBottom: 40, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(48,209,88,0.16), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 45% at 5% 110%, rgba(10,132,255,0.08), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 45% at 95% 100%, rgba(191,90,242,0.06), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', maxWidth: 820, margin: '0 auto', padding: '0 32px' }}>
          {/* Live badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.22)', borderRadius: 999, padding: '6px 16px', marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green-400)', display: 'inline-block', boxShadow: '0 0 6px rgba(48,209,88,0.8)' }} />
            <span style={{ fontSize: 13, color: 'var(--green-400)', fontWeight: 500, letterSpacing: '-0.01em' }}>Your complete financial platform</span>
          </div>

          <h1 style={{ fontSize: 76, fontWeight: 800, letterSpacing: '-0.048em', lineHeight: 1.02, margin: '0 0 24px', color: 'var(--text-primary)' }}>
            The Smarter Way
            <br />
            <span style={{ background: 'linear-gradient(96deg, #2FD968 20%, #5EE87C 60%, #2FD968 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% auto' }}>
              for Building Wealth
            </span>
          </h1>

          <p style={{ fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 auto 40px', maxWidth: 580, letterSpacing: '-0.015em' }}>
            Portfolio tracking, AI coaching, research, marketplace, and community — everything you need to build lasting wealth, in one beautifully designed platform.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            <Link href="/signup" className="btn btn-green" style={{ fontSize: 17, height: 58, padding: '0 38px', borderRadius: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Start for free <ArrowRight size={18} />
            </Link>
            <Link href="/signin" className="btn btn-secondary" style={{ fontSize: 17, height: 58, padding: '0 38px', borderRadius: 16 }}>
              Sign in to dashboard
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 52 }}>No credit card required · Free plan forever · Setup in 60 seconds</p>

          {/* Social proof row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ display: 'flex' }}>
              {(['MJ', 'SC', 'JO', 'EV', 'DK'] as const).map((initials, i) => {
                const colors = ['#2FD968', '#0A84FF', '#FF9F0A', '#BF5AF2', '#FF453A']
                return (
                  <div key={initials} style={{ width: 38, height: 38, borderRadius: '50%', background: colors[i] + '28', border: '2.5px solid var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: i > 0 ? -12 : 0, fontSize: 11, fontWeight: 800, color: colors[i], zIndex: 5 - i }}>
                    {initials}
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 3 }}>
                {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} color="#FFD60A" fill="#FFD60A" />)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>4.9/5 from 2,400+ reviews</div>
            </div>
          </div>
        </div>

        {/* Dashboard preview */}
        <div style={{ maxWidth: 1100, margin: '72px auto 0', padding: '0 32px' }}>
          <div style={{ position: 'relative', background: 'var(--bg-secondary)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 48px 140px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)' }}>
            {/* Browser chrome */}
            <div style={{ background: 'var(--bg-tertiary)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--separator)' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#FF453A', '#FF9F0A', '#2FD968'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c + '60' }} />)}
              </div>
              <div style={{ flex: 1, background: 'var(--bg-quaternary)', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', padding: '0 10px', maxWidth: 340, margin: '0 auto' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>finora.app/dashboard</span>
              </div>
            </div>
            {/* App layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 380 }}>
              {/* Sidebar */}
              <div style={{ background: 'rgba(10,10,12,0.9)', borderRight: '1px solid var(--separator)', padding: '18px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FinoraGlyph size={12} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Finora</span>
                </div>
                {[{ icon: BarChart3, label: 'Dashboard', active: true }, { icon: TrendingUp, label: 'Portfolio' }, { icon: Target, label: 'Goals' }, { icon: DollarSign, label: 'Net Worth' }, { icon: Calculator, label: 'Budgeting' }, { icon: Bot, label: 'AI Coach', badge: 'AI' }, { icon: GraduationCap, label: 'Learning' }, { icon: Users, label: 'Community' }].map(item => (
                  <div key={item.label} className={item.active ? 'nav-item active' : 'nav-item'} style={{ marginBottom: 1, fontSize: 13, padding: '7px 10px' }}>
                    <item.icon size={13} />
                    <span>{item.label}</span>
                    {item.badge && <span style={{ marginLeft: 'auto', fontSize: 9, background: 'rgba(48,209,88,0.15)', color: '#2FD968', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>{item.badge}</span>}
                  </div>
                ))}
              </div>
              {/* Main */}
              <div style={{ padding: '22px 24px', background: 'var(--bg-base)' }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 3 }}>Good morning, Alex 👋</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em' }}>Wealth Dashboard</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[{ label: 'Net Worth', value: '$287,450', change: '+12.4%' }, { label: 'Portfolio', value: '$184,200', change: '+3.2%' }, { label: 'Monthly Savings', value: '$4,660', change: '+37%' }, { label: 'Health Score', value: '78/100', change: 'Good ↑' }].map(m => (
                    <div key={m.label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5 }}>{m.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 3 }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: '#2FD968', fontWeight: 600 }}>{m.change}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 12 }}>Net Worth History</div>
                    <div style={{ height: 56, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                      {[42, 50, 44, 68, 62, 76, 72, 88, 84, 100].map((h, i) => (
                        <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 9 ? '#2FD968' : 'rgba(48,209,88,0.22)', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10 }}>Active Goals</div>
                    {[{ label: 'Emergency Fund', pct: 83, color: '#2FD968' }, { label: 'Down Payment', pct: 54, color: '#0A84FF' }].map(g => (
                      <div key={g.label} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: g.color }}>{g.pct}%</span>
                        </div>
                        <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${g.pct}%`, background: g.color }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Fade-out bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(transparent, var(--bg-base))', pointerEvents: 'none' }} />
          </div>
        </div>
      </section>


      {/* ── STATS ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--separator)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--separator)' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ background: 'var(--bg-secondary)', padding: '36px 24px', textAlign: 'center' }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(48,209,88,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <s.icon size={18} color="#2FD968" />
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.048em', color: 'var(--text-primary)', marginBottom: 6 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.18)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 }}>
            <Zap size={12} color="#2FD968" fill="#2FD968" />
            <span style={{ fontSize: 11, color: 'var(--green-400)', fontWeight: 700, letterSpacing: '0.06em' }}>SIX POWERFUL MODULES</span>
          </div>
          <h2 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.042em', margin: '0 0 16px' }}>Everything in one place</h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', margin: '0 auto', maxWidth: 520, lineHeight: 1.6 }}>Stop juggling 6 different apps. Finora unifies your entire financial life in one beautifully designed platform.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="card" style={{ padding: 32, cursor: 'default', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + '45'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ width: 50, height: 50, borderRadius: 16, background: f.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <f.icon size={22} color={f.color} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: f.color, background: f.color + '16', padding: '3px 10px', borderRadius: 999, letterSpacing: '0.06em' }}>{f.tag}</span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 10px' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--separator)', borderBottom: '1px solid var(--separator)', padding: '100px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.18)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 }}>
              <Globe size={12} color="#0A84FF" />
              <span style={{ fontSize: 11, color: '#0A84FF', fontWeight: 700, letterSpacing: '0.06em' }}>HOW IT WORKS</span>
            </div>
            <h2 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.042em', margin: '0 0 14px' }}>From zero to wealth builder</h2>
            <p style={{ fontSize: 18, color: 'var(--text-secondary)', margin: 0 }}>Get started in minutes. See results in weeks.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
            {STEPS.map((step, i) => (
              <div key={step.num} style={{ position: 'relative', padding: '0 40px 0 0' }}>
                {i < 2 && (
                  <div style={{ position: 'absolute', top: 28, left: 'calc(100% - 40px)', width: 40, height: 1, background: 'linear-gradient(90deg, var(--separator-mid), transparent)', zIndex: 0 }} />
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: step.color + '14', border: `1.5px solid ${step.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: step.color, fontVariantNumeric: 'tabular-nums' }}>{step.num}</span>
                  </div>
                  <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 12px' }}>{step.title}</h3>
                  <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI AGENTS ─────────────────────────────────────────────────────── */}
      <section id="agents" style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.18)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 }}>
            <Bot size={12} color="#BF5AF2" />
            <span style={{ fontSize: 11, color: '#BF5AF2', fontWeight: 700, letterSpacing: '0.06em' }}>AI-POWERED INTELLIGENCE</span>
          </div>
          <h2 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.042em', margin: '0 0 16px' }}>Your AI executive team</h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto', lineHeight: 1.65 }}>Finora runs 7 AI executive agents in the background — analyzing markets, optimizing your strategy, and running automated wealth workflows 24/7.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {AGENTS.map(agent => (
            <div key={agent.name} className="card" style={{ padding: 26, textAlign: 'center', cursor: 'default', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = agent.color + '45'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: agent.color + '18', border: `2px solid ${agent.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 14, fontWeight: 900, color: agent.color }}>{agent.name[0]}</div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.015em', marginBottom: 4 }}>{agent.name}</div>
              <div style={{ fontSize: 11, color: agent.color, fontWeight: 700, marginBottom: 10, letterSpacing: '0.02em' }}>{agent.role}</div>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, margin: 0 }}>{agent.desc}</p>
            </div>
          ))}
          {/* 8th — CTA card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(48,209,88,0.1), rgba(48,209,88,0.03))', border: '1px solid rgba(48,209,88,0.22)', borderRadius: 20, padding: 26, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ fontSize: 36 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>Your AI team,<br />ready to deploy</div>
            <Link href="/signup" className="btn btn-green btn-md" style={{ fontSize: 13, borderRadius: 10 }}>Get access <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section id="testimonials" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--separator)', borderBottom: '1px solid var(--separator)', padding: '100px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.18)', borderRadius: 999, padding: '5px 14px', marginBottom: 20 }}>
              <Star size={12} color="#FFD60A" fill="#FFD60A" />
              <span style={{ fontSize: 11, color: '#FFD60A', fontWeight: 700, letterSpacing: '0.06em' }}>LOVED BY USERS</span>
            </div>
            <h2 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.042em', margin: '0 0 14px' }}>Real results, real people</h2>
            <p style={{ fontSize: 18, color: 'var(--text-secondary)', margin: 0 }}>Don't just take our word for it — here's what our community achieved.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} size={13} color="#FFD60A" fill="#FFD60A" />)}
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.75, margin: 0, flex: 1 }}>"{t.text}"</p>
                <div style={{ background: 'rgba(48,209,88,0.07)', border: '1px solid rgba(48,209,88,0.16)', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#2FD968' }}>
                  ✓ {t.result}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4, borderTop: '1px solid var(--separator)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: t.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: t.color, flexShrink: 0 }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.handle} · <span style={{ color: t.color, fontWeight: 600 }}>{t.plan}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.042em', margin: '0 0 14px' }}>Why Finora wins</h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', margin: 0 }}>Compare us against the alternatives.</p>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 160px', padding: '16px 24px', borderBottom: '1px solid var(--separator)', background: 'var(--bg-tertiary)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>Feature</div>
            {[{ label: 'Finora', color: '#2FD968' }, { label: 'Spreadsheets', color: 'var(--text-tertiary)' }, { label: 'Other apps', color: 'var(--text-tertiary)' }].map(h => (
              <div key={h.label} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: h.color }}>{h.label}</div>
            ))}
          </div>
          {COMPARE.map((row, i) => (
            <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 160px', padding: '14px 24px', borderBottom: i < COMPARE.length - 1 ? '1px solid var(--separator)' : 'none', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{row.feature}</div>
              {([row.finora, row.sheets, row.apps] as Array<boolean | string>).map((val, j) => (
                <div key={j} style={{ textAlign: 'center' }}>{cellIcon(val)}</div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── COMPANY / OUR STORY ───────────────────────────────────────────── */}
      <section id="company" style={{ background: 'linear-gradient(180deg, var(--bg-secondary), var(--bg-base))', borderTop: '1px solid var(--separator)', padding: '100px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.18)', borderRadius: 999, padding: '5px 14px', marginBottom: 24 }}>
                <Award size={12} color="#2FD968" />
                <span style={{ fontSize: 11, color: 'var(--green-400)', fontWeight: 700, letterSpacing: '0.06em' }}>OUR STORY</span>
              </div>
              <h2 style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.04em', margin: '0 0 20px', lineHeight: 1.08 }}>
                We built the tool we wished existed
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 16px' }}>
                Finora was born out of frustration. We were using 6 different apps — one for budgeting, another for portfolio tracking, a third for learning, spreadsheets for net worth — and spending more time managing tools than actually building wealth.
              </p>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 32px' }}>
                We built Finora as the single home for your financial life. Apple-grade design. AI woven into every feature. A community that actually holds you accountable.
              </p>
              <div style={{ display: 'flex', gap: 32 }}>
                {[{ num: '77', label: 'Calculators' }, { num: '6', label: 'Core Modules' }, { num: '24/7', label: 'AI Coach' }].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: 'var(--text-primary)', marginBottom: 2 }}>{s.num}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { icon: Shield, title: 'Bank-grade security', desc: 'Row-level encryption, JWT auth, zero third-party data selling. Your wealth data stays yours.', color: '#2FD968' },
                { icon: Globe, title: 'Built for scale', desc: 'Built on Supabase + Vercel infrastructure designed to scale with you from day one.', color: '#0A84FF' },
                { icon: Bot, title: 'AI-first platform', desc: "Not a chatbot bolted on — AI is woven into every feature, from coaching to agent workflows.", color: '#BF5AF2' },
                { icon: Users, title: 'Community-powered', desc: "Real accountability, real milestones, real support. You're not alone.", color: '#FF9F0A' },
              ].map(item => (
                <div key={item.title} className="card" style={{ padding: 22 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <item.icon size={18} color={item.color} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.01em' }}>{item.title}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ maxWidth: 1020, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.042em', margin: '0 0 14px' }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', margin: 0 }}>Start free. Upgrade when you're ready to unlock more.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {PLANS.map(p => (
            <div key={p.name} style={{ background: p.popular ? 'linear-gradient(145deg, rgba(48,209,88,0.1), rgba(48,209,88,0.04))' : 'var(--bg-secondary)', border: `1px solid ${p.popular ? 'rgba(48,209,88,0.32)' : 'var(--border)'}`, borderRadius: 24, padding: 30, position: 'relative', boxShadow: p.popular ? '0 0 50px rgba(48,209,88,0.1)' : 'none' }}>
              {p.popular && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--green-400)', color: '#000', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 999, letterSpacing: '0.08em' }}>MOST POPULAR</div>}
              <div style={{ marginBottom: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: p.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p.icon size={17} color={p.color} />
                  </div>
                  <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>{p.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.05em' }}>${p.price}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{p.price === 0 ? '/ forever' : '/ month'}</span>
                </div>
              </div>
              <Link href="/signup" className={`btn btn-md ${p.popular ? 'btn-green' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'center', marginBottom: 26, display: 'flex', textDecoration: 'none', borderRadius: 12, fontWeight: 600 }}>
                {p.price === 0 ? 'Get started free' : `Start with ${p.name}`}
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                    <Check size={14} color={p.color} style={{ flexShrink: 0, marginTop: 2 }} />{f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', marginTop: 24 }}>
          All plans include free onboarding · Cancel anytime · Data never sold
        </p>
      </section>

      {/* ── SECURITY TRUST ────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--separator)', borderBottom: '1px solid var(--separator)', padding: '60px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 14 }}>
            <Lock size={16} color="#2FD968" />
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>Enterprise-grade security you can trust</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
            Your financial data is protected by multiple layers of encryption and access control. We take privacy seriously — your information is never sold or shared.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {[{ e: '🔒', l: 'Encrypted in transit & at rest' }, { e: '🛡️', l: 'Privacy-first design' }, { e: '🚫', l: 'Zero data selling' }, { e: '🔐', l: 'Row-level security' }].map(b => (
              <div key={b.l} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 18px', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                <span>{b.e}</span><span>{b.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── NEWSLETTER ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(48,209,88,0.1), rgba(10,132,255,0.06))', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 24, padding: '56px 52px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(48,209,88,0.12), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -50, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(10,132,255,0.08), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.038em', margin: '0 0 12px' }}>Get wealth insights in your inbox</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 1.7, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              Join 18,000+ subscribers getting weekly tips on investing, AI tools, and wealth-building strategies. No spam, ever. Unsubscribe anytime.
            </p>
            {!newsletterDone ? (
              <form onSubmit={handleNewsletter} style={{ display: 'flex', gap: 10, maxWidth: 440, margin: '0 auto 16px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Mail size={15} color="var(--text-tertiary)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} className="input-field" style={{ paddingLeft: 42 }} required disabled={newsletterLoading} />
                </div>
                <button type="submit" className="btn btn-green btn-md" style={{ flexShrink: 0, borderRadius: 10, fontWeight: 600, opacity: newsletterLoading ? 0.6 : 1 }} disabled={newsletterLoading}>
                  {newsletterLoading ? 'Subscribing…' : 'Subscribe'}
                </button>
              </form>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 12, padding: '14px 24px', marginBottom: 16 }}>
                <Check size={16} color="#2FD968" />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#2FD968' }}>You're in! Check your inbox.</span>
              </div>
            )}
            {newsletterError && (
              <div style={{ fontSize: 13, color: '#FF6B67', marginBottom: 16 }}>{newsletterError}</div>
            )}
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['18K+ subscribers', 'Weekly drops', 'Zero spam'].map(b => (
                <span key={b} style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Check size={11} color="var(--text-tertiary)" />{b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 780, margin: '0 auto', padding: '0 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 50, fontWeight: 800, letterSpacing: '-0.042em', margin: '0 0 14px' }}>Got questions?</h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', margin: 0 }}>Everything you need to know before signing up.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: faqOpen === i ? '1px solid rgba(48,209,88,0.28)' : '1px solid var(--border)', overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} style={{ width: '100%', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: faqOpen === i ? 'var(--text-primary)' : 'var(--text-primary)', textAlign: 'left', letterSpacing: '-0.01em' }}>{faq.q}</span>
                <ChevronDown size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, transform: faqOpen === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)' }} />
              </button>
              {faqOpen === i && (
                <div style={{ padding: '0 22px 20px', borderTop: '1px solid var(--separator)' }}>
                  <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '16px 0 0' }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 32px 120px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', background: 'linear-gradient(135deg, rgba(48,209,88,0.12), rgba(48,209,88,0.04))', border: '1px solid rgba(48,209,88,0.22)', borderRadius: 28, padding: '80px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(48,209,88,0.14), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(10,132,255,0.08), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>🚀</div>
            <h2 style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.045em', margin: '0 0 16px', lineHeight: 1.05 }}>
              Start building wealth
              <br />
              <span style={{ color: '#2FD968' }}>today, for free</span>
            </h2>
            <p style={{ fontSize: 19, color: 'var(--text-secondary)', margin: '0 auto 40px', maxWidth: 500, lineHeight: 1.65 }}>
              No credit card required. Free plan forever. The best time to start was yesterday — the second best time is now.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
              <Link href="/signup" className="btn btn-green" style={{ fontSize: 18, height: 62, padding: '0 46px', borderRadius: 18, fontWeight: 700 }}>
                Create free account <ArrowRight size={19} />
              </Link>
              <Link href="/signin" className="btn btn-secondary" style={{ fontSize: 18, height: 62, padding: '0 46px', borderRadius: 18 }}>
                Sign in
              </Link>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Setup in 60 seconds · No credit card · Cancel anytime</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--separator)', padding: '64px 48px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1fr', gap: 40, marginBottom: 56 }}>
            {/* Brand column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--green-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FinoraGlyph size={15} />
                </div>
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em' }}>Finora</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.7, margin: '0 0 24px', maxWidth: 240 }}>
                The smarter way to build wealth. AI-powered, community-driven, beautifully designed.
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                {['𝕏', 'in', '💬', '▶'].map((icon, i) => (
                  <a key={i} href="#" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, textDecoration: 'none', color: 'var(--text-tertiary)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}>{icon}</a>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{copyrightLine()}</div>
            </div>
            {/* Link columns */}
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'AI Agents', 'Research', 'Marketplace', 'Learning'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press', 'Contact'] },
              { title: 'Resources', links: ['Documentation', 'API Reference', 'Community', 'Changelog', 'Status'] },
              { title: 'Legal', links: ['Privacy Policy', 'Terms of Use', 'Cookie Policy', 'Security', 'Support'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18 }}>{col.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {col.links.map(link => (
                    <a key={link} href="#" style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', letterSpacing: '-0.005em', transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>{link}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--separator)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Made with ❤️ for wealth builders worldwide</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['🇺🇸', '🇬🇧', '🇮🇳', '🇨🇦', '🇦🇺'].map(flag => <span key={flag} style={{ fontSize: 16 }}>{flag}</span>)}
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
