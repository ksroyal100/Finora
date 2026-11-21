import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getProducts } from '@/services/marketplace.service'

// GET /api/marketplace/search — full marketplace search
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''
  const category = url.searchParams.get('category') as any
  const minPrice = url.searchParams.get('min_price') ? parseFloat(url.searchParams.get('min_price')!) : undefined
  const maxPrice = url.searchParams.get('max_price') ? parseFloat(url.searchParams.get('max_price')!) : undefined
  const isFree = url.searchParams.get('is_free') === 'true' ? true : url.searchParams.get('is_free') === 'false' ? false : undefined
  const sortBy = url.searchParams.get('sort') as any ?? 'newest'
  const tags = url.searchParams.get('tags')?.split(',').filter(Boolean)
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const perPage = parseInt(url.searchParams.get('per_page') ?? '24')

  if (!q && !category && !tags?.length) {
    return NextResponse.json({ success: false, error: 'Provide search query, category, or tags' }, { status: 400 })
  }

  const db = createAdminClient()

  // Parallel: search results + facet counts
  const [results, { data: allProducts }] = await Promise.all([
    getProducts({ page, perPage, search: q || undefined, category, minPrice, maxPrice, isFree, sortBy, tags }),
    db.from('marketplace_products').select('category, price, tags').eq('status', 'published'),
  ])

  // Build facets
  const products = allProducts ?? []

  const categoryFacets = products.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const tagFacets = products
    .flatMap(p => p.tags as string[])
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

  const topTags = Object.entries(tagFacets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }))

  const priceRange = products.length > 0 ? {
    min: Math.min(...products.map(p => p.price)),
    max: Math.max(...products.map(p => p.price)),
    avg: products.reduce((s, p) => s + p.price, 0) / products.length,
  } : { min: 0, max: 0, avg: 0 }

  return NextResponse.json({
    success: true,
    query: q,
    ...results,
    facets: {
      categories: categoryFacets,
      top_tags: topTags,
      price_range: priceRange,
      free_count: products.filter(p => p.price === 0).length,
      paid_count: products.filter(p => p.price > 0).length,
    },
  })
}
