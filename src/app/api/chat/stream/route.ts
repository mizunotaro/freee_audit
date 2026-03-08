import { NextRequest } from 'next/server'
import { createOrchestrator } from '@/lib/ai/orchestrator/orchestrator'
import type { OrchestratorEvent } from '@/lib/ai/orchestrator/orchestrator-types'
import { createContextManager } from '@/lib/ai/context/context-manager'
import type { ChatRequest, StreamChunk } from '../types'
import type { PersonaType } from '@/lib/ai/personas/types'

const PERSONA_NAMES: Record<PersonaType, string> = {
  cpa: '公認会計士',
  tax_accountant: '税理士',
  cfo: 'CFO',
  financial_analyst: '財務アナリスト',
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: ChatRequest = await request.json()

    if (!body.message || typeof body.message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 })
    }

    const userId = extractUserId(request)
    const contextManager = createContextManager()

    let session
    if (body.sessionId) {
      const sessionResult = await contextManager.getSession(body.sessionId)
      if (sessionResult.success) {
        session = sessionResult.data
      }
    }

    if (!session) {
      const sessionResult = await contextManager.createSession(userId, body.context?.companyId)
      if (sessionResult.success) {
        session = sessionResult.data
      } else {
        throw new Error('Failed to create session')
      }
    }

    await contextManager.addMessage(session.id, 'user', body.message)

    const encoder = new TextEncoder()
    const stream = new TransformStream<StreamChunk, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      },
    })

    const writer = stream.writable.getWriter()

    const orchestrator = createOrchestrator({
      timeoutMs: 60000,
      onEvent: async (event: OrchestratorEvent) => {
        await handleOrchestratorEvent(event, writer)
      },
    })

    ;(async () => {
      try {
        await writer.write({
          type: 'intent',
          data: { sessionId: session!.id },
        })

        const result = await orchestrator.process({
          query: body.message,
          context: {
            sessionId: session!.id,
            userId,
            companyId: body.context?.companyId,
            language: body.context?.language ?? 'ja',
            conversationHistory: session!.messages
              .filter((m) => m.role === 'user' || m.role === 'assistant')
              .map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: m.timestamp,
              })),
            financialData: body.context?.financialData,
          },
          constraints: body.options,
        })

        if (result.success && result.response) {
          await contextManager.addMessage(session!.id, 'assistant', result.response.summary)
        }

        await writer.write({ type: 'done', data: { success: result.success } })
      } catch (error) {
        await writer.write({
          type: 'error',
          data: { message: error instanceof Error ? error.message : 'Unknown error' },
        })
      } finally {
        await writer.close()
      }
    })()

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('[Stream API] Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}

async function handleOrchestratorEvent(
  event: OrchestratorEvent,
  writer: WritableStreamDefaultWriter<StreamChunk>
): Promise<void> {
  switch (event.type) {
    case 'intent_classified':
      await writer.write({
        type: 'intent',
        data: {
          intent: event.data.primary,
          confidence: event.data.confidence,
          keywords: event.data.keywords,
        },
      })
      break

    case 'workflow_selected':
      await writer.write({
        type: 'synthesis',
        data: {
          workflow: event.data.name,
          personas: event.data.steps.map((s) => s.persona),
        },
      })
      break

    case 'persona_started':
      await writer.write({
        type: 'persona_start',
        data: {
          persona: event.data.persona,
          personaName: PERSONA_NAMES[event.data.persona],
          stepId: event.data.stepId,
        },
      })
      break

    case 'persona_completed':
      await writer.write({
        type: 'persona_complete',
        data: {
          persona: event.data.persona,
          personaName: PERSONA_NAMES[event.data.persona],
          conclusion: event.data.response.conclusion.slice(0, 500),
          confidence: event.data.response.confidence,
          executionTimeMs: event.data.executionTimeMs,
        },
      })
      break

    case 'persona_failed':
      await writer.write({
        type: 'error',
        data: {
          persona: event.data.persona,
          message: event.data.error.message,
        },
      })
      break

    case 'synthesis_completed':
      await writer.write({
        type: 'synthesis',
        data: {
          summary: event.data.summary,
          consensusPoints: event.data.consensusPoints,
          recommendedAction: event.data.recommendedAction,
          confidence: event.data.confidence,
          totalCost: event.data.totalCost,
        },
      })
      break
  }
}

function extractUserId(request: NextRequest): string {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return `user_${authHeader.slice(7, 20)}`
  }
  return `anonymous_${Date.now()}`
}
