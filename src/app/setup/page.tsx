export default function SetupPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.25)', borderRadius: 12, padding: '8px 14px', marginBottom: 20 }}>
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span style={{ fontSize: 13, color: 'var(--text-orange)', fontWeight: 600 }}>Setup Required</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', margin: '0 0 10px' }}>
            Configure your environment
          </h1>
          <p style={{ fontSize: 15, color: '#8E8E93', lineHeight: 1.6, margin: 0 }}>
            Finora needs your Supabase credentials to run. Create a{' '}
            <code style={{ background: '#1c1c1e', padding: '2px 7px', borderRadius: 5, fontSize: 13, color: 'var(--text-green)' }}>.env.local</code>{' '}
            file in the project root (copy <strong style={{ color: '#fff' }}>.env.example</strong> to get started).
          </p>
        </div>

        {/* Step 1 */}
        <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green-400)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>1</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Get your Supabase credentials</span>
          </div>
          <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 12, lineHeight: 1.6 }}>
            Go to your Supabase project dashboard → <strong style={{ color: '#fff' }}>Settings → API</strong>
          </p>
          <a href="https://supabase.com/dashboard/project/_/settings/api" target="_blank" rel="noopener"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.2)', borderRadius: 10, color: 'var(--text-green)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
            🔗 Open Supabase Dashboard
          </a>
        </div>

        {/* Step 2 — .env.local template */}
        <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--text-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>2</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Create <code style={{ fontSize: 13, color: 'var(--text-green)', background: '#111', padding: '1px 6px', borderRadius: 4 }}>.env.local</code></span>
          </div>
          <pre style={{ background: '#111', border: '1px solid #2c2c2e', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.8, color: '#e5e5ea', overflowX: 'auto', margin: 0 }}>
{`# ── Supabase (REQUIRED) ─────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# ── This app's URL ───────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000

# See .env.example for the full list (Stripe, Groq, Resend, etc.)`}
          </pre>
        </div>

        {/* Step 3 */}
        <div style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#BF5AF2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>3</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Restart the dev server</span>
          </div>
          <pre style={{ background: '#111', border: '1px solid #2c2c2e', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.8, color: 'var(--text-green)', margin: 0 }}>
{`# Stop the server (Ctrl + C), then restart:
npm run dev`}
          </pre>
        </div>

        {/* Common mistakes */}
        <div style={{ background: 'rgba(255,69,58,0.05)', border: '1px solid rgba(255,69,58,0.15)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-red)', marginBottom: 12 }}>⚠️ Common mistakes</div>
          {[
            ['.env instead of .env.local', 'Next.js only reads .env.local in development. Rename it.'],
            ['Forgot to restart the server', 'Env var changes require a full server restart — Ctrl+C then npm run dev.'],
            ['Extra quotes around values', 'Write: NEXT_PUBLIC_SUPABASE_URL=https://... (no quotes)'],
            ['.env.local in wrong folder', 'The file must be in the project root, next to package.json.'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--text-red)', fontSize: 14, flexShrink: 0 }}>✗</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#8E8E93' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#3a3a3c', marginTop: 24 }}>
          After restarting, this page will automatically redirect to the app.
        </p>
      </div>
    </div>
  )
}
