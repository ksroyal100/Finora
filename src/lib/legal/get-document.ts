import { createAdminClient } from '@/lib/supabase/server'

export interface LegalDocument {
  slug: string
  title: string
  content: string
  published_at: string
}

export async function getLegalDocument(slug: string): Promise<LegalDocument | null> {
  try {
    const db = createAdminClient()
    const { data, error } = await db.from('legal_documents').select('slug, title, content, published_at').eq('slug', slug).single()
    if (error || !data) return null
    return data as LegalDocument
  } catch {
    return null
  }
}

export function formatLegalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
