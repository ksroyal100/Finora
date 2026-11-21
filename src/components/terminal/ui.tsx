'use client'
// Primitives for the Performance Terminal. The terminal is intentionally ALWAYS
// dark (it's a HUD, like a trading desk) regardless of the app's light/dark
// theme, so it uses its own palette instead of the global CSS variables.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export const T = {
  bg: '#050607',
  panel: '#0A0C0F',
  panel2: '#0E1115',
  line: '#1A1F26',
  text: '#E6EAF0',
  dim: '#6B7480',
  faint: '#3A424D',
  amber: '#FFB020',
  green: '#19D67A',
  red: '#FF3B47',
  cyan: '#38D5FF',
  violet: '#B069FF',
  mono: "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
} as const

export const fmtMoney = (v: number, currency = 'USD', cents = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
  }).format(v)

export const fmtCompact = (v: number, currency = 'USD') => {
  const sym = fmtMoney(0, currency).replace(/[\d.,\s]/g, '') || '$'
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e9) return `${s}${sym}${(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${s}${sym}${(a / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${s}${sym}${(a / 1e3).toFixed(1)}K`
  return `${s}${sym}${a.toFixed(0)}`
}

export const fmtPct = (v: number, digits = 2, sign = true) =>
  `${sign && v > 0 ? '+' : ''}${v.toFixed(digits)}%`

export const tone = (v: number) => (v > 0 ? T.green : v < 0 ? T.red : T.dim)

// ── Count-up hook (respects prefers-reduced-motion) ───────────
export function useCountUp(target: number, ms = 800): number {
  const [val, setVal] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || from.current === target) { setVal(target); from.current = target; return }
    const start = performance.now(), a = from.current
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setVal(a + (target - a) * e)
      if (t < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}

// ── Global styles for the terminal (scoped by .pt- prefix) ────
export const TERMINAL_CSS = `
.pt-root{background:${T.bg};color:${T.text};font-family:${T.mono};font-size:11px;border:1px solid ${T.line};border-radius:14px;padding:10px;position:relative;overflow:hidden}
.pt-root *{box-sizing:border-box}
.pt-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px}
.pt-c5{grid-column:span 5}.pt-c7{grid-column:span 7}.pt-c4{grid-column:span 4}.pt-c8{grid-column:span 8}.pt-c6{grid-column:span 6}.pt-c12{grid-column:span 12}
@media (max-width:1100px){.pt-c5,.pt-c7,.pt-c4,.pt-c8,.pt-c6{grid-column:span 12}}
.pt-panel{background:${T.panel};border:1px solid ${T.line};border-radius:8px;padding:10px 12px;min-width:0;position:relative}
.pt-ph{display:flex;align-items:center;gap:8px;margin-bottom:9px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:${T.text};font-weight:700}
.pt-ph .pt-sub{color:${T.dim};font-weight:500}
.pt-ph .pt-sp{flex:1}
.pt-chip{font-size:9px;letter-spacing:.08em;padding:2px 7px;border-radius:4px;border:1px solid ${T.line};color:${T.dim};background:${T.panel2};font-weight:700;white-space:nowrap}
.pt-chip.g{color:${T.green};border-color:${T.green}55;background:${T.green}12}
.pt-chip.r{color:${T.red};border-color:${T.red}55;background:${T.red}12}
.pt-chip.a{color:${T.amber};border-color:${T.amber}55;background:${T.amber}12}
.pt-chip.c{color:${T.cyan};border-color:${T.cyan}55;background:${T.cyan}12}
button.pt-chip{cursor:pointer;font-family:inherit}
button.pt-chip:hover{border-color:${T.dim}}
button.pt-chip.on{color:${T.amber};border-color:${T.amber}88;background:${T.amber}18}
.pt-dot{width:7px;height:7px;border-radius:50%;background:${T.green};box-shadow:0 0 8px ${T.green};animation:pt-pulse 1.6s ease-in-out infinite;display:inline-block}
.pt-dot.demo{background:${T.amber};box-shadow:0 0 8px ${T.amber}}
@keyframes pt-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes pt-spin{to{transform:rotate(360deg)}}
@keyframes pt-scan{0%{transform:translateX(-10%)}100%{transform:translateX(110%)}}
@keyframes pt-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes pt-draw{from{stroke-dashoffset:var(--len)}to{stroke-dashoffset:0}}
.pt-big{font-weight:800;letter-spacing:-.03em;color:${T.amber};text-shadow:0 0 28px ${T.amber}40;line-height:1}
.pt-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
@media (max-width:640px){.pt-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}}
.pt-kpi .l{font-size:8.5px;letter-spacing:.12em;color:${T.dim};text-transform:uppercase;margin-bottom:3px}
.pt-kpi .v{font-size:17px;font-weight:800;letter-spacing:-.02em}
.pt-row{display:flex;align-items:center;gap:8px}
.pt-tape{overflow:hidden;white-space:nowrap;border:1px solid ${T.line};border-radius:6px;background:${T.panel}}
.pt-tape .in{display:inline-flex;gap:26px;padding:6px 0;animation:pt-marquee 60s linear infinite}
.pt-tape:hover .in{animation-play-state:paused}
.pt-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
.pt-tbl th{font-size:8.5px;letter-spacing:.1em;color:${T.dim};text-align:right;padding:0 0 5px;font-weight:600;text-transform:uppercase}
.pt-tbl th:first-child,.pt-tbl td:first-child{text-align:left}
.pt-tbl td{padding:5px 0;border-top:1px solid ${T.line};text-align:right;font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.pt-dot,.pt-tape .in,.pt-spin{animation:none!important}}
`

// ── Panel chrome ──────────────────────────────────────────────
export function Panel({ title, sub, right, children, className = '', style }: {
  title: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <section className={`pt-panel ${className}`} style={style}>
      <div className="pt-ph">
        <span style={{ width: 3, height: 11, background: T.amber, borderRadius: 1 }} />
        <span>{title}</span>
        {sub && <span className="pt-sub">· {sub}</span>}
        <span className="pt-sp" />
        {right}
      </div>
      {children}
    </section>
  )
}

// ── Equity / line / area chart (SVG, responsive) ──────────────
// Axis labels are HTML (not SVG <text>) so they don't stretch with
// preserveAspectRatio="none".
export function AreaChart({ values, labels, height = 150, color = T.amber, secondary, band, refLine, fmt, hoverFmt }: {
  values: number[]; labels: string[]; height?: number; color?: string
  secondary?: number[] // optional drawdown (<=0) drawn as an underlay
  band?: { lo: number[]; hi: number[]; mid?: number[] } // optional cone (Monte Carlo)
  refLine?: { value: number; label: string } | null // e.g. a goal target
  fmt: (v: number) => string
  hoverFmt?: (i: number) => string
}) {
  const W = 800, H = 200, pad = 6
  const [hover, setHover] = useState<number | null>(null)

  const all = [...values, ...(band ? [...band.lo, ...band.hi] : []), ...(refLine ? [refLine.value] : [])]
  if (!all.length) return <div style={{ height }} />
  let lo = Math.min(...all), hi = Math.max(...all)
  if (hi === lo) { hi += 1; lo -= 1 }
  const padV = (hi - lo) * 0.08
  lo -= padV; hi += padV

  const n = Math.max(values.length, band ? band.lo.length : 0)
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2))
  const y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2)
  const line = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}` // stable across SSR/hydration
  const areaPath = values.length > 1 ? `${line(values)} L${x(values.length - 1)},${H} L${x(0)},${H} Z` : ''
  const bandPath = band
    ? `${band.hi.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} ` +
      `${[...band.lo].map((v, i) => [v, i] as const).reverse().map(([v, i]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} Z`
    : ''

  const grid = [0.25, 0.5, 0.75].map(f => ({ f, v: lo + (hi - lo) * (1 - f) }))
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - r.left) / r.width
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))))
  }
  const hv = hover !== null && values[hover] !== undefined ? values[hover] : null

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative', height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {grid.map(g => (
            <line key={g.f} x1="0" x2={W} y1={H * g.f} y2={H * g.f} stroke={T.line} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 4" />
          ))}
          {refLine && <line x1="0" x2={W} y1={y(refLine.value)} y2={y(refLine.value)} stroke={T.cyan} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />}
          {bandPath && <path d={bandPath} fill={color} fillOpacity="0.13" />}
          {band?.mid && <path d={line(band.mid)} fill="none" stroke={color} strokeOpacity="0.9" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeDasharray="5 4" />}
          {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
          {values.length > 1 && <path d={line(values)} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke={T.dim} strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
        </svg>
        {refLine && (
          <span style={{ position: 'absolute', right: 4, top: `${(y(refLine.value) / H) * 100}%`, transform: 'translateY(-115%)', fontSize: 8.5, color: T.cyan, background: T.panel, padding: '0 3px' }}>{refLine.label}</span>
        )}
        {/* y-axis labels */}
        {grid.map(g => (
          <span key={g.f} style={{ position: 'absolute', left: 2, top: `${g.f * 100}%`, transform: 'translateY(-110%)', fontSize: 8.5, color: T.faint }}>{fmt(g.v)}</span>
        ))}
        {hover !== null && hv !== null && (
          <>
            <div style={{ position: 'absolute', left: `${(x(hover) / W) * 100}%`, top: `${(y(hv) / H) * 100}%`, width: 8, height: 8, borderRadius: '50%', background: color, border: `2px solid ${T.bg}`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
            <div style={{
              position: 'absolute', top: 2, pointerEvents: 'none',
              left: `${Math.min(78, Math.max(0, (x(hover) / W) * 100 - 10))}%`,
              background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 5, padding: '3px 7px', fontSize: 9.5, whiteSpace: 'nowrap',
            }}>
              <span style={{ color: T.dim }}>{labels[hover] ?? ''} </span>
              <b style={{ color }}>{hoverFmt ? hoverFmt(hover) : fmt(hv)}</b>
              {secondary && secondary[hover] !== undefined && secondary[hover] < 0 && (
                <span style={{ color: T.red }}> · DD {secondary[hover].toFixed(1)}%</span>
              )}
            </div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, color: T.faint, marginTop: 3 }}>
        <span>{labels[0]}</span><span>{labels[Math.floor((labels.length - 1) / 2)]}</span><span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  )
}

// ── Mini drawdown strip ───────────────────────────────────────
export function DrawdownStrip({ dd, height = 34 }: { dd: number[]; height?: number }) {
  if (dd.length < 2) return <div style={{ height }} />
  const W = 800, H = 60
  const min = Math.min(...dd, -0.5)
  const x = (i: number) => (i / (dd.length - 1)) * W
  const y = (v: number) => (v / min) * (H - 4)
  const p = dd.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <path d={`${p} L${W},0 L0,0 Z`} fill={T.red} fillOpacity="0.25" />
      <path d={p} fill="none" stroke={T.red} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <line x1="0" x2={W} y1="0" y2="0" stroke={T.line} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ── Ring gauge (goal progress, diversification, etc.) ─────────
export function Ring({ pct, size = 92, stroke = 7, color = T.green, label, sub }: {
  pct: number; size?: number; stroke?: number; color?: string; label: string; sub?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct))
  const ticks = 48
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* tick ring (HUD feel) */}
        {Array.from({ length: ticks }).map((_, i) => {
          const a = (i / ticks) * 2 * Math.PI
          const r1 = r + stroke / 2 + 2, r2 = r1 + (i % 4 === 0 ? 4 : 2)
          const cx = size / 2, cy = size / 2
          const on = (i / ticks) * 100 <= p
          return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke={on ? color : T.faint} strokeOpacity={on ? 0.9 : 0.5} strokeWidth="1" />
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.line} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`} style={{ filter: `drop-shadow(0 0 5px ${color}88)`, transition: 'stroke-dasharray .8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 800, color, letterSpacing: '-.02em' }}>{label}</div>
        {sub && <div style={{ fontSize: 7.5, color: T.dim, letterSpacing: '.1em', textTransform: 'uppercase' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Semi-circle gauge (risk meters) ───────────────────────────
export function Gauge({ value, max, label, display, color }: {
  value: number; max: number; label: string; display: string; color: string
}) {
  const p = Math.max(0, Math.min(1, value / max))
  const R = 38, C = Math.PI * R
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 100 58" style={{ width: '100%', maxWidth: 120 }}>
        <path d="M12,50 A38,38 0 0 1 88,50" fill="none" stroke={T.line} strokeWidth="7" strokeLinecap="round" />
        <path d="M12,50 A38,38 0 0 1 88,50" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${p * C} ${C}`} style={{ filter: `drop-shadow(0 0 4px ${color}88)`, transition: 'stroke-dasharray .8s ease' }} />
        <text x="50" y="46" textAnchor="middle" fill={color} fontSize="15" fontWeight="800" fontFamily={T.mono}>{display}</text>
      </svg>
      <div style={{ fontSize: 8.5, color: T.dim, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: -2 }}>{label}</div>
    </div>
  )
}

// ── Heat tile colour (red ← 0 → green), intensity by |value| ──
export function heatColor(v: number, scale: number) {
  const k = Math.max(0, Math.min(1, Math.abs(v) / scale))
  const a = 0.14 + k * 0.62
  return v >= 0 ? `rgba(25,214,122,${a.toFixed(2)})` : `rgba(255,59,71,${a.toFixed(2)})`
}
