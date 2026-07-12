import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const promptMocks = vi.hoisted(() => ({
  getPrompt: vi.fn(),
  setPrompt: vi.fn(),
  resetToDefault: vi.fn(),
}))
vi.mock('@/services/ai/prompt-service', () => ({
  getPrompt: promptMocks.getPrompt,
  setPrompt: promptMocks.setPrompt,
  resetToDefault: promptMocks.resetToDefault,
  getAnalysisTypes: vi.fn(() => []),
}))

import { GET as getType, POST as postType } from '@/app/api/prompts/[type]/route'
import { POST as postReset } from '@/app/api/prompts/[type]/reset/route'
import type { AuthUser } from '@/lib/auth'

const user: AuthUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(method: 'GET' | 'POST', type: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = { authorization: 'Bearer valid-token' }
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  }
  return new NextRequest(`http://localhost/api/prompts/${type}`, init)
}

const validBody = {
  name: 'Custom',
  systemPrompt: 'system',
  userPromptTemplate: 'template',
  variables: [{ name: 'fiscalYear', description: 'Year', required: true }],
}

describe('GET /api/prompts/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a bearer token', async () => {
    const req = new NextRequest('http://localhost/api/prompts/FINANCIAL_ANALYSIS')
    const response = await getType(req, {
      params: Promise.resolve({ type: 'FINANCIAL_ANALYSIS' }),
    })

    expect(response.status).toBe(401)
    expect(promptMocks.getPrompt).not.toHaveBeenCalled()
  })

  it('returns 400 for an unknown analysis type', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await getType(buildRequest('GET', 'NOT_A_TYPE'), {
      params: Promise.resolve({ type: 'NOT_A_TYPE' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid analysis type')
    expect(promptMocks.getPrompt).not.toHaveBeenCalled()
  })

  it('returns the prompt for a valid type', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    promptMocks.getPrompt.mockResolvedValue({ id: 'default', systemPrompt: 'system' })

    const response = await getType(buildRequest('GET', 'FINANCIAL_ANALYSIS'), {
      params: Promise.resolve({ type: 'FINANCIAL_ANALYSIS' }),
    })

    expect(response.status).toBe(200)
    expect(promptMocks.getPrompt).toHaveBeenCalledWith('FINANCIAL_ANALYSIS', 'company-1')
  })
})

describe('POST /api/prompts/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for an unknown analysis type', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postType(buildRequest('POST', 'NOT_A_TYPE', validBody), {
      params: Promise.resolve({ type: 'NOT_A_TYPE' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid analysis type')
    expect(promptMocks.setPrompt).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is missing required fields', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postType(
      buildRequest('POST', 'FINANCIAL_ANALYSIS', { name: 'Custom' }),
      { params: Promise.resolve({ type: 'FINANCIAL_ANALYSIS' }) }
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid request body')
    expect(promptMocks.setPrompt).not.toHaveBeenCalled()
  })

  it('saves the prompt for a valid type and body', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    promptMocks.setPrompt.mockResolvedValue({ id: 'p1', systemPrompt: 'system' })

    const response = await postType(buildRequest('POST', 'FINANCIAL_ANALYSIS', validBody), {
      params: Promise.resolve({ type: 'FINANCIAL_ANALYSIS' }),
    })

    expect(response.status).toBe(200)
    expect(promptMocks.setPrompt).toHaveBeenCalledWith(
      'FINANCIAL_ANALYSIS',
      'company-1',
      expect.objectContaining({ name: 'Custom', systemPrompt: 'system' })
    )
  })
})

describe('POST /api/prompts/[type]/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for an unknown analysis type', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postReset(buildRequest('POST', 'NOT_A_TYPE'), {
      params: Promise.resolve({ type: 'NOT_A_TYPE' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid analysis type')
    expect(promptMocks.resetToDefault).not.toHaveBeenCalled()
  })

  it('resets the prompt for a valid type', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    promptMocks.resetToDefault.mockResolvedValue(undefined)

    const response = await postReset(buildRequest('POST', 'KPI_ANALYSIS'), {
      params: Promise.resolve({ type: 'KPI_ANALYSIS' }),
    })

    expect(response.status).toBe(200)
    expect(promptMocks.resetToDefault).toHaveBeenCalledWith('KPI_ANALYSIS', 'company-1')
  })
})
