// ============================================================
// FINORA — AI Client (Groq primary + OpenAI-compatible layer)
// ============================================================

import Groq from 'groq-sdk'

// ── CLIENT INIT ───────────────────────────────────────────────

// Created on first use, NOT at import time: a missing key must not break the production
// build or unrelated pages. Only AI features fail, with a clear message.
let _groq: Groq | null = null
function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY is not set. AI features are disabled until you add it.')
    _groq = new Groq({ apiKey })
  }
  return _groq
}

// ── MODELS ───────────────────────────────────────────────────

export const MODELS = {
  // Fast, cost-efficient — Groq's recommended replacement for the
  // deprecated llama-3.1-8b-instant (shut down Aug 16, 2026).
  LLAMA_8B: 'openai/gpt-oss-20b',
  // Stronger reasoning — Groq's recommended replacement for the
  // deprecated llama-3.3-70b-versatile (shut down Aug 16, 2026).
  LLAMA_70B: 'openai/gpt-oss-120b',
  // mixtral-8x7b-32768 and gemma2-9b-it are also deprecated on Groq;
  // both keys now point at supported models so any code still
  // referencing them by name keeps working.
  MIXTRAL: 'openai/gpt-oss-120b',
  GEMMA2: 'openai/gpt-oss-20b',
  // Agent default
  AGENT_DEFAULT: 'openai/gpt-oss-120b',
  // User AI Coach
  COACH_DEFAULT: 'openai/gpt-oss-20b',
} as const

export type ModelName = (typeof MODELS)[keyof typeof MODELS]

// ── CHAT COMPLETION ───────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model?: ModelName
  temperature?: number
  maxTokens?: number
  stream?: boolean
  responseFormat?: 'json' | 'text'
  systemPrompt?: string
}

export interface CompletionResult {
  content: string
  tokensUsed: number
  model: string
  finishReason: string
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const {
    model = MODELS.LLAMA_8B,
    temperature = 0.7,
    maxTokens = 1024,
    responseFormat = 'text',
    systemPrompt,
  } = options

  const systemMessages: ChatMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }]
    : []

  const response = await getGroq().chat.completions.create({
    model,
    messages: [...systemMessages, ...messages],
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
  })

  const choice = response.choices[0]
  return {
    content: choice.message.content ?? '',
    tokensUsed: response.usage?.total_tokens ?? 0,
    model: response.model,
    finishReason: choice.finish_reason ?? 'stop',
  }
}

// ── STREAMING COMPLETION ──────────────────────────────────────

export async function createStreamingCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
) {
  const {
    model = MODELS.LLAMA_8B,
    temperature = 0.7,
    maxTokens = 1024,
    systemPrompt,
  } = options

  const systemMessages: ChatMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }]
    : []

  return getGroq().chat.completions.create({
    model,
    messages: [...systemMessages, ...messages],
    temperature,
    max_tokens: maxTokens,
    stream: true,
  })
}

// ── JSON EXTRACTION ───────────────────────────────────────────

export async function createJSONCompletion<T>(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<T> {
  const result = await createChatCompletion(messages, {
    ...options,
    responseFormat: 'json',
    model: options.model ?? MODELS.LLAMA_70B,
  })

  try {
    return JSON.parse(result.content) as T
  } catch {
    throw new Error(`Failed to parse AI JSON response: ${result.content}`)
  }
}

// ── AI WEALTH COACH ───────────────────────────────────────────

// ── COMPLIANCE SCOPE ─────────────────────────────────────────
// Applied to every AI Coach response. This exists because the
// difference between "explain how diversification works" and
// "tell this specific person what to buy" is the difference
// between a software feature and regulated investment advice
// (Investment Advisers Act of 1940 and state equivalents). The
// AI Coach is a tool that helps people organize, understand, and
// plan around their own numbers — it does not advise, recommend,
// or manage anyone's investments.
const COMPLIANCE_SCOPE = `
SCOPE AND LIMITS — these are hard constraints, not suggestions:

- You are not a registered investment adviser, broker-dealer, tax preparer, accountant, or attorney. Nothing you say creates an advisory, fiduciary, or client relationship of any kind.
- Never recommend, endorse, or advise for or against any specific security, ticker, fund, cryptocurrency, or investment product. If asked "should I buy/sell X," explain the relevant general concept instead (diversification, fees, risk, time horizon) and note that a licensed financial advisor can evaluate their specific situation — do not name a preferred alternative either.
- Never predict or imply confidence about market direction, timing, or future returns. No "X will probably go up," no "the best time to invest is now."
- Never give individualized tax-filing, legal, or estate-planning instructions. Explain the general concept and point to a licensed CPA or attorney for anything specific to their situation.
- You MAY: explain financial concepts in general terms; help the user organize, total, and understand data they've entered themselves (their budget, goals, portfolio holdings, debts); run calculations through Finora's tools; describe widely-accepted general principles (e.g., "an emergency fund commonly covers 3-6 months of expenses") clearly framed as general information, not a personal recommendation.
- Refuse requests for anything illegal: insider trading, market manipulation, tax evasion, structuring transactions to evade reporting requirements, money laundering, securities fraud, or unlicensed lending/investment schemes. Briefly explain why you can't help, and if there's a legitimate version of what they're trying to do, mention that instead.
- When a request is ambiguous between "explain how this works in general" and "tell me what I personally should do," answer the general version and say so explicitly.
- Every response involving investment concepts should make clear this is educational information, not personalized advice — briefly, without being repetitive to the point of being annoying in a short back-and-forth conversation.
`

const WEALTH_COACH_SYSTEM = `You are the Finora AI Coach — a financial education and organization assistant. You help people understand their own finances, use Finora's tools effectively, and learn general financial concepts. You are not a financial advisor and do not manage anyone's money or investments.

What you help with:
- Understanding and organizing personal budgets, goals, and debt
- Explaining financial and investment concepts in plain language
- Walking through what Finora's calculators show and what the numbers mean
- General, widely-accepted principles of personal finance and long-term planning
- Helping someone think through trade-offs (e.g., paying down debt vs. building savings) using general frameworks, not personalized directives

Style:
- Warm and clear, not clinical — but never at the cost of accuracy or scope
- Plain language, explain jargon when you use it
- Use bullet points or numbered lists for clarity when helpful
- Be direct about what you can't help with rather than dancing around it
${COMPLIANCE_SCOPE}
User context will be provided when available (net worth, goals, portfolio holdings they've entered, budget) — use it to make explanations concrete and relevant, not to generate personalized investment instructions.`

export async function getWealthCoachResponse(
  messages: ChatMessage[],
  userContext?: {
    netWorth?: number
    plan?: string
    goals?: string[]
    monthlyIncome?: number
    monthlyExpenses?: number
  }
): Promise<CompletionResult> {
  const contextStr = userContext
    ? `\n\nUser Financial Context:\n${JSON.stringify(userContext, null, 2)}`
    : ''

  return createChatCompletion(messages, {
    model: MODELS.COACH_DEFAULT,
    temperature: 0.7,
    maxTokens: 1024,
    systemPrompt: WEALTH_COACH_SYSTEM + contextStr,
  })
}

// ── FINANCIAL HEALTH ANALYSIS ─────────────────────────────────

export async function analyzeFinancialHealth(data: {
  netWorth: number
  monthlyIncome: number
  monthlyExpenses: number
  totalDebt: number
  emergencyFund: number
  portfolioValue: number
  savingsRate: number
}) {
  const prompt = `Analyze this user's financial health and provide:
1. 3-5 key insights about their financial situation
2. Top 3 recommendations prioritized by impact
3. Overall assessment

Constraints: recommendations must be general financial practices (e.g. "build a 3-6 month emergency fund," "pay down highest-interest debt first"), never a specific security, ticker, fund, or investment product. Do not predict market performance.

Financial Data:
${JSON.stringify(data, null, 2)}

Return valid JSON with this structure:
{
  "insights": [{"type": string, "title": string, "description": string, "severity": "positive"|"neutral"|"warning"|"danger"}],
  "recommendations": [{"priority": number, "action": string, "description": string, "impact": "low"|"medium"|"high"}],
  "assessment": string
}`

  return createJSONCompletion<{
    insights: Array<{ type: string; title: string; description: string; severity: string }>
    recommendations: Array<{ priority: number; action: string; description: string; impact: string }>
    assessment: string
  }>([{ role: 'user', content: prompt }], {
    model: MODELS.LLAMA_70B,
    temperature: 0.3,
    maxTokens: 2048,
  })
}

// ── BUDGET ANALYSIS ───────────────────────────────────────────

export async function analyzeBudget(categories: Array<{
  name: string
  budgeted: number
  spent: number
}>) {
  const prompt = `Analyze this budget and provide insights. Categories: ${JSON.stringify(categories)}

Constraints: suggestions must be about spending/budgeting behavior only (e.g. category limits, spending patterns), never investment or tax advice.

Return JSON: {
  "overspending": string[],
  "underspending": string[],
  "insights": string[],
  "suggestions": string[]
}`

  return createJSONCompletion<{
    overspending: string[]
    underspending: string[]
    insights: string[]
    suggestions: string[]
  }>([{ role: 'user', content: prompt }], {
    model: MODELS.LLAMA_8B,
    temperature: 0.3,
  })
}

// ── GOAL PLANNING ─────────────────────────────────────────────

export async function generateGoalPlan(goal: {
  title: string
  category: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  monthlyContribution: number | null
}) {
  const prompt = `Create a detailed savings/budgeting plan for this financial goal:
${JSON.stringify(goal, null, 2)}

Constraints: this is a savings and budgeting plan, not an investment strategy — "monthly_actions"/"weekly_actions"/"tips" must be about saving, budgeting, and tracking behavior, never a specific security, fund, or investment recommendation. "risks" should describe general planning risks (e.g. "unexpected expenses could delay this timeline"), not market predictions.

Return JSON: {
  "timeline_months": number,
  "monthly_required": number,
  "weekly_actions": string[],
  "monthly_actions": string[],
  "milestones": [{"month": number, "amount": number, "label": string}],
  "tips": string[],
  "risks": string[]
}`

  return createJSONCompletion<{
    timeline_months: number
    monthly_required: number
    weekly_actions: string[]
    monthly_actions: string[]
    milestones: Array<{ month: number; amount: number; label: string }>
    tips: string[]
    risks: string[]
  }>([{ role: 'user', content: prompt }], {
    model: MODELS.LLAMA_70B,
    temperature: 0.5,
    maxTokens: 2048,
  })
}
