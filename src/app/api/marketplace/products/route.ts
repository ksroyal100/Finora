import { NextRequest } from 'next/server'
import { withAuth, requirePlan, apiSuccess, apiError } from '@/lib/security/rbac'
import { getProducts, createProduct } from '@/services/marketplace.service'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  short_description: z.string().max(500).optional(),
  category: z.enum(['investing', 'real_estate', 'startups', 'ai', 'software', 'business', 'templates', 'courses', 'research_reports', 'ai_prompt_packs', 'services', 'jobs', 'deals', 'acquisitions']),
  subcategory: z.string().max(100).optional(),
  price: z.number().min(0),
  compare_price: z.number().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  tags: z.array(z.string()).max(15).default([]),
  features: z.array(z.string()).max(20).default([]),
  thumbnail_url: z.string().url().optional(),
  media_urls: z.array(z.string().url()).max(10).default([]),
  is_digital: z.boolean().default(true),
  license_type: z.string().default('standard'),
})

// GET /api/marketplace/products
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url)
  const products = await getProducts({
    page: parseInt(url.searchParams.get('page') ?? '1'),
    perPage: parseInt(url.searchParams.get('per_page') ?? '20'),
    category: url.searchParams.get('category') as any ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    minPrice: url.searchParams.get('min_price') ? parseFloat(url.searchParams.get('min_price')!) : undefined,
    maxPrice: url.searchParams.get('max_price') ? parseFloat(url.searchParams.get('max_price')!) : undefined,
    isFree: url.searchParams.get('is_free') === 'true' ? true : url.searchParams.get('is_free') === 'false' ? false : undefined,
    sortBy: (url.searchParams.get('sort') as any) ?? 'newest',
    tags: url.searchParams.get('tags')?.split(',').filter(Boolean),
    creatorId: url.searchParams.get('creator_id') ?? undefined,
  })

  return apiSuccess(products)
}

// POST /api/marketplace/products
export const POST = requirePlan('plus', async (req, { userId }) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation failed', 400)

  const product = await createProduct({ creatorId: userId, data: parsed.data })
  return apiSuccess(product, 201)
})
