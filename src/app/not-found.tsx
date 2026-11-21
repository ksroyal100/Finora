import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', color: 'var(--text-primary)', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--green-400)', marginBottom: 12 }}>
          404
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Page not found</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block', background: '#2FD968', color: '#000', textDecoration: 'none',
            borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14,
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
