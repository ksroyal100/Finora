// ============================================================
// FINORA — Voice System (TTS/STT Abstraction Layer)
// ============================================================

import type { AgentName, VoiceConfig } from '@/types'

// ── AGENT VOICE CONFIGS ───────────────────────────────────────

export const AGENT_VOICES: Record<AgentName, VoiceConfig> = {
  jarvis:   { provider: 'edge_tts', voice: 'en-US-GuyNeural',     rate: '+0%', pitch: '+0Hz' },
  athena:   { provider: 'edge_tts', voice: 'en-US-AriaNeural',    rate: '+0%', pitch: '+0Hz' },
  orion:    { provider: 'edge_tts', voice: 'en-GB-RyanNeural',    rate: '+0%', pitch: '+0Hz' },
  titan:    { provider: 'edge_tts', voice: 'en-AU-WilliamNeural', rate: '+0%', pitch: '+0Hz' },
  phoenix:  { provider: 'edge_tts', voice: 'en-US-JennyNeural',   rate: '+5%', pitch: '+2Hz' },
  merlin:   { provider: 'edge_tts', voice: 'en-GB-LibbyNeural',   rate: '-5%', pitch: '+0Hz' },
  sentinel: { provider: 'edge_tts', voice: 'en-US-DavisNeural',   rate: '-10%', pitch: '-2Hz' },
}

// ── TTS PROVIDER ABSTRACTION ──────────────────────────────────

export interface TTSOptions {
  voice: string
  rate?: string
  pitch?: string
  volume?: string
}

export interface TTSResult {
  audioBuffer: Buffer | null
  audioUrl: string | null
  duration?: number
  provider: string
}

// Edge TTS (Microsoft - free via edge-tts package)
export async function synthesizeWithEdgeTTS(
  text: string,
  options: TTSOptions
): Promise<TTSResult> {
  // In production: call edge-tts CLI or use @andresaya/edge-tts package
  // For now, return structured response for frontend to handle via Web Speech API
  return {
    audioBuffer: null,
    audioUrl: null,
    duration: Math.ceil(text.length / 20), // rough estimate
    provider: 'edge_tts',
  }
}

// Kokoro (local, high-quality open-source TTS)
export async function synthesizeWithKokoro(
  text: string,
  options: TTSOptions
): Promise<TTSResult> {
  try {
    const response = await fetch(`${process.env.KOKORO_URL ?? 'http://localhost:8880'}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice: options.voice,
        speed: parseFloat(options.rate?.replace('%', '') ?? '0') / 100 + 1,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) throw new Error(`Kokoro TTS failed: ${response.statusText}`)

    const buffer = Buffer.from(await response.arrayBuffer())
    return { audioBuffer: buffer, audioUrl: null, provider: 'kokoro' }
  } catch {
    // Fallback to edge_tts
    return synthesizeWithEdgeTTS(text, options)
  }
}

// Piper (ultra-fast local TTS)
export async function synthesizeWithPiper(
  text: string,
  options: TTSOptions
): Promise<TTSResult> {
  try {
    const response = await fetch(`${process.env.PIPER_URL ?? 'http://localhost:5000'}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: options.voice }),
    })

    if (!response.ok) throw new Error('Piper TTS failed')

    const buffer = Buffer.from(await response.arrayBuffer())
    return { audioBuffer: buffer, audioUrl: null, provider: 'piper' }
  } catch {
    return synthesizeWithEdgeTTS(text, options)
  }
}

// ── MAIN SYNTHESIZE FUNCTION ──────────────────────────────────

export async function synthesizeAgentVoice(
  agentName: AgentName,
  text: string,
  preferredProvider?: string
): Promise<TTSResult> {
  const config = AGENT_VOICES[agentName]
  const provider = preferredProvider ?? config.provider

  const options: TTSOptions = {
    voice: config.voice,
    rate: config.rate,
    pitch: config.pitch,
  }

  switch (provider) {
    case 'kokoro':
      return synthesizeWithKokoro(text, options)
    case 'piper':
      return synthesizeWithPiper(text, options)
    case 'edge_tts':
    default:
      return synthesizeWithEdgeTTS(text, options)
  }
}

// ── STT (Speech to Text) ──────────────────────────────────────

export interface STTResult {
  text: string
  confidence?: number
  language?: string
  provider: string
}

// Whisper via Groq (fast, accurate)
export async function transcribeWithGroq(
  audioBlob: Buffer,
  language = 'en'
): Promise<STTResult> {
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(audioBlob)], { type: 'audio/webm' }), 'audio.webm')
  formData.append('model', 'whisper-large-v3')
  formData.append('language', language)
  formData.append('response_format', 'json')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Whisper transcription failed: ${response.statusText}`)
  }

  const data = await response.json() as { text: string }
  return { text: data.text, provider: 'groq_whisper' }
}

// Faster Whisper (local)
export async function transcribeWithFasterWhisper(
  audioBlob: Buffer
): Promise<STTResult> {
  try {
    const formData = new FormData()
    formData.append('audio', new Blob([new Uint8Array(audioBlob)]), 'audio.webm')

    const response = await fetch(
      `${process.env.FASTER_WHISPER_URL ?? 'http://localhost:9000'}/transcribe`,
      { method: 'POST', body: formData }
    )

    if (!response.ok) throw new Error('Faster Whisper failed')

    const data = await response.json() as { text: string; confidence: number }
    return { text: data.text, confidence: data.confidence, provider: 'faster_whisper' }
  } catch {
    // Fallback to Groq Whisper
    return transcribeWithGroq(audioBlob)
  }
}

// ── VOICE SESSION MANAGER ─────────────────────────────────────

export class VoiceSessionManager {
  async createSession(adminId: string, agentName: AgentName, conversationId?: string) {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const db = createAdminClient()

    const { data } = await db.from('voice_sessions').insert({
      admin_id: adminId,
      agent_name: agentName,
      conversation_id: conversationId ?? null,
      provider: AGENT_VOICES[agentName].provider,
    }).select().single()

    return data
  }

  async endSession(sessionId: string, durationSeconds: number) {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const db = createAdminClient()

    await db.from('voice_sessions').update({
      status: 'ended',
      duration_seconds: durationSeconds,
      ended_at: new Date().toISOString(),
    }).eq('id', sessionId)
  }

  async saveTranscript(sessionId: string, role: 'user' | 'agent', content: string, audioUrl?: string) {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const db = createAdminClient()

    await db.from('voice_transcripts').insert({
      session_id: sessionId,
      role,
      content,
      audio_url: audioUrl ?? null,
    })
  }
}

export const voiceSessionManager = new VoiceSessionManager()
