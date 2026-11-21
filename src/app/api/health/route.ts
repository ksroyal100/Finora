import { NextResponse } from 'next/server'

// Liveness probe for uptime monitors (UptimeRobot, BetterStack, Vercel checks).
// Deliberately does NOT touch the database or any secret, and returns nothing sensitive.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
