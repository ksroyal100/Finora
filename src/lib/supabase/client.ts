import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      '[Finora] Missing Supabase credentials.\n' +
      'Create .env.local (copy .env.example) with:\n' +
      '  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co\n' +
      '  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key\n' +
      'Then restart the dev server.'
    )
  }

  return createBrowserClient(url, key)
}
