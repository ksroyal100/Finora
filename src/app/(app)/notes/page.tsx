import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NotesApp } from '@/components/notes/NotesApp'

export const metadata = { title: 'Notes' }
export const dynamic = 'force-dynamic'

// The page itself only needs the user's id (to open the right local database). Note CONTENT never comes from
// the server render: it is read from IndexedDB in the browser, so it appears instantly and works offline.
export default async function NotesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')
  return <NotesApp userId={user.id} />
}
