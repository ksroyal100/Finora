'use client'
import { useId, useState } from 'react'

// Probability cone for the What-If Simulator. Colours come from the app's CSS variables
// so it follows light/dark theme. Axis labels are HTML (not SVG text) so they don't
// stretch with preserveAspectRatio="none".
export interface ConeChartProps {
  p10: number[]; p50: number[]; p90: number[]
  compare?: number[]            // typical path of "your current plan", drawn dashed
  target?: number | null
  months: number
  fmt: (v: number) => string
  fmtFull: (v: number) => string
  height?: number
}

export function ConeChart({ p10, p50, p90, compare, target, months, fmt, fmtFull, height = 260 }: ConeChartProps) {
  const W = 800, H = 260, pad = 6
  const gid = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [hover, setHover] = useState<number | null>(null)
  const n = p50.length

  const all = [...p10, ...p90, ...(compare ?? []), ...(target ? [target] : [])]
  const lo = 0, hiRaw = Math.max(...all, 1)
  const hi = hiRaw * 1.06
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - pad * 2)
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2)
  const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const band = `${p90.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} ` +
    `${p10.map((v, i) => [v, i] as const).reverse().map(([v, i]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} Z`
  const grid = [0.25, 0.5, 0.75].map(f => ({ f, v: lo + (hi - lo) * (1 - f) }))

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))))
  }
  const yearLabel = (i: number) => (i === 0 ? 'Today' : `Year ${+(i / 12).toFixed(1)}`)
  const years = months / 12

  return (
    <div>
      <div style={{ position: 'relative', height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }} role="img" aria-label="Projected range of outcomes over time">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--text-green)" stopOpacity="0.30" />
              <stop offset="100%" stopColor="var(--text-green)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {grid.map(g => <line key={g.f} x1="0" x2={W} y1={H * g.f} y2={H * g.f} stroke="var(--separator)" vectorEffect="non-scaling-stroke" strokeDasharray="3 5" />)}
          <path d={band} fill={`url(#${gid})`} />
          {compare && <path d={line(compare)} fill="none" stroke="var(--text-blue)" strokeWidth="1.8" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" opacity="0.9" />}
          {target ? <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="var(--text-gold)" strokeWidth="1.3" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" /> : null}
          <path d={line(p50)} fill="none" stroke="var(--text-green)" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--text-tertiary)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {grid.map(g => (
          <span key={g.f} style={{ position: 'absolute', left: 4, top: `${g.f * 100}%`, transform: 'translateY(-110%)', fontSize: 10, color: 'var(--text-tertiary)' }}>{fmt(g.v)}</span>
        ))}
        {target ? (
          <span style={{ position: 'absolute', right: 4, top: `${(y(target) / H) * 100}%`, transform: 'translateY(-115%)', fontSize: 10, fontWeight: 600, color: 'var(--text-gold)', background: 'var(--bg-secondary)', padding: '0 4px', borderRadius: 4 }}>
            Goal {fmt(target)}
          </span>
        ) : null}
        {hover !== null && (
          <>
            <div style={{ position: 'absolute', left: `${(x(hover) / W) * 100}%`, top: `${(y(p50[hover]) / H) * 100}%`, width: 10, height: 10, borderRadius: '50%', background: 'var(--text-green)', border: '2px solid var(--bg-secondary)', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
            <div style={{
              position: 'absolute', top: 6, pointerEvents: 'none', left: `${Math.min(62, Math.max(0, (x(hover) / W) * 100 - 14))}%`,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 11px', fontSize: 12, whiteSpace: 'nowrap', boxShadow: '0 6px 24px rgba(0,0,0,.25)',
            }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 3 }}>{yearLabel(hover)}</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fmtFull(p50[hover])} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>typical</span></div>
              <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{fmtFull(p10[hover])} – {fmtFull(p90[hover])}</div>
            </div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
        <span>Today</span><span>Year {+(years / 2).toFixed(1)}</span><span>Year {+years.toFixed(1)}</span>
      </div>
    </div>
  )
}
