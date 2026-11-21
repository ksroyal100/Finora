'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line } from 'recharts'
import { formatCurrency } from '@/lib/utils'

export interface ChartSeries {
  key: string
  color: string
  label: string
  type?: 'area' | 'line'
}

interface GrowthChartProps {
  data: Array<Record<string, number | string>>
  series: ChartSeries[]
  height?: number
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '10px 14px', fontSize: 12, boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0,0,0,0.4))',
    }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', color: p.color, fontWeight: 600 }}>
          <span>{p.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(p.value, 'USD', true)}</span>
        </div>
      ))}
    </div>
  )
}

export function GrowthChart({ data, series, height = 260 }: GrowthChartProps) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} axisLine={{ stroke: 'var(--separator)' }} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatCurrency(v, 'USD', true)}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          {series.map(s => (
            s.type === 'line' ? (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            ) : (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} />
            )
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
