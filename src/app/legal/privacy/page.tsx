import { PublicPageShell } from '@/components/shared/PublicPageShell'
import { getLegalDocument, formatLegalDate } from '@/lib/legal/get-document'
import { notFound } from 'next/navigation'

export const revalidate = 300 // re-check the DB every 5 minutes; admin edits show up quickly without a full redeploy

export async function generateMetadata() {
  const doc = await getLegalDocument('privacy')
  return { title: doc?.title ?? 'privacy' }
}

export default async function Page() {
  const doc = await getLegalDocument('privacy')
  if (!doc) notFound()

  return (
    <PublicPageShell title={doc.title} updated={formatLegalDate(doc.published_at)}>
      <div dangerouslySetInnerHTML={{ __html: doc.content }} />
    </PublicPageShell>
  )
}
