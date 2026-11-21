// Test gateway standing in for Supabase's public URL in the notes end-to-end harness.
//   /auth/v1/user          -> accepts tokens "tok-u<N>" (user N), 401 otherwise (like GoTrue with a bad JWT)
//   /auth/v1/admin/*       -> 200 (not exercised by notes)
//   /rest/v1/*             -> proxied to a real PostgREST (PGRST_URL), as Supabase does
// Usage: PGRST_URL=http://127.0.0.1:3001 ANON_JWT=<jwt> node gateway.mjs   (listens on :54321)
import http from 'node:http'

const PGRST = new URL(process.env.PGRST_URL ?? 'http://127.0.0.1:3001')
const PORT = Number(process.env.PORT ?? 54321)
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }

http.createServer((req, res) => {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (req.url.startsWith('/auth/v1/user')) {
    const m = /^tok-u(\d+)$/.exec(bearer)
    if (!m) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' })
    return send(res, 200, { id: uid(m[1]), aud: 'authenticated', role: 'authenticated', email: `u${m[1]}@test.local`, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
  }
  if (req.url.startsWith('/auth/v1/')) return send(res, 200, {})
  if (req.url.startsWith('/rest/v1/')) {
    const headers = { ...req.headers, host: PGRST.host }
    // The build uses a placeholder anon key; give PostgREST a real anon JWT instead.
    if (bearer === 'anon-test-key' && process.env.ANON_JWT) headers.authorization = `Bearer ${process.env.ANON_JWT}`
    const up = http.request({ hostname: PGRST.hostname, port: PGRST.port, path: req.url.replace('/rest/v1', ''), method: req.method, headers },
      (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res) })
    up.on('error', () => send(res, 502, { message: 'postgrest unreachable' }))
    return req.pipe(up)
  }
  send(res, 404, {})
}).listen(PORT, '127.0.0.1', () => console.log(`gateway on ${PORT}`))
