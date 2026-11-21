import crypto from 'crypto'

const SECRET = process.env.UNSUBSCRIBE_SECRET ?? 'insecure-default-change-me'

export type UnsubscribeKind = 'user' | 'subscriber'

export function signUnsubscribeToken(identifier: string): string {
  return crypto.createHmac('sha256', SECRET).update(identifier).digest('hex').slice(0, 32)
}

export function verifyUnsubscribeToken(identifier: string, token: string): boolean {
  const expected = signUnsubscribeToken(identifier)
  // Constant-time comparison to avoid leaking the valid token via timing.
  if (expected.length !== token.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
}

// kind='user' → identifier is a profiles.id (registered, opted-in user)
// kind='subscriber' → identifier is a newsletter_subscribers.id (anonymous,
// landing-page-captured email with no account)
export function buildUnsubscribeUrl(identifier: string, kind: UnsubscribeKind = 'user'): string {
  const token = signUnsubscribeToken(identifier)
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://finora.app'
  return `${base}/api/newsletter/unsubscribe?uid=${identifier}&token=${token}&kind=${kind}`
}
