// Extracts a bearer token from an Authorization header value.
// Pure and edge-runtime safe (used by middleware, which cannot import server-only code).
// Returns null for a missing/malformed header so callers fall back to the cookie session.
export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match ? match[1] : null
}
