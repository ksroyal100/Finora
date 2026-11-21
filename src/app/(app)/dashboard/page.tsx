'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Target, DollarSign, PiggyBank, ArrowUpRight, Plus, Bot, Sparkles, BarChart3, Zap, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { MetricCard } from '@/components/shared/MetricCard'
import { InsightsCard } from '@/components/dashboard/InsightsCard'
import { ProgressHub } from '@/components/dashboard/ProgressHub'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency, formatPercent, formatDate, getChangeColor, getChangeClass, cn } from '@/lib/utils'
import { useCurrency } from '@/lib/useCurrency'
import { createClient } from '@/lib/supabase/client'

function HealthScoreRing({ score }: { score: number }) {
  const r = 36, cx = 44, cy = 44
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? 'var(--text-green)' : score >= 60 ? 'var(--text-yellow)' : 'var(--text-red)'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={88} height={88} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={6} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" style={{ fill: 'var(--text-primary)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'var(--font-system)' }}>{score}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" style={{ fill: 'var(--text-tertiary)', fontSize: 9, fontFamily: 'var(--font-system)' }}>/100</text>
      </svg>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>Financial<br />Health Score</div>
      </div>
    </div>
  )
}

function Skeleton({ w = '100%', h = 16, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const { currency } = useCurrency()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [portfolio, goalsRes, snapshots, budget, transactions, healthScore] = await Promise.all([
          supabase.from('portfolios').select('total_value,total_gain_loss,total_gain_loss_pct,day_change,day_change_pct').eq('user_id', user.id).eq('is_default', true).single(),
          supabase.from('goals').select('id,title,target_amount,current_amount,progress_pct,category,icon,color').eq('user_id', user.id).eq('status', 'active').order('priority', { ascending: false }).limit(4),
          supabase.from('net_worth_snapshots').select('net_worth,total_assets,total_liabilities,snapshot_date').eq('user_id', user.id).order('snapshot_date', { ascending: false }).limit(13),
          supabase.from('budgets').select('total_income,total_spent,total_budgeted').eq('user_id', user.id).eq('is_active', true).single(),
          supabase.from('budget_transactions').select('description,amount,is_income,date,budget_categories!category_id(name,icon,color)').eq('user_id', user.id).order('date', { ascending: false }).limit(5),
          supabase.from('financial_health_scores').select('overall_score').eq('user_id', user.id).order('snapshot_date', { ascending: false }).limit(1).single(),
        ])

        const snap = snapshots.data ?? []
        const cur = snap[0]
        const prev = snap[1]
        const netWorth = cur?.net_worth ?? 0
        const prevNW = prev?.net_worth ?? netWorth
        const nwChange = netWorth - prevNW
        const nwChangePct = prevNW !== 0 ? (nwChange / Math.abs(prevNW)) * 100 : 0

        setData({
          netWorth, nwChangePct,
          totalAssets: cur?.total_assets ?? 0,
          totalLiabilities: cur?.total_liabilities ?? 0,
          portfolioValue: portfolio.data?.total_value ?? 0,
          portfolioDayChangePct: portfolio.data?.day_change_pct ?? 0,
          portfolioGainPct: portfolio.data?.total_gain_loss_pct ?? 0,
          monthlyIncome: budget.data?.total_income ?? 0,
          monthlyExpenses: budget.data?.total_spent ?? 0,
          savingsRate: (budget.data?.total_income ?? 0) > 0 ? (((budget.data?.total_income ?? 0) - (budget.data?.total_spent ?? 0)) / (budget.data?.total_income ?? 1)) * 100 : 0,
          healthScore: healthScore.data?.overall_score ?? 0,
          goals: goalsRes.data ?? [],
          transactions: transactions.data ?? [],
          nwHistory: snap.reverse().map((s: any) => s.net_worth),
        })
      } catch (e) {
        console.error('Dashboard load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="page-container fade-in">
        <PageHeader title="Dashboard" description="Loading your wealth overview..." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} className="card" style={{ padding: 20 }}><Skeleton h={60} /></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[1,2].map(i => <div key={i} className="card" style={{ padding: 24, height: 200 }}><Skeleton h={140} /></div>)}
        </div>
      </div>
    )
  }

  const cashFlow = (data?.monthlyIncome ?? 0) - (data?.monthlyExpenses ?? 0)

  return (
    <div className="page-container fade-in">
      <PageHeader
        title="Dashboard"
        description={`${formatDate(new Date(), 'long')} · Your wealth at a glance`}
        actions={
          <Link href="/ai-coach" className="btn btn-md btn-green"><Bot size={15} />Ask AI Coach</Link>
        }
      />

      <QuickActions />

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <MetricCard label="Net Worth" value={formatCurrency(data?.netWorth ?? 0, currency)} change={data?.nwChangePct ?? 0} changePeriod="vs last" sparkline={data?.nwHistory} icon={<DollarSign size={14} color="var(--text-green)" />} size="md" />
        <MetricCard label="Portfolio" value={formatCurrency(data?.portfolioValue ?? 0, currency)} change={data?.portfolioDayChangePct ?? 0} changePeriod="today" icon={<TrendingUp size={14} color="var(--text-blue)" />} iconBg="rgba(10,132,255,0.12)" size="md" />
        <MetricCard label="Cash Flow" value={formatCurrency(cashFlow, currency)} change={data?.savingsRate ?? 0} changePeriod="savings rate" icon={<PiggyBank size={14} color="var(--text-orange)" />} iconBg="rgba(255,159,10,0.12)" size="md" />
        <MetricCard label="Active Goals" value={data?.goals?.length ?? 0} subvalue={`${data?.totalAssets ? formatCurrency(data.totalAssets, currency, true) : '$0'} total assets`} icon={<Target size={14} color="#BF5AF2" />} iconBg="rgba(191,90,242,0.12)" size="md" />
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Health Score */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 16 }}>Financial Health</div>
          <HealthScoreRing score={data?.healthScore ?? 0} />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Assets</div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{formatCurrency(data?.totalAssets ?? 0, currency, true)}</div>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Liabilities</div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-red)' }}>{formatCurrency(data?.totalLiabilities ?? 0, currency, true)}</div>
            </div>
          </div>
        </div>

        {/* Goals */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Active Goals</div>
            <Link href="/goals" style={{ fontSize: 12, color: 'var(--green-400)', textDecoration: 'none' }}>View all</Link>
          </div>
          {data?.goals?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Target size={28} color="var(--text-quaternary)" />
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>No active goals yet</p>
              <Link href="/goals" className="btn btn-sm btn-green" style={{ marginTop: 10, display: 'inline-flex' }}>Add Goal</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data?.goals?.map((g: any) => (
                <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{g.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{g.progress_pct ?? 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${g.progress_pct ?? 0}%`, background: `linear-gradient(90deg, ${g.color ?? 'var(--green-400)'}88, ${g.color ?? 'var(--green-400)'})` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatCurrency(g.current_amount ?? 0, currency)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatCurrency(g.target_amount ?? 0, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProgressHub />

      <InsightsCard />

      {/* Recent Transactions */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Recent Transactions</div>
          <Link href="/budgeting" style={{ fontSize: 12, color: 'var(--green-400)', textDecoration: 'none' }}>View all</Link>
        </div>
        {data?.transactions?.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>No transactions yet. <Link href="/budgeting" style={{ color: 'var(--green-400)' }}>Add one</Link></p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {data?.transactions?.map((tx: any) => (
              <div key={tx.id ?? tx.description} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--separator)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {(tx.budget_categories as any)?.icon ?? (tx.is_income ? '💰' : '💸')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(tx.budget_categories as any)?.name ?? 'Uncategorized'} · {formatDate(tx.date, 'short')}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: tx.is_income ? 'var(--text-green)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {tx.is_income ? '+' : '-'}{formatCurrency(Math.abs(tx.amount), currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )
}
