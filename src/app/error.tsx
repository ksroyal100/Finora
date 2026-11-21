'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { digest: error.digest } })
  }, [error])

  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          We've been notified and are looking into it.
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: '#2FD968', color: '#000', border: 'none', borderRadius: 10,
            padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
