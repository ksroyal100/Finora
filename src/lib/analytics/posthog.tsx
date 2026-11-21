'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,    // handled manually per-page
      capture_pageleave: true,
      autocapture: false,         // manual tracking for precision
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: { password: true, email: true },
      },
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

// ── Server-side PostHog ────────────────────────────────────────

import { PostHog } from 'posthog-node'

let _posthogServer: PostHog | null = null

export function getServerPostHog(): PostHog {
  if (!_posthogServer) {
    _posthogServer = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      flushAt: 20,
      flushInterval: 10000,
    })
  }
  return _posthogServer
}

export async function trackServerEvent(params: {
  userId: string
  event: string
  properties?: Record<string, unknown>
}) {
  const ph = getServerPostHog()
  ph.capture({
    distinctId: params.userId,
    event: params.event,
    properties: {
      ...params.properties,
      $source: 'server',
    },
  })
}

export async function identifyUser(params: {
  userId: string
  email?: string
  name?: string
  plan?: string
  properties?: Record<string, unknown>
}) {
  const ph = getServerPostHog()
  ph.identify({
    distinctId: params.userId,
    properties: {
      email: params.email,
      name: params.name,
      plan: params.plan,
      ...params.properties,
    },
  })
}
