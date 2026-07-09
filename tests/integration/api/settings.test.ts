import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const cryptoMocks = vi.hoisted(() => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: cryptoMocks.encrypt,
}))

const dbMocks = vi.hoisted(() => ({
  settings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({
  prisma: { settings: dbMocks.settings },
}))

import { GET, PUT } from '@/app/api/settings/route'
import type { AuthUser } from '@/lib/auth'

const adminUser: AuthUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  companyId: 'company-1',
}

const viewerUser: AuthUser = {
  id: 'viewer-1',
  email: 'viewer@example.com',
  name: 'Viewer',
  role: 'VIEWER',
  companyId: 'company-1',
}

function buildRequest(
  method: 'GET' | 'PUT',
  cookie: string | undefined,
  body?: unknown
): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  }
  return new NextRequest('http://localhost/api/settings', init)
}

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildRequest('GET', undefined))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(dbMocks.settings.findUnique).not.toHaveBeenCalled()
  })

  it('returns 401 when the session is invalid', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(null)

    const response = await GET(buildRequest('GET', 'session=expired'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(dbMocks.settings.findUnique).not.toHaveBeenCalled()
  })

  it('returns default settings with the default analysis prompt for a new user', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)
    dbMocks.settings.findUnique.mockResolvedValue(null)

    const response = await GET(buildRequest('GET', 'session=valid-token'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.theme).toBe('system')
    expect(body.aiProvider).toBe('openai')
    expect(body.hasOpenaiApiKey).toBe(false)
    expect(typeof body.analysisPrompt).toBe('string')
    expect(body.analysisPrompt.length).toBeGreaterThan(0)
    expect(dbMocks.settings.findUnique).toHaveBeenCalledWith({
      where: { userId: 'admin-1' },
    })
  })

  it('strips API keys and exposes has-key flags for a configured user', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)
    dbMocks.settings.findUnique.mockResolvedValue({
      id: 'settings-1',
      userId: 'admin-1',
      theme: 'dark',
      aiProvider: 'claude',
      secretSource: 'local',
      azureEndpoint: null,
      awsAccessKeyId: null,
      awsRegion: 'ap-northeast-1',
      gcpProjectId: null,
      freeeClientId: null,
      freeeCompanyId: null,
      analysisPrompt: 'custom prompt',
      fiscalYearEndMonth: 3,
      taxBusinessType: 'general',
      openaiApiKey: 'enc:sk-stored',
      geminiApiKey: null,
      claudeApiKey: 'enc:claude-stored',
      azureApiKey: null,
      awsSecretAccessKey: null,
      gcpApiKey: null,
      freeeClientSecret: null,
    })

    const response = await GET(buildRequest('GET', 'session=valid-token'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.hasOpenaiApiKey).toBe(true)
    expect(body.hasGeminiApiKey).toBe(false)
    expect(body.hasClaudeApiKey).toBe(true)
    expect(body.openaiApiKey).toBeUndefined()
    expect(body.claudeApiKey).toBeUndefined()
    expect(body.theme).toBe('dark')
  })
})

describe('PUT /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await PUT(buildRequest('PUT', undefined, { theme: 'dark' }))

    expect(response.status).toBe(401)
    expect(dbMocks.settings.upsert).not.toHaveBeenCalled()
  })

  it('rejects API-key updates from a non-admin with 403', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(viewerUser)

    const response = await PUT(
      buildRequest('PUT', 'session=valid-token', { openaiApiKey: 'sk-test' })
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/administrators/i)
    expect(dbMocks.settings.upsert).not.toHaveBeenCalled()
    expect(cryptoMocks.encrypt).not.toHaveBeenCalled()
  })

  it('encrypts API keys before persisting and returns sanitized settings', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)
    dbMocks.settings.upsert.mockResolvedValue({
      id: 'settings-1',
      userId: 'admin-1',
      theme: 'system',
      aiProvider: 'openai',
      secretSource: 'local',
      azureEndpoint: null,
      awsAccessKeyId: null,
      awsRegion: 'ap-northeast-1',
      gcpProjectId: null,
      freeeClientId: null,
      freeeCompanyId: null,
      analysisPrompt: null,
      fiscalYearEndMonth: 12,
      taxBusinessType: 'general',
      openaiApiKey: 'enc:sk-test',
      geminiApiKey: null,
      claudeApiKey: null,
      azureApiKey: null,
      awsSecretAccessKey: null,
      gcpApiKey: null,
      freeeClientSecret: null,
    })

    const response = await PUT(
      buildRequest('PUT', 'session=valid-token', { openaiApiKey: 'sk-test' })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.settings.hasOpenaiApiKey).toBe(true)
    expect(body.settings.openaiApiKey).toBeUndefined()

    expect(cryptoMocks.encrypt).toHaveBeenCalledWith('sk-test')
    expect(dbMocks.settings.upsert).toHaveBeenCalledTimes(1)
    const upsertArgs = dbMocks.settings.upsert.mock.calls[0][0] as {
      where: { userId: string }
      update: { openaiApiKey?: string; theme?: string }
      create: { userId: string; openaiApiKey?: string }
    }
    expect(upsertArgs.where.userId).toBe('admin-1')
    expect(upsertArgs.update.openaiApiKey).toBe('enc:sk-test')
    expect(upsertArgs.create.userId).toBe('admin-1')
    expect(upsertArgs.create.openaiApiKey).toBe('enc:sk-test')
  })

  it('allows a non-admin to update non-sensitive fields', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(viewerUser)
    dbMocks.settings.upsert.mockResolvedValue({
      id: 'settings-1',
      userId: 'viewer-1',
      theme: 'dark',
      aiProvider: 'openai',
      secretSource: 'local',
      azureEndpoint: null,
      awsAccessKeyId: null,
      awsRegion: 'ap-northeast-1',
      gcpProjectId: null,
      freeeClientId: null,
      freeeCompanyId: null,
      analysisPrompt: null,
      fiscalYearEndMonth: 12,
      taxBusinessType: 'general',
      openaiApiKey: null,
      geminiApiKey: null,
      claudeApiKey: null,
      azureApiKey: null,
      awsSecretAccessKey: null,
      gcpApiKey: null,
      freeeClientSecret: null,
    })

    const response = await PUT(buildRequest('PUT', 'session=valid-token', { theme: 'dark' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.settings.theme).toBe('dark')
    expect(cryptoMocks.encrypt).not.toHaveBeenCalled()
    const upsertArgs = dbMocks.settings.upsert.mock.calls[0][0] as {
      update: { theme: string; openaiApiKey?: string }
    }
    expect(upsertArgs.update.theme).toBe('dark')
    expect(upsertArgs.update.openaiApiKey).toBeUndefined()
  })

  it('rejects an invalid body with 400', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)

    const response = await PUT(
      buildRequest('PUT', 'session=valid-token', { theme: 'blue', fiscalYearEndMonth: 99 })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.details).toBeDefined()
    expect(dbMocks.settings.upsert).not.toHaveBeenCalled()
  })
})
