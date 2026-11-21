'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatCurrency, formatPercent, getChangeColor } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string | number
  prefix?: string
  suffix?: string
  change?: number
  changePeriod?: string
  subvalue?: string
  icon?: ReactNode
  iconBg?: string
  sparkline?: number[]
  isLoading?: boolean
  onClick?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

function Sparkline({ data, color = 'var(--text-green)' }: { data: number[]; color?: string }) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80, h = 32

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  const areaPoints = `0,${h} ${points} ${w},${h}`

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="sparkline" aria-hidden>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="2.5"
        fill={color}
      />
    </svg>
  )
}

export function MetricCard({
  label, value, prefix, suffix, change, changePeriod = '30d',
  subvalue, icon, iconBg, sparkline, isLoading, onClick, className, size = 'md',
}: MetricCardProps) {
  const isPositive = (change ?? 0) > 0
  const isNegative = (change ?? 0) < 0
  const changeColor = getChangeColor(change ?? 0)

  const ChangeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  if (isLoading) {
    return (
      <div className={cn('card', className)} style={{ padding: size === 'sm' ? 16 : 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="shimmer" style={{ height: 12, width: '60%', borderRadius: 6 }} />
          <div className="shimmer" style={{ height: size === 'lg' ? 40 : 28, width: '80%', borderRadius: 6 }} />
          <div className="shimmer" style={{ height: 10, width: '40%', borderRadius: 6 }} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('card', onClick && 'cursor-pointer', className)}
      style={{ padding: size === 'sm' ? 16 : size === 'lg' ? 24 : 20 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <div style={{
              width: size === 'sm' ? 28 : 32,
              height: size === 'sm' ? 28 : 32,
              borderRadius: 8,
              background: iconBg ?? 'rgba(48,209,88,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <span style={{
            fontSize: size === 'sm' ? 12 : 13,
            color: 'var(--text-secondary)',
            letterSpacing: '-0.005em',
            fontWeight: 500,
          }}>
            {label}
          </span>
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={isNegative ? 'var(--text-red)' : 'var(--text-green)'} />
        )}
      </div>

      {/* Main value */}
      <div style={{ marginBottom: 8 }}>
        <span style={{
          fontSize: size === 'sm' ? 22 : size === 'lg' ? 40 : 28,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }} className="number-reveal metric-value">
          {prefix}
          {typeof value === 'number' ? value.toLocaleString('en-US') : value}
          {suffix}
        </span>
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {change !== undefined && (
          <span
            className={cn('badge', isPositive ? 'badge-green' : isNegative ? 'badge-red' : 'badge-gray')}
            style={{ fontSize: 11 }}
          >
            <ChangeIcon size={10} />
            {formatPercent(Math.abs(change), false)}
          </span>
        )}
        {changePeriod && change !== undefined && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{changePeriod}</span>
        )}
        {subvalue && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{subvalue}</span>
        )}
      </div>
    </div>
  )
}
