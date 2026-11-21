'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { digest: error.digest } })
  }, [error])

  return (
    <html>
      <body style={{
        margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#8E8E93', marginBottom: 20, lineHeight: 1.5 }}>
            We've been notified and are looking into it. You can try again, or head back to the dashboard.
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
      </body>
    </html>
  )
}
