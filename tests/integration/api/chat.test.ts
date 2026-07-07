import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthUser: vi.fn(),
}))

vi.mock('@/lib/ai/context/context-manager', () => ({
  createContextManager: vi.fn(() => ({
    getSession: vi.fn().mockResolvedValue({ success: false }),
    createSession: vi
      .fn()
      .mockResolvedValue({ success: true, data: { id: 'session-1', messages: [] } }),
    addMessage: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/lib/ai/orchestrator/orchestrator', () => ({
  createOrchestrator: vi.fn(() => ({
    process: vi.fn().mockResolvedValue({
      success: true,
      response: {
        summary: 'Test summary',
        personaAnalyses: [
          {
            persona: 'cpa',
            response: {
              conclusion: 'conclusion',
              confidence: 0.9,
              reasoning: [],
              risks: [],
            },
          },
        ],
        consensusPoints: ['point'],
        recommendedAction: 'action',
        confidence: 0.8,
        totalCost: 0.001,
      },
      metadata: {
        workflowId: 'wf-1',
        intentClassification: {
          primary: 'general_inquiry',
          confidence: 0.9,
          secondary: [],
          keywords: [],
        },
        modelSelection: { model: { modelId: 'test-model' } },
        timestamp: new Date(),
      },
    }),
  })),
}))

const mockGetAuthUser = vi.mocked((await import('@/lib/api/auth-helpers')).getAuthUser)
const mockCreateOrchestrator = vi.mocked(
  (await import('@/lib/ai/orchestrator/orchestrator')).createOrchestrator
)

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('Chat API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(mockUser)
  })

  describe('POST /api/chat input validation', () => {
    it('should return 401 when unauthenticated', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null)

      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest({ message: 'hello' }))

      expect(response.status).toBe(401)
    })

    it('should return 400 when message is missing', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest({ sessionId: 's1' }))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('invalid_input')
    })

    it('should return 400 when message is not a string', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest({ message: 123 }))

      expect(response.status).toBe(400)
    })

    it('should return 400 when message is an empty string', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest({ message: '' }))

      expect(response.status).toBe(400)
    })

    it('should return 400 when message exceeds max length', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest({ message: 'a'.repeat(10001) }))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('message_too_long')
    })

    it('should return 400 for invalid JSON body', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest('{ invalid json'))
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('invalid_json')
    })

    it('should return 400 when a nested option has a wrong type', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(
        buildRequest({ message: 'hello', options: { maxCost: 'not-a-number' } })
      )

      expect(response.status).toBe(400)
    })

    it('should return 400 when language is not a supported locale', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest({ message: 'hello', context: { language: 'fr' } }))

      expect(response.status).toBe(400)
    })

    it('should accept a well-formed request and return 200', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(
        buildRequest({
          message: '今期のキャッシュフローを分析して',
          context: { companyId: 'company-1', language: 'ja' },
          options: { maxCost: 0.5, maxLatencyMs: 10000 },
        })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.sessionId).toBe('session-1')
      expect(mockCreateOrchestrator).toHaveBeenCalled()
    })

    it('should accept a minimal well-formed request', async () => {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest({ message: 'hello' }))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
