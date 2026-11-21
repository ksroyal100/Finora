import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { NOTE_COLORS, NOTE_LIMITS } from '@/lib/notes/types'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const notesFiles = [...walk('src/lib/notes'), ...walk('src/components/notes')]

describe('notes: security wiring', () => {
  const route = code('src/app/api/notes/sync/route.ts')
  const sql = read('supabase/migrations/018_notes.sql')

  it('the sync route authenticates with withAuth and takes the user id ONLY from the credentials', () => {
    expect(route).toMatch(/withAuth\(/)
    expect(route).toMatch(/\{ userId \}/)
    expect(route).not.toMatch(/user_id|userId\s*:\s*(parsed|body|json)/)       // never read from the request
    expect(route).toMatch(/p_user: userId/)
  })

  it('the sync route has its own rate-limit bucket so it cannot starve the shared API limit', () => {
    expect(route).toMatch(/rateLimit:\s*\{\s*key:\s*'notes-sync'/)
  })

  it('the SQL functions are not executable by browsers (anon/authenticated), only by the service role', () => {
    for (const fn of ['notes_apply_mutation(uuid, jsonb)', 'notes_apply_batch(uuid, jsonb)', 'notes_pull(uuid, timestamptz, uuid, int)']) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION ${fn}`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${fn}`)
    }
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION notes_apply_mutation[^;]*anon, authenticated/)
  })

  it('RLS is on, reads are owner-only, and browsers get NO write policies', () => {
    expect(sql).toMatch(/ALTER TABLE notes\s+ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/ALTER TABLE note_mutations ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/CREATE POLICY "notes_select_own" ON notes FOR SELECT USING \(auth\.uid\(\) = user_id\)/)
    expect(sql).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(sql).toMatch(/REVOKE ALL ON notes\s+FROM anon, authenticated/)
  })

  it('notes are tied to the user with a cascading FK and ownership can never change', () => {
    expect(sql).toMatch(/user_id\s+uuid\s+NOT NULL REFERENCES profiles\(id\) ON DELETE CASCADE/)
    expect(sql).toContain('notes.user_id is immutable')
  })

  it('client limits and colours match the database constraints', () => {
    expect(sql).toContain(`char_length(title)   <= ${NOTE_LIMITS.title}`)
    expect(sql).toContain(`char_length(content) <= ${NOTE_LIMITS.content}`)
    expect(sql).toContain(`cardinality(labels) <= ${NOTE_LIMITS.labels}`)
    expect(sql).toContain(`BETWEEN 1 AND ${NOTE_LIMITS.label}`)
    const m = /color IN \(([^)]*)\)/.exec(sql.replace(/\s+/g, ' '))!
    expect(m[1].split(',').map((x) => x.trim().replace(/'/g, ''))).toEqual([...NOTE_COLORS])
  })
})

describe('notes: client wiring', () => {
  it('the local database is per user (another account on the same browser cannot read it)', () => {
    expect(code('src/lib/notes/db.ts')).toMatch(/dbNameFor = \(userId: string\) => `finora-notes:\$\{userId\}`/)
  })

  it('note data lives in IndexedDB only: no localStorage/sessionStorage, no innerHTML', () => {
    for (const f of notesFiles) {
      const c = code(f)
      expect(c, f).not.toMatch(/localStorage|sessionStorage/)
      expect(c, f).not.toMatch(/dangerouslySetInnerHTML|innerHTML/)
    }
  })

  it('the only network access is the sync transport', () => {
    const offenders = notesFiles.filter((f) => /\bfetch\(|XMLHttpRequest|axios/.test(code(f))).filter((f) => f !== 'src/lib/notes/sync.ts')
    expect(offenders).toEqual([])
  })

  it('the notes page never loads note content on the server (it is read from IndexedDB, so it works offline)', () => {
    const page = code('src/app/(app)/notes/page.tsx')
    expect(page).not.toMatch(/\.from\(['"]notes['"]\)|notes_pull|rpc\(/)
    expect(page).toContain('userId={user.id}')
  })

  it('middleware protects the page and the API', () => {
    const m = read('src/middleware.ts')
    expect(m).toMatch(/PROTECTED_PAGE_PATHS = \[[^\]]*'\/notes'/s)
    expect(m).toMatch(/PROTECTED_API_PATHS = \[[^\]]*'\/api\/notes'/s)
  })

  it('the sidebar links to Notes', () => expect(read('src/components/layout/Sidebar.tsx')).toContain("href: '/notes'"))

  it('sign-out syncs then clears local notes; account deletion wipes them', () => {
    expect(read('src/app/(app)/settings/page.tsx')).toContain('prepareNotesForSignOut')
    expect(read('src/components/settings/DeleteAccountModal.tsx')).toContain('wipeNotesLocalData')
  })
})

describe('notes: offline service worker', () => {
  const sw = code('public/finora-notes-sw.js') // code only: the header comment legitimately mentions /api
  it('only ever handles the /notes page load and immutable build assets; the API is never touched', () => {
    const handled = [...sw.matchAll(/url\.pathname(?:\s*===\s*|\.startsWith\()'([^']+)'/g)].map((m) => m[1]).sort()
    expect(handled).toEqual(['/_next/static/', '/notes'])
    expect(sw).toMatch(/if \(req\.method !== 'GET'\) return/)
    expect(sw).toMatch(/if \(url\.origin !== self\.location\.origin\) return/)
    expect(sw).not.toMatch(/\/api/)
  })
  it('its cache names match what sign-out deletes', () => {
    const prefix = /OFFLINE_CACHE_PREFIX = '([^']+)'/.exec(read('src/lib/notes/session.ts'))![1]
    for (const m of sw.matchAll(/'(finora-notes-[a-z]+-)' \+ VERSION/g)) expect(m[1].startsWith(prefix)).toBe(true)
  })
  it('is not served through an auth-gated path (the middleware matches by prefix)', () => {
    expect('/finora-notes-sw.js'.startsWith('/notes')).toBe(false)
  })
})
