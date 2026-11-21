// ============================================================
// FINORA — Qdrant Vector Memory (Agent Long-Term Memory)
// ============================================================

import { QdrantClient } from '@qdrant/js-client-rest'
import { createAdminClient } from '@/lib/supabase/server'
import { createChatCompletion, MODELS } from '@/lib/ai/groq'
import type { AgentName } from '@/types'

// ── CLIENT ────────────────────────────────────────────────────

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
})

// ── COLLECTION NAMES ──────────────────────────────────────────

const COLLECTIONS = {
  jarvis: 'jarvis_memory',
  athena: 'athena_memory',
  orion: 'orion_memory',
  titan: 'titan_memory',
  phoenix: 'phoenix_memory',
  merlin: 'merlin_memory',
  sentinel: 'sentinel_memory',
  wealthcoach: 'wealth_coach_memory',
  knowledge: 'platform_knowledge',
} as const

const VECTOR_SIZE = 1536 // For text-embedding-3-small or similar
const GROQ_EMBED_DIM = 768 // Groq's embedding dimension (approximation)

// ── INIT COLLECTIONS ──────────────────────────────────────────

export async function initializeCollections() {
  for (const [, collectionName] of Object.entries(COLLECTIONS)) {
    try {
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: GROQ_EMBED_DIM,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      })
      console.log(`[Qdrant] Created collection: ${collectionName}`)
    } catch {
      // Collection may already exist
    }
  }
}

// ── EMBEDDING (using Groq's text representation) ──────────────
// Note: In production, replace with a dedicated embedding API

async function generateEmbedding(text: string): Promise<number[]> {
  // Groq doesn't provide embeddings directly — we use a hash-based approach
  // for dev and replace with OpenAI/Cohere embeddings at scale
  
  // Simple deterministic embedding for development
  // In production: use OpenAI text-embedding-3-small or Cohere
  const normalized = text.toLowerCase().trim()
  const buffer = new TextEncoder().encode(normalized)
  const hash: number[] = []
  
  for (let i = 0; i < GROQ_EMBED_DIM; i++) {
    let val = 0
    for (let j = 0; j < buffer.length; j++) {
      val += (buffer[j] * (i + 1) * (j + 1)) % 256
    }
    hash.push((val % 200 - 100) / 100)
  }
  
  // Normalize
  const magnitude = Math.sqrt(hash.reduce((sum, v) => sum + v * v, 0))
  return hash.map(v => magnitude > 0 ? v / magnitude : 0)
}

// ── MEMORY STORE ──────────────────────────────────────────────

export interface MemoryEntry {
  id?: string
  content: string
  contentType: string
  tags?: string[]
  importanceScore?: number
  sourceType?: string
  sourceId?: string
  metadata?: Record<string, unknown>
}

export async function storeAgentMemory(
  agentName: AgentName,
  entry: MemoryEntry
): Promise<string> {
  const collection = COLLECTIONS[agentName]
  const vectorId = crypto.randomUUID()
  const embedding = await generateEmbedding(entry.content)

  await qdrant.upsert(collection, {
    points: [{
      id: vectorId,
      vector: embedding,
      payload: {
        content: entry.content,
        content_type: entry.contentType,
        tags: entry.tags ?? [],
        importance_score: entry.importanceScore ?? 0.5,
        source_type: entry.sourceType,
        source_id: entry.sourceId,
        agent_name: agentName,
        metadata: entry.metadata ?? {},
        created_at: new Date().toISOString(),
      },
    }],
  })

  // Index in Supabase for structured queries
  const db = createAdminClient()
  await db.from('agent_memory_index').insert({
    agent_name: agentName,
    vector_id: vectorId,
    content_summary: entry.content.slice(0, 500),
    content_type: entry.contentType,
    tags: entry.tags ?? [],
    importance_score: entry.importanceScore ?? 0.5,
    source_type: entry.sourceType,
    source_id: entry.sourceId,
    metadata: entry.metadata ?? {},
  })

  return vectorId
}

// ── MEMORY SEARCH ─────────────────────────────────────────────

export interface MemorySearchResult {
  id: string
  content: string
  contentType: string
  score: number
  tags: string[]
  importanceScore: number
  createdAt: string
}

export async function searchAgentMemory(
  agentName: AgentName,
  query: string,
  options: {
    limit?: number
    minScore?: number
    contentType?: string
    tags?: string[]
  } = {}
): Promise<MemorySearchResult[]> {
  const collection = COLLECTIONS[agentName]
  const { limit = 10, minScore = 0.7, contentType, tags } = options

  const queryVector = await generateEmbedding(query)

  const filter: Record<string, unknown> = {}
  if (contentType) {
    filter.must = [{ key: 'content_type', match: { value: contentType } }]
  }
  if (tags && tags.length > 0) {
    filter.should = tags.map(tag => ({
      key: 'tags',
      match: { value: tag },
    }))
  }

  const { points: results } = await qdrant.query(collection, {
    query: queryVector,
    limit,
    score_threshold: minScore,
    with_payload: true,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  })

  // Update access counts
  const db = createAdminClient()
  const vectorIds = results.map((r) => r.id as string)
  if (vectorIds.length > 0) {
    await db
      .from('agent_memory_index')
      .update({
        access_count: db.rpc('increment', { x: 1 }),
        last_accessed_at: new Date().toISOString(),
      })
      .in('vector_id', vectorIds)
  }

  return results.map((r) => ({
    id: r.id as string,
    content: r.payload?.content as string ?? '',
    contentType: r.payload?.content_type as string ?? '',
    score: r.score,
    tags: r.payload?.tags as string[] ?? [],
    importanceScore: r.payload?.importance_score as number ?? 0,
    createdAt: r.payload?.created_at as string ?? '',
  }))
}

// ── CONTEXTUAL MEMORY RETRIEVAL ───────────────────────────────

export async function getAgentContextMemory(
  agentName: AgentName,
  query: string,
  maxTokens = 2000
): Promise<string> {
  const memories = await searchAgentMemory(agentName, query, {
    limit: 15,
    minScore: 0.6,
  })

  if (memories.length === 0) return ''

  let contextStr = '## Relevant Memory:\n'
  let tokenCount = 0

  for (const memory of memories) {
    const snippet = `[${memory.contentType}] ${memory.content}\n`
    const snippetTokens = Math.ceil(snippet.length / 4) // rough estimate
    if (tokenCount + snippetTokens > maxTokens) break
    contextStr += snippet
    tokenCount += snippetTokens
  }

  return contextStr
}

// ── SUMMARIZE & COMPRESS MEMORIES ────────────────────────────

export async function summarizeConversationToMemory(
  agentName: AgentName,
  conversationId: string
): Promise<void> {
  const db = createAdminClient()

  const { data: messages } = await db
    .from('agent_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at')

  if (!messages || messages.length < 4) return

  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')

  const summaryResult = await createChatCompletion(
    [{
      role: 'user',
      content: `Summarize this conversation, extracting key facts, decisions, and context that ${agentName} should remember:\n\n${conversationText}\n\nReturn a concise but comprehensive summary.`,
    }],
    { model: MODELS.LLAMA_8B, temperature: 0.3, maxTokens: 512 }
  )

  await storeAgentMemory(agentName, {
    content: summaryResult.content,
    contentType: 'conversation_summary',
    tags: ['conversation', 'summary'],
    importanceScore: 0.6,
    sourceType: 'conversation',
    sourceId: conversationId,
  })
}

// ── PLATFORM KNOWLEDGE BASE ───────────────────────────────────

export async function indexPlatformKnowledge(entry: {
  category: string
  title: string
  content: string
  tags?: string[]
}) {
  const embedding = await generateEmbedding(entry.content)
  const id = crypto.randomUUID()

  await qdrant.upsert(COLLECTIONS.knowledge, {
    points: [{
      id,
      vector: embedding,
      payload: {
        ...entry,
        created_at: new Date().toISOString(),
      },
    }],
  })

  return id
}

export async function searchPlatformKnowledge(
  query: string,
  limit = 5
) {
  const queryVector = await generateEmbedding(query)

  const { points: results } = await qdrant.query(COLLECTIONS.knowledge, {
    query: queryVector,
    limit,
    score_threshold: 0.6,
    with_payload: true,
  })

  return results.map((r) => ({
    id: r.id as string,
    category: r.payload?.category as string ?? '',
    title: r.payload?.title as string ?? '',
    content: r.payload?.content as string ?? '',
    score: r.score,
  }))
}
