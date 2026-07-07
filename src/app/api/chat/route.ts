import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { ChatRequest, ChatResponse, PersonaAnalysisResponse } from './types'
import { createOrchestrator } from '@/lib/ai/orchestrator/orchestrator'
import { createContextManager } from '@/lib/ai/context/context-manager'
import type { PersonaType } from '@/lib/ai/personas/types'
import type { PersonaAnalysis } from '@/lib/ai/orchestrator/orchestrator-types'
import { getAuthUser } from '@/lib/api/auth-helpers'

const PERSONA_NAMES: Record<PersonaType, string> = {
  cpa: '公認会計士',
  tax_accountant: '税理士',
  cfo: 'CFO',
  financial_analyst: '財務アナリスト',
  big4_auditor: 'Big4監査法人',
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 30
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const chatRequestSchema = z
  .object({
    message: z.string().min(1).max(10000),
    sessionId: z.string().optional(),
    context: z
      .object({
        companyId: z.string().optional(),
        language: z.enum(['ja', 'en']).optional(),
        financialData: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    options: z
      .object({
        maxCost: z.number().optional(),
        maxLatencyMs: z.number().optional(),
        stream: z.boolean().optional(),
        preferredPersonas: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const startTime = Date.now()

  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          sessionId: '',
          error: { code: 'unauthorized', message: 'Authentication required' },
        },
        { status: 401 }
      )
    }

    const body = await parseRequestBody(request)
    if (!body.success) {
      return NextResponse.json(
        { success: false, sessionId: '', error: body.error },
        { status: 400 }
      )
    }

    const { message, sessionId, context, options } = body.data

    const rateLimitResult = checkRateLimit(authUser.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          sessionId: sessionId ?? '',
          error: {
            code: 'rate_limited',
            message: 'Rate limit exceeded. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    const userId = authUser.id
    const contextManager = createContextManager({
      defaultConfig: {
        maxMessages: 50,
        maxTokens: 8000,
        ttlMs: 24 * 60 * 60 * 1000,
      },
    })

    const session = await getOrCreateSession(sessionId, userId, context?.companyId, contextManager)

    await contextManager.addMessage(session.id, 'user', message)

    const orchestrator = createOrchestrator({
      timeoutMs: 60000,
      maxParallelExecutions: 4,
    })

    const orchestratorResult = await orchestrator.process({
      query: message,
      context: {
        sessionId: session.id,
        userId,
        companyId: context?.companyId,
        language: context?.language ?? 'ja',
        conversationHistory: session.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp,
            personaUsed: m.persona,
          })),
        financialData: context?.financialData,
      },
      constraints: {
        maxCost: options?.maxCost,
        maxLatencyMs: options?.maxLatencyMs,
        preferredPersonas: options?.preferredPersonas,
      },
    })

    if (!orchestratorResult.success || !orchestratorResult.response) {
      return NextResponse.json({
        success: false,
        sessionId: session.id,
        error: {
          code: orchestratorResult.error?.code ?? 'processing_failed',
          message: orchestratorResult.error?.message ?? 'Failed to process request',
        },
      })
    }

    const assistantContent = orchestratorResult.response.summary
    await contextManager.addMessage(session.id, 'assistant', assistantContent)

    const response: ChatResponse = {
      success: true,
      sessionId: session.id,
      response: {
        summary: orchestratorResult.response.summary,
        personaAnalyses: orchestratorResult.response.personaAnalyses.map((a) =>
          mapPersonaAnalysis(a)
        ),
        consensusPoints: orchestratorResult.response.consensusPoints,
        recommendedAction: orchestratorResult.response.recommendedAction,
        confidence: orchestratorResult.response.confidence,
      },
      metadata: {
        intent: orchestratorResult.metadata.intentClassification.primary,
        intentConfidence: orchestratorResult.metadata.intentClassification.confidence,
        processingTimeMs: Date.now() - startTime,
        totalCost: orchestratorResult.response.totalCost,
        modelUsed: orchestratorResult.metadata.modelSelection.model.modelId,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        sessionId: '',
        error: {
          code: 'internal_error',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}

async function parseRequestBody(
  request: NextRequest
): Promise<
  | { success: true; data: ChatRequest }
  | { success: false; error: { code: string; message: string } }
> {
  try {
    const body = await request.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      const messageIssue = parsed.error.issues.find((issue) => issue.path[0] === 'message')
      if (messageIssue?.code === 'too_big') {
        return {
          success: false,
          error: { code: 'message_too_long', message: 'Message exceeds maximum length' },
        }
      }
      return {
        success: false,
        error: { code: 'invalid_input', message: 'Message is required' },
      }
    }

    return { success: true, data: parsed.data as ChatRequest }
  } catch {
    return {
      success: false,
      error: { code: 'invalid_json', message: 'Invalid JSON body' },
    }
  }
}

function checkRateLimit(userId: string): {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
} {
  const clientId = userId
  const now = Date.now()
  const key = `${clientId}:${Math.floor(now / RATE_LIMIT_WINDOW_MS)}`

  const entry = rateLimitStore.get(key)
  const count = entry?.count ?? 0

  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: 0,
      resetAt: entry?.resetAt ?? now + RATE_LIMIT_WINDOW_MS,
    }
  }

  rateLimitStore.set(key, {
    count: count + 1,
    resetAt: now + RATE_LIMIT_WINDOW_MS,
  })

  for (const [k] of rateLimitStore) {
    const windowStart = parseInt(k.split(':')[1], 10) * RATE_LIMIT_WINDOW_MS
    if (now - windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(k)
    }
  }

  return {
    allowed: true,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: RATE_LIMIT_MAX_REQUESTS - count - 1,
    resetAt: now + RATE_LIMIT_WINDOW_MS,
  }
}

async function getOrCreateSession(
  sessionId: string | undefined,
  userId: string,
  companyId: string | undefined,
  contextManager: ReturnType<typeof createContextManager>
) {
  if (sessionId) {
    const result = await contextManager.getSession(sessionId)
    if (result.success) {
      return result.data
    }
  }

  const result = await contextManager.createSession(userId, companyId)
  if (!result.success) {
    throw new Error('Failed to create session')
  }
  return result.data
}

function mapPersonaAnalysis(analysis: PersonaAnalysis): PersonaAnalysisResponse {
  return {
    persona: analysis.persona,
    personaName: PERSONA_NAMES[analysis.persona],
    conclusion: analysis.response.conclusion,
    confidence: analysis.response.confidence,
    reasoning: analysis.response.reasoning.slice(0, 5).map((r) => ({
      point: r.point,
      analysis: r.analysis,
      confidence: r.confidence,
    })),
    risks: analysis.response.risks.slice(0, 5).map((r) => ({
      category: r.category,
      description: r.description,
      severity: r.severity,
    })),
  }
}
