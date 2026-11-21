import { ReactNode } from 'react'

// ── EMPTY STATE ───────────────────────────────────────────────
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 32px', textAlign: 'center',
    }}>
      {icon && (
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(48,209,88,0.08)',
          border: '1px solid rgba(48,209,88,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, color: 'var(--green-400)',
        }}>
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)', margin: '0 0 6px' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px', maxWidth: 320 }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

// ── CARD SKELETON ─────────────────────────────────────────────
export function CardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div className="card" style={{ padding: 20, height }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="shimmer" style={{ height: 12, width: '50%', borderRadius: 6 }} />
        <div className="shimmer" style={{ height: 28, width: '70%', borderRadius: 6 }} />
        <div className="shimmer" style={{ height: 10, width: '40%', borderRadius: 6 }} />
      </div>
    </div>
  )
}

// ── LIST SKELETON ─────────────────────────────────────────────
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--separator)',
        }}>
          <div className="shimmer" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="shimmer" style={{ height: 12, width: `${40 + Math.random() * 30}%`, borderRadius: 4 }} />
            <div className="shimmer" style={{ height: 10, width: `${20 + Math.random() * 20}%`, borderRadius: 4 }} />
          </div>
          <div className="shimmer" style={{ height: 16, width: 60, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}

// ── INLINE LOADING ─────────────────────────────────────────────
export function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 4, height: 4, borderRadius: '50%',
            background: 'var(--green-400)',
            animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
