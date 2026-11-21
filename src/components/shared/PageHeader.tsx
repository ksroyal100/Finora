import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 28,
      gap: 16,
    }}>
      <div>
        {eyebrow && (
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--green-400)',
            marginBottom: 4,
          }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          margin: 0,
          lineHeight: 1.15,
        }}>
          {title}
        </h1>
        {description && (
          <p style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            margin: '6px 0 0',
            letterSpacing: '-0.005em',
            lineHeight: 1.5,
          }}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}
