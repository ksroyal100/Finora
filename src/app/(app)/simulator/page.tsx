'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Copy, Check, RotateCcw, Info } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConeChart } from '@/components/simulator/ConeChart'
import { formatCurrency } from '@/lib/utils'
import { useCurrency } from '@/lib/useCurrency'
import { loadSimulatorDefaults, type SimulatorDefaults } from '@/lib/progress/loaders'
import { RISK_PROFILES, deterministicPath, simulate, yearsSooner, yearsToTarget, type RiskProfile, type SimInput } from '@/lib/progress/simulator'

const card: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16 }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }

interface Controls {
  start: number; monthly: number; years: number; risk: RiskProfile | 'custom'
  returnPct: number; volPct: number; stepUpPct: number; real: boolean; inflationPct: number; target: number | null
}

const controlsFrom = (d: SimulatorDefaults): Controls => ({
  start: d.startValue, monthly: d.monthlyContribution, years: 20, risk: 'balanced',
  returnPct: RISK_PROFILES.balanced.annualReturn * 100, volPct: RISK_PROFILES.balanced.annualVol * 100,
  stepUpPct: 0, real: true, inflationPct: 2.5, target: null,
})

const toInput = (c: Controls, extra: Partial<SimInput> = {}): SimInput => ({
  startValue: c.start, monthlyContribution: c.monthly, years: c.years,
  annualReturn: c.returnPct / 100, annualVol: c.volPct / 100, inflation: c.inflationPct / 100, real: c.real,
  contributionGrowth: c.stepUpPct / 100, target: c.target, paths: 800, seed: 20260101, ...extra,
})

function Slider({ title, value, min, max, step, display, onChange, hint }: {
  title: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void; hint?: string
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label style={label}>{title}</label>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))}
        onChange={e => onChange(Number(e.target.value))} aria-label={title}
        style={{ width: '100%', accentColor: 'var(--text-green)', cursor: 'pointer' }} />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${active ? 'var(--border-active)' : 'var(--border)'}`,
      background: active ? 'rgba(47,217,104,0.12)' : 'transparent', color: active ? 'var(--text-green)' : 'var(--text-secondary)',
    }}>{children}</button>
  )
}

export default function SimulatorPage() {
  const { currency } = useCurrency()
  const [defaults, setDefaults] = useState<SimulatorDefaults | null>(null)
  const [c, setC] = useState<Controls | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    loadSimulatorDefaults()
      .catch(() => ({ startValue: 10_000, monthlyContribution: 500, goals: [], isSample: true } as SimulatorDefaults))
      .then(d => { if (alive) { setDefaults(d); setC(controlsFrom(d)) } })
    return () => { alive = false }
  }, [])

  const money = (v: number) => formatCurrency(v, currency)
  const compact = (v: number) => formatCurrency(v, currency, true)

  const deferred = useDeferredValue(c)           // keeps sliders buttery while the simulation recomputes
  const sim = useMemo(() => (deferred ? simulate(toInput(deferred)) : null), [deferred])
  const baseline = useMemo(() => (defaults ? controlsFrom(defaults) : null), [defaults])
  const baseSim = useMemo(() => (baseline && deferred ? simulate(toInput({ ...baseline, years: deferred.years, real: deferred.real, inflationPct: deferred.inflationPct, target: deferred.target })) : null), [baseline, deferred])

  const levers = useMemo(() => {
    if (!deferred) return []
    const end = (o: Partial<Controls>) => deterministicPath(toInput({ ...deferred, ...o })).at(-1) ?? 0
    const now = end({})
    return [
      { label: 'Save $100 more a month', delta: end({ monthly: deferred.monthly + 100 }) - now },
      { label: 'Save $250 more a month', delta: end({ monthly: deferred.monthly + 250 }) - now },
      { label: 'Earn 1% more a year', delta: end({ returnPct: deferred.returnPct + 1 }) - now },
      { label: 'Invest 5 years longer', delta: end({ years: Math.min(60, deferred.years + 5) }) - now },
    ]
  }, [deferred])

  if (!c || !sim || !defaults || !deferred) {
    return (
      <div className="page-container fade-in">
        <PageHeader eyebrow="Plan" title="What-If Simulator" description="See how small changes today could grow over time." />
        <div className="card" style={{ height: 420, opacity: 0.5 }} aria-busy="true" aria-label="Loading simulator" />
      </div>
    )
  }

  const set = (patch: Partial<Controls>) => setC(prev => (prev ? { ...prev, ...patch } : prev))
  const setRisk = (r: RiskProfile) => set({ risk: r, returnPct: +(RISK_PROFILES[r].annualReturn * 100).toFixed(1), volPct: +(RISK_PROFILES[r].annualVol * 100).toFixed(0) })

  const startMax = Math.max(100_000, Math.ceil((defaults.startValue * 2) / 10_000) * 10_000)
  const monthMax = Math.max(5_000, Math.ceil((defaults.monthlyContribution * 4) / 500) * 500)
  const delta = baseSim ? sim.endP50 - baseSim.endP50 : 0
  const differsFromPlan = baseline && (c.monthly !== baseline.monthly || c.start !== baseline.start || c.risk !== baseline.risk || c.stepUpPct !== baseline.stepUpPct)

  const startShare = sim.endP50 > 0 ? (Math.min(c.start, sim.endP50) / sim.endP50) * 100 : 0
  const contribShare = sim.endP50 > 0 ? (sim.totalContributed / sim.endP50) * 100 : 0
  const growthShare = Math.max(0, 100 - startShare - contribShare)
  const multiple = c.start + sim.totalContributed > 0 ? sim.endP50 / (c.start + sim.totalContributed) : null

  const ytt = sim.yearsToTarget
  const sooner = baseline && c.target ? yearsSooner(toInput({ ...baseline, years: c.years, real: c.real, inflationPct: c.inflationPct, target: c.target }), toInput(c)) : null

  const summary = `In ${c.years} years I could have about ${money(sim.endP50)} (likely range ${money(sim.endP10)} to ${money(sim.endP90)}) ` +
    `by saving ${money(c.monthly)}/month with a ${RISK_PROFILES[c.risk === 'custom' ? 'balanced' : c.risk].label.toLowerCase()} mix${c.real ? ", in today's money" : ''}. ` +
    'Projection from Finora. Not financial advice.'
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked: ignore */ }
  }

  return (
    <div className="page-container fade-in">
      <style>{`.sim-grid{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:20px;align-items:start}@media (max-width:980px){.sim-grid{grid-template-columns:minmax(0,1fr)}}`}</style>
      <PageHeader eyebrow="Plan" title="What-If Simulator"
        description="Move the sliders and watch your future change. Starts from your real numbers; nothing here changes your actual data." />

      {defaults.isSample && (
        <div role="note" style={{ ...card, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', borderColor: 'rgba(255,216,115,0.35)' }}>
          You don&apos;t have net worth or savings data yet, so we started with an example ({money(defaults.startValue)} and {money(defaults.monthlyContribution)}/month). Change the sliders to match you.
        </div>
      )}

      <div className="sim-grid">
        {/* ── Controls ─────────────────────────────── */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Your plan</div>
            <button className="btn btn-ghost" onClick={() => setC(controlsFrom(defaults))} style={{ fontSize: 12, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <RotateCcw size={12} /> Reset to my numbers
            </button>
          </div>

          <Slider title="Starting amount" value={c.start} min={0} max={startMax} step={1_000} display={money(c.start)} onChange={v => set({ start: v })}
            hint={defaults.isSample ? undefined : 'Your current net worth'} />
          <Slider title="Save each month" value={c.monthly} min={0} max={monthMax} step={50} display={money(c.monthly)} onChange={v => set({ monthly: v })} />
          <div style={{ display: 'flex', gap: 6, margin: '-8px 0 18px', flexWrap: 'wrap' }}>
            {[100, 250, 500].map(a => <Chip key={a} onClick={() => set({ monthly: c.monthly + a })}>+{money(a)}</Chip>)}
          </div>
          <Slider title="For how many years" value={c.years} min={1} max={40} step={1} display={`${c.years} yrs`} onChange={v => set({ years: v })} />

          <div style={{ ...label, marginBottom: 8 }}>How you invest</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
            {(Object.keys(RISK_PROFILES) as RiskProfile[]).map(k => (
              <button key={k} onClick={() => setRisk(k)} aria-pressed={c.risk === k} style={{
                padding: '10px 12px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                border: `1px solid ${c.risk === k ? 'var(--border-active)' : 'var(--border)'}`,
                background: c.risk === k ? 'rgba(47,217,104,0.10)' : 'transparent',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.risk === k ? 'var(--text-green)' : 'var(--text-primary)' }}>{RISK_PROFILES[k].label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>~{(RISK_PROFILES[k].annualReturn * 100).toFixed(1)}% a year</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            {c.risk === 'custom' ? 'Custom return and swings (see advanced).' : RISK_PROFILES[c.risk].blurb}
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', marginBottom: 14 }}>
            <input type="checkbox" checked={c.real} onChange={e => set({ real: e.target.checked })} style={{ accentColor: 'var(--text-green)', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Show in today&apos;s money <span style={{ color: 'var(--text-tertiary)' }}>(removes inflation)</span></span>
          </label>

          <div style={{ ...label, marginBottom: 6 }}>Goal amount <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></div>
          <input type="number" min={0} inputMode="numeric" placeholder="e.g. 500000" value={c.target ?? ''}
            onChange={e => set({ target: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
            aria-label="Goal amount" className="input" style={{ width: '100%', marginBottom: 8 }} />
          {defaults.goals.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {defaults.goals.slice(0, 4).map(g => <Chip key={g.id} active={c.target === g.target} onClick={() => set({ target: g.target })}>{g.title}</Chip>)}
            </div>
          )}

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Advanced</summary>
            <div style={{ paddingTop: 14 }}>
              <Slider title="Yearly return" value={c.returnPct} min={0} max={14} step={0.5} display={`${c.returnPct.toFixed(1)}%`} onChange={v => set({ returnPct: v, risk: 'custom' })} hint="The typical result, not a promise." />
              <Slider title="Ups and downs (volatility)" value={c.volPct} min={0} max={30} step={1} display={`${c.volPct.toFixed(0)}%`} onChange={v => set({ volPct: v, risk: 'custom' })} hint="Higher means a wider range of outcomes." />
              <Slider title="Raise savings each year" value={c.stepUpPct} min={0} max={10} step={0.5} display={`${c.stepUpPct.toFixed(1)}%`} onChange={v => set({ stepUpPct: v })} hint="E.g. 3% if you save more as your pay grows." />
              <Slider title="Inflation" value={c.inflationPct} min={0} max={8} step={0.5} display={`${c.inflationPct.toFixed(1)}%`} onChange={v => set({ inflationPct: v })} />
            </div>
          </details>
        </div>

        {/* ── Results ──────────────────────────────── */}
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>In {c.years} {c.years === 1 ? 'year' : 'years'} you could have</div>
                <div data-testid="hero-value" style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-green)', lineHeight: 1.05 }}>{money(sim.endP50)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Most likely between <b style={{ color: 'var(--text-secondary)' }}>{money(sim.endP10)}</b> and <b style={{ color: 'var(--text-secondary)' }}>{money(sim.endP90)}</b>
                  {c.real ? " · today's money" : ' · future dollars'}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={copy} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy summary'}
              </button>
            </div>

            {differsFromPlan && baseSim && Math.abs(delta) >= 1 && (
              <div data-testid="vs-plan" style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                background: delta > 0 ? 'rgba(47,217,104,0.10)' : 'rgba(255,107,103,0.10)', color: delta > 0 ? 'var(--text-green)' : 'var(--text-red)',
              }}>
                {delta > 0 ? '+' : '−'}{money(Math.abs(delta))} {delta > 0 ? 'more' : 'less'} than your current plan
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> ({money(baseSim.endP50)})</span>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <ConeChart p10={sim.p10} p50={sim.p50} p90={sim.p90} compare={differsFromPlan && baseSim ? baseSim.deterministic : undefined}
                target={c.target} months={sim.months} fmt={compact} fmtFull={money} />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
                <span><span style={{ display: 'inline-block', width: 14, height: 3, background: 'var(--text-green)', verticalAlign: 'middle', marginRight: 6, borderRadius: 2 }} />Typical path</span>
                <span><span style={{ display: 'inline-block', width: 14, height: 8, background: 'rgba(47,217,104,0.25)', verticalAlign: 'middle', marginRight: 6, borderRadius: 2 }} />Likely range (80% of futures)</span>
                {differsFromPlan && <span><span style={{ display: 'inline-block', width: 14, height: 0, borderTop: '2px dashed var(--text-blue)', verticalAlign: 'middle', marginRight: 6 }} />Your current plan</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {/* where it comes from */}
            <div style={{ ...card, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Where the money comes from</div>
              <div style={{ display: 'flex', height: 12, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-tertiary)', marginBottom: 12 }} role="img" aria-label="Split between starting amount, savings and growth">
                <div style={{ width: `${startShare}%`, background: 'var(--text-blue)' }} />
                <div style={{ width: `${contribShare}%`, background: 'var(--text-gold)' }} />
                <div style={{ width: `${growthShare}%`, background: 'var(--text-green)' }} />
              </div>
              {[['var(--text-blue)', 'Your starting amount', Math.min(c.start, sim.endP50)], ['var(--text-gold)', 'Money you add', sim.totalContributed], ['var(--text-green)', 'Growth', Math.max(0, sim.growth)]].map(([col, name, v]) => (
                <div key={name as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: col as string, marginRight: 8 }} />{name}</span>
                  <b style={{ color: 'var(--text-primary)' }}>{money(v as number)}</b>
                </div>
              ))}
              {multiple !== null && multiple > 1 && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>Every {money(1)} you put in could become about {money(multiple)}.</div>
              )}
            </div>

            {/* target odds OR levers */}
            {c.target ? (
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Reaching {money(c.target)}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: (sim.probTarget ?? 0) >= 70 ? 'var(--text-green)' : (sim.probTarget ?? 0) >= 40 ? 'var(--text-yellow)' : 'var(--text-red)' }}>
                  {Math.round(sim.probTarget ?? 0)}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>chance of having it within {c.years} years</div>
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${sim.probTarget ?? 0}%` }} /></div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.5 }}>
                  {ytt === 0 ? 'You are already past this amount.'
                    : ytt === null ? 'On the typical path you would not reach it within 60 years. Try saving more.'
                    : <>On the typical path you get there in <b style={{ color: 'var(--text-primary)' }}>{ytt.toFixed(1)} years</b>.</>}
                  {sooner !== null && Math.abs(sooner) >= 0.1 && (
                    <> That is <b style={{ color: sooner > 0 ? 'var(--text-green)' : 'var(--text-red)' }}>{Math.abs(sooner).toFixed(1)} years {sooner > 0 ? 'sooner' : 'later'}</b> than your current plan.</>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>What moves the needle</div>
                {levers.map(l => (
                  <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--separator)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
                    <b style={{ color: l.delta >= 0 ? 'var(--text-green)' : 'var(--text-red)' }}>{l.delta >= 0 ? '+' : '−'}{money(Math.abs(l.delta))}</b>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>Change in the typical outcome after {c.years} years.</div>
              </div>
            )}
          </div>

          {c.target && (
            <div style={{ ...card, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>What moves the needle</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0 24px' }}>
                {levers.map(l => (
                  <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderTop: '1px solid var(--separator)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
                    <b style={{ color: l.delta >= 0 ? 'var(--text-green)' : 'var(--text-red)' }}>{l.delta >= 0 ? '+' : '−'}{money(Math.abs(l.delta))}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>This is an educational projection based on the assumptions above, not a forecast, a promise or financial advice. Real markets are bumpier, and past returns don&apos;t guarantee future ones.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
