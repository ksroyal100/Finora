import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError } from '@/lib/security/rbac'
import { synthesizeAgentVoice, transcribeWithGroq, voiceSessionManager } from '@/lib/voice/voice'
import { z } from 'zod'

const ttsSchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  text: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  provider: z.enum(['edge_tts', 'piper', 'kokoro']).optional(),
})

const sttSchema = z.object({
  agent_name: z.enum(['jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel']),
  session_id: z.string().uuid().optional(),
  language: z.string().default('en'),
})

// POST /api/admin/cc/agents/voice/tts — Text to Speech
export async function POST(req: NextRequest) {
  return withAdmin(async (request, { userId }) => {
    const contentType = req.headers.get('content-type') ?? ''

    // Handle audio upload for STT
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const audioFile = formData.get('audio') as File | null
      const agentName = formData.get('agent_name') as string
      const sessionId = formData.get('session_id') as string | null
      const language = (formData.get('language') as string) ?? 'en'

      if (!audioFile) return apiError('Audio file required', 400)
      if (!agentName) return apiError('agent_name required', 400)

      const buffer = Buffer.from(await audioFile.arrayBuffer())
      const sttResult = await transcribeWithGroq(buffer, language)

      // Save transcript
      if (sessionId) {
        await voiceSessionManager.saveTranscript(sessionId, 'user', sttResult.text)
      }

      return apiSuccess({
        text: sttResult.text,
        confidence: sttResult.confidence,
        provider: sttResult.provider,
      })
    }

    // Handle JSON for TTS
    const body = await req.json()
    const { action } = body

    if (action === 'tts') {
      const parsed = ttsSchema.safeParse(body)
      if (!parsed.success) return apiError('Validation failed', 400)

      const result = await synthesizeAgentVoice(
        parsed.data.agent_name,
        parsed.data.text,
        parsed.data.provider
      )

      // Save transcript
      if (parsed.data.session_id) {
        await voiceSessionManager.saveTranscript(
          parsed.data.session_id, 'agent', parsed.data.text
        )
      }

      // If we have audio buffer, return as binary
      if (result.audioBuffer) {
        return new NextResponse(new Uint8Array(result.audioBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': result.audioBuffer.length.toString(),
            'X-Provider': result.provider,
            'X-Duration': String(result.duration ?? 0),
          },
        })
      }

      // Otherwise return metadata for client-side TTS (Web Speech API)
      const db = createAdminClient()
      const { data: agent } = await db.from('agents').select('voice_config').eq('name', parsed.data.agent_name).single()

      return apiSuccess({
        provider: result.provider,
        voice_config: agent?.voice_config ?? {},
        text: parsed.data.text,
        use_client_tts: true,
        duration_estimate: result.duration,
      })
    }

    if (action === 'start_session') {
      const { agent_name, conversation_id } = body
      if (!agent_name) return apiError('agent_name required', 400)
      const session = await voiceSessionManager.createSession(userId, agent_name, conversation_id)
      return apiSuccess({ session })
    }

    if (action === 'end_session') {
      const { session_id, duration_seconds } = body
      if (!session_id) return apiError('session_id required', 400)
      await voiceSessionManager.endSession(session_id, duration_seconds ?? 0)
      return apiSuccess({ ended: true })
    }

    if (action === 'get_voices') {
      // Return all agent voice configurations
      const db = createAdminClient()
      const { data: agents } = await db.from('agents').select('name, display_name, voice_config').eq('is_active', true)
      return apiSuccess(agents ?? [])
    }

    return apiError('action must be tts, start_session, end_session, or get_voices', 400)
  })(req)
}

// GET /api/admin/cc/agents/voice — voice session history
export const GET = withAdmin(async (req, { userId }) => {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id')
  const db = createAdminClient()

  if (sessionId) {
    const [{ data: session }, { data: transcripts }] = await Promise.all([
      db.from('voice_sessions').select('*').eq('id', sessionId).eq('admin_id', userId).single(),
      db.from('voice_transcripts').select('*').eq('session_id', sessionId).order('created_at'),
    ])
    return apiSuccess({ session, transcripts: transcripts ?? [] })
  }

  const { data: sessions, error } = await db
    .from('voice_sessions')
    .select('*')
    .eq('admin_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return apiError(error.message, 500)
  return apiSuccess(sessions ?? [])
})
