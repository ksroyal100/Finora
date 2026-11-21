// instrumentation-client.ts
//
// Client-side error monitoring. Deliberately safe-by-default: if
// NEXT_PUBLIC_SENTRY_DSN isn't set (e.g. local dev, or before you've created
// a Sentry project), this simply does nothing — no errors, no network calls.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // Session replay is opt-in and off by default to control cost/privacy —
    // flip these to a small fraction (e.g. 0.05) once you've reviewed
    // Sentry's data-scrubbing settings for a financial app.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}

export const onRouterTransitionStart = dsn ? Sentry.captureRouterTransitionStart : undefined
