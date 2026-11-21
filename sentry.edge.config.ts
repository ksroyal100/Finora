// sentry.edge.config.ts
//
// Edge runtime error monitoring (middleware, edge routes). No-ops if
// SENTRY_DSN isn't set.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  })
}
