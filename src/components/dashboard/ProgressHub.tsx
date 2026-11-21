'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Flame, Trophy } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/lib/useCurrency'
import { loadProgressData, type ProgressData } from '@/lib/progress/loaders'
import { buildWeeklyRecap } from '@/lib/progress/recap'
import { debtFreeMilestone, goalMilestones, netWorthMilestones, savingsRateMilestone, weeklyStreak, type Milestone } from '@/lib/progress/milestones'

const card: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }
const TONE: Record<'good' | 'bad' | 'neutral', string> = { good: 'var(--text-green)', bad: 'var(--text-red)', neutral: 'var(--text-tertiary)' }

function Skeleton() {
  return (
    <div className="progress-hub-grid" aria-busy="true" aria-label="Loading your progress">
      {[0, 1].map(i => <div key={i} style={{ ...card, minHeight: 220, opacity: 0.55 }} />)}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: tone ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

export function ProgressHub({ data: injected }: { data?: ProgressData | null } = {}) {
  const { currency } = useCurrency()
  const [data, setData] = useState<ProgressData | null | undefined>(injected)   // undefined = loading, null = signed out

  useEffect(() => {
    if (injected !== undefined) return
    let alive = true
    loadProgressData().then(d => { if (alive) setData(d) }).catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [injected])

  const view = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const money = (n: number) => formatCurrency(n, currency)
    const sym = formatCurrency(0, currency).replace(/[\d.,\s]/g, '') || '$'
    const recap = buildWeeklyRecap({
      now, fmt: money, snapshots: data.snapshots.map(s => ({ date: s.date, netWorth: s.netWorth })),
      transactions: data.transactions, holdings: data.holdings, goals: data.goals,
    })
    const nw = netWorthMilestones(data.snapshots.map(s => ({ date: s.date, value: s.netWorth, liabilities: s.liabilities })), sym)
    const history = data.snapshots.map(s => ({ date: s.date, value: s.netWorth, liabilities: s.liabilities }))
    const debtFree = debtFreeMilestone(history)
    const savings = savingsRateMilestone(data.savingsRatePct)
    const achievements: Milestone[] = [
      ...nw.achieved.slice(-2).reverse(),
      ...(debtFree ? [debtFree] : []),
      ...(savings ? [savings] : []),
      ...goalMilestones(data.goals).sort((x, y) => y.detail.localeCompare(x.detail)).slice(0, 2),
    ].slice(0, 5)
    const streak = weeklyStreak(data.transactions.map(t => t.date), now)
    return { recap, nw, achievements, streak, money, sym }
  }, [data, currency])

  if (data === undefined) return <Skeleton />
  if (!data || !view) return null

  if (!data.hasAnyData) {
    return (
      <div style={{ ...card, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 28 }} aria-hidden>🌱</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Start your progress streak</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Log a transaction, add a goal or track an asset and we&apos;ll build your weekly recap and milestones here.</div>
        </div>
        <Link href="/budgeting" className="btn btn-primary" style={{ textDecoration: 'none' }}>Log your first transaction</Link>
      </div>
    )
  }

  const { recap, nw, achievements, streak, money } = view
  const next = nw.next
  const etaText = next?.etaMonths == null ? null
    : next.etaMonths < 1 ? 'less than a month at your current pace'
    : next.etaMonths < 24 ? `about ${Math.round(next.etaMonths)} month${Math.round(next.etaMonths) === 1 ? '' : 's'} at your current pace`
    : `about ${(next.etaMonths / 12).toFixed(1)} years at your current pace`

  return (
    <section aria-label="Your progress" style={{ marginBottom: 24 }}>
      <style>{`.progress-hub-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px}@media (max-width:900px){.progress-hub-grid{grid-template-columns:minmax(0,1fr)}}`}</style>
      <div className="progress-hub-grid">
        {/* ── Weekly recap ───────────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '.02em' }}>YOUR WEEK IN MONEY</div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{recap.periodLabel}</span>
          </div>
          <div data-testid="recap-headline" style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em', marginBottom: 14 }}>{recap.headline}</div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
            {recap.netWorth.hasData && (
              <Stat label="Net worth" value={`${recap.netWorth.change >= 0 ? '+' : '−'}${money(Math.abs(recap.netWorth.change))}`}
                tone={recap.netWorth.change > 0 ? 'var(--text-green)' : recap.netWorth.change < 0 ? 'var(--text-red)' : undefined} />
            )}
            <Stat label="Spent" value={money(recap.spending.thisWeek)} />
            {recap.income > 0 && <Stat label="Income" value={money(recap.income)} tone="var(--text-green)" />}
            {recap.topMover && <Stat label={`${recap.topMover.symbol} today`} value={`${recap.topMover.dayChangePct >= 0 ? '+' : '−'}${Math.abs(recap.topMover.dayChangePct).toFixed(1)}%`} tone={recap.topMover.dayChangePct >= 0 ? 'var(--text-green)' : 'var(--text-red)'} />}
          </div>

          {recap.highlights.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'grid', gap: 7 }}>
              {recap.highlights.slice(0, 4).map((h, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: TONE[h.tone], marginTop: 6, flexShrink: 0 }} />{h.text}
                </li>
              ))}
            </ul>
          )}

          {recap.action && (
            <Link href={recap.action.href} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textDecoration: 'none',
              padding: '12px 14px', borderRadius: 12, background: 'rgba(47,217,104,0.08)', border: '1px solid var(--border-active)',
            }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-green)' }}>{recap.action.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{recap.action.reason}</span>
              </span>
              <ArrowRight size={16} style={{ color: 'var(--text-green)', flexShrink: 0 }} />
            </Link>
          )}
        </div>

        {/* ── Milestones + streak ────────────────── */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '.02em' }}>MILESTONES</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: streak.current > 0 ? 'var(--text-orange)' : 'var(--text-tertiary)' }}>
              <Flame size={14} />{streak.current > 0 ? `${streak.current}-week streak` : 'No streak yet'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }} role="img" aria-label={`Weeks you logged spending, last ${streak.weeks.length} weeks`}>
            {streak.weeks.map((on, i) => (
              <div key={i} title={i === streak.weeks.length - 1 ? 'This week' : `${streak.weeks.length - 1 - i} week${streak.weeks.length - 1 - i > 1 ? 's' : ''} ago`}
                style={{ flex: 1, height: 8, borderRadius: 4, background: on ? 'var(--text-green)' : 'var(--bg-tertiary)', opacity: on ? 1 : 0.9 }} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            {streak.atRisk ? 'Log any transaction this week to keep your streak alive.'
              : streak.current > 0 ? `Best run: ${streak.best} week${streak.best > 1 ? 's' : ''}. Keep logging each week.`
              : 'Log any transaction this week to start a streak.'}
          </div>

          {next ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Next: {view.sym}{next.target >= 1e6 ? `${+(next.target / 1e6).toFixed(1)}M` : `${+(next.target / 1e3).toFixed(0)}K`} net worth</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(next.progressPct)}%</span>
              </div>
              <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${next.progressPct}%` }} /></div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                {money(next.remaining)} to go{etaText ? `, ${etaText}` : ''}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {nw.achieved.length ? 'You have cleared every net-worth milestone we track. Remarkable.' : 'Add assets or take a net-worth snapshot to see your first milestone.'}
            </div>
          )}

          {achievements.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '.04em', marginBottom: 8 }}>
                <Trophy size={12} /> ACHIEVED
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {achievements.map(a => (
                  <span key={a.id} title={a.achievedAt ? `${a.detail} · ${a.achievedAt}` : a.detail} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    color: 'var(--text-primary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                  }}><span aria-hidden>{a.emoji}</span>{a.title}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
