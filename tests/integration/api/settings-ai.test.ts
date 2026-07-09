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
vi.mock('@/lib/crypto/encryption', () => ({
  encrypt: cryptoMocks.encrypt,
}))

const dbMocks = vi.hoisted(() => ({
  apiKey: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({
  prisma: { apiKey: dbMocks.apiKey },
}))

import { GET, POST } from '@/app/api/settings/ai/route'
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
  method: 'GET' | 'POST',
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
  return new NextRequest('http://localhost/api/settings/ai', init)
}

describe('GET /api/settings/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildRequest('GET', undefined))

    expect(response.status).toBe(401)
    expect(dbMocks.apiKey.findMany).not.toHaveBeenCalled()
  })

  it('returns 403 when the user has no company association', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue({ ...adminUser, companyId: null })

    const response = await GET(buildRequest('GET', 'session=valid-token'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(dbMocks.apiKey.findMany).not.toHaveBeenCalled()
  })

  it('returns an empty config when no API keys are stored', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)
    dbMocks.apiKey.findMany.mockResolvedValue([])

    const response = await GET(buildRequest('GET', 'session=valid-token'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.config).toEqual({})
    expect(dbMocks.apiKey.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        provider: { in: ['OPENAI', 'GEMINI', 'CLAUDE'] },
      },
    })
  })

  it('maps stored keys to a configured flag per provider', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)
    dbMocks.apiKey.findMany.mockResolvedValue([
      { provider: 'OPENAI', expiresAt: null },
      { provider: 'CLAUDE', expiresAt: null },
    ])

    const response = await GET(buildRequest('GET', 'session=valid-token'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.config.openai).toEqual({ configured: true, expiresAt: null })
    expect(body.config.claude.configured).toBe(true)
    expect(body.config.gemini).toBeUndefined()
  })
})

describe('POST /api/settings/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a non-admin with 403', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(viewerUser)

    const response = await POST(
      buildRequest('POST', 'session=valid-token', { provider: 'openai', apiKey: 'sk-test' })
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toMatch(/admin/i)
    expect(dbMocks.apiKey.upsert).not.toHaveBeenCalled()
    expect(cryptoMocks.encrypt).not.toHaveBeenCalled()
  })

  it('encrypts the key and upserts it for an admin', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)

    const response = await POST(
      buildRequest('POST', 'session=valid-token', {
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-x',
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    expect(cryptoMocks.encrypt).toHaveBeenCalledWith('sk-test')
    expect(dbMocks.apiKey.upsert).toHaveBeenCalledTimes(1)
    const args = dbMocks.apiKey.upsert.mock.calls[0][0] as {
      where: { companyId_provider: { companyId: string; provider: string } }
      create: { companyId: string; provider: string; encryptedKey: string; metadata: string }
      update: { encryptedKey: string; metadata: string }
    }
    expect(args.where.companyId_provider).toEqual({ companyId: 'company-1', provider: 'OPENAI' })
    expect(args.create.encryptedKey).toBe('enc:sk-test')
    expect(args.create.metadata).toBe(JSON.stringify({ model: 'gpt-x' }))
    expect(args.update.encryptedKey).toBe('enc:sk-test')
  })

  it('rejects an invalid body with 400', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(adminUser)

    const response = await POST(
      buildRequest('POST', 'session=valid-token', { provider: 'not-a-provider', apiKey: 'sk' })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.details).toBeDefined()
    expect(dbMocks.apiKey.upsert).not.toHaveBeenCalled()
  })
})
