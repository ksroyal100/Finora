import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { extractBearerToken } from '@/lib/security/bearer'

const SRC = path.resolve(__dirname, '../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

describe('extractBearerToken', () => {
  it('extracts a normal token', () => expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi'))
  it('is case-insensitive on the scheme', () => expect(extractBearerToken('bearer tok')).toBe('tok'))
  it('trims surrounding whitespace', () => expect(extractBearerToken('  Bearer tok  ')).toBe('tok'))
  it.each([null, undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'Token abc', 'Bearer a b'])(
    'returns null for %j', (v) => expect(extractBearerToken(v as any)).toBeNull())
})

describe('mobile (Bearer) support in the backend', () => {
  it('middleware validates the Bearer token for API requests', () => {
    const m = read('middleware.ts')
    expect(m).toContain("extractBearerToken")
    expect(m).toMatch(/supabase\.auth\.getUser\(bearerToken\)/)
    // bearer handling must be limited to API routes
    expect(m).toMatch(/isApi\s*\?\s*extractBearerToken/)
  })

  it('account deletion accepts Bearer auth and rate-limits with a non-RLS client', () => {
    const t = read('app/api/account/delete/route.ts')
    expect(t).toContain('getUserFromRequest(req)')
    expect(t).not.toContain('createServerSupabaseClient')
    expect(t).toMatch(/await admin\s*\n?\s*\.from\('security_events'\)/)
  })

  it('getUserFromRequest is exported for routes that handle their own auth', () => {
    expect(read('lib/security/rbac.ts')).toMatch(/export async function getUserFromRequest/)
  })
})
