import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const dbMocks = vi.hoisted(() => ({
  marketDataProvider: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({
  prisma: { marketDataProvider: dbMocks.marketDataProvider },
}))

const cryptoMocks = vi.hoisted(() => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => String(s).replace(/^enc:/, '')),
}))
vi.mock('@/lib/crypto', () => ({
  encrypt: cryptoMocks.encrypt,
  decrypt: cryptoMocks.decrypt,
}))

const jquantsMocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  testConnection: vi.fn(),
}))
vi.mock('@/services/market-data', () => ({
  createJQuantsProvider: () => ({
    authenticate: jquantsMocks.authenticate,
    testConnection: jquantsMocks.testConnection,
  }),
}))

import {
  GET as getProviders,
  POST as postProvider,
} from '@/app/api/settings/market-data/providers/route'
import {
  PATCH as patchProvider,
  DELETE as deleteProvider,
} from '@/app/api/settings/market-data/providers/[id]/route'
import { POST as saveJquants } from '@/app/api/settings/market-data/jquants/route'
import { POST as testJquants } from '@/app/api/settings/market-data/jquants/test/route'
import type { AuthUser } from '@/lib/auth'

const user: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
  return new NextRequest(url, init)
}

const lastSyncAt = new Date('2024-03-01T00:00:00.000Z')
const createdAt = new Date('2024-01-01T00:00:00.000Z')
const updatedAt = new Date('2024-02-01T00:00:00.000Z')

const providerRow = {
  id: 'p1',
  provider: 'edinet',
  enabled: true,
  priority: 10,
  lastSyncAt,
  lastError: null,
  createdAt,
  updatedAt,
  companyId: 'company-1',
  encryptedEmail: 'enc:user@example.com',
  encryptedPassword: 'enc:pass',
  encryptedApiKey: 'enc:key',
}

async function login(): Promise<void> {
  const { validateSession } = await import('@/lib/auth')
  vi.mocked(validateSession).mockResolvedValue(user)
}

describe('GET /api/settings/market-data/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await getProviders(
      buildRequest('http://localhost/api/settings/market-data/providers', 'GET', undefined)
    )

    expect(response.status).toBe(401)
    expect(dbMocks.marketDataProvider.findMany).not.toHaveBeenCalled()
  })

  it('lists providers scoped to the company, strips secrets, and serializes dates to ISO', async () => {
    await login()
    dbMocks.marketDataProvider.findMany.mockResolvedValue([providerRow])

    const response = await getProviders(
      buildRequest(
        'http://localhost/api/settings/market-data/providers',
        'GET',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toEqual({
      id: 'p1',
      provider: 'edinet',
      enabled: true,
      priority: 10,
      lastSyncAt: lastSyncAt.toISOString(),
      lastError: null,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })
    expect(body.data[0]).not.toHaveProperty('encryptedEmail')
    expect(body.data[0]).not.toHaveProperty('encryptedPassword')
    expect(body.data[0]).not.toHaveProperty('encryptedApiKey')

    expect(dbMocks.marketDataProvider.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
      orderBy: { priority: 'asc' },
    })
  })
})

describe('POST /api/settings/market-data/providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await postProvider(
      buildRequest('http://localhost/api/settings/market-data/providers', 'POST', undefined, {
        provider: 'edinet',
      })
    )

    expect(response.status).toBe(401)
    expect(dbMocks.marketDataProvider.create).not.toHaveBeenCalled()
  })

  it('returns 400 when provider is missing', async () => {
    await login()

    const response = await postProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers',
        'POST',
        'session=valid-token',
        { priority: 5 }
      )
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.details).toBeDefined()
    expect(dbMocks.marketDataProvider.create).not.toHaveBeenCalled()
  })

  it('returns 409 when the provider is already configured and does not audit', async () => {
    await login()
    dbMocks.marketDataProvider.findUnique.mockResolvedValue(providerRow)

    const response = await postProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers',
        'POST',
        'session=valid-token',
        { provider: 'edinet' }
      )
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Provider already configured')
    expect(dbMocks.marketDataProvider.create).not.toHaveBeenCalled()

    const { logRouteAudit } = await import('@/lib/route-audit')
    expect(vi.mocked(logRouteAudit)).not.toHaveBeenCalled()
  })

  it('creates a provider with defaulted fields and audits the create', async () => {
    await login()
    dbMocks.marketDataProvider.findUnique.mockResolvedValue(null)
    dbMocks.marketDataProvider.create.mockResolvedValue({
      id: 'p1',
      provider: 'edinet',
      enabled: true,
      priority: 10,
    })

    const response = await postProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers',
        'POST',
        'session=valid-token',
        { provider: 'edinet' }
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual({ id: 'p1', provider: 'edinet', enabled: true, priority: 10 })

    expect(dbMocks.marketDataProvider.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        provider: 'edinet',
        encryptedEmail: null,
        encryptedPassword: null,
        encryptedApiKey: null,
        enabled: true,
        priority: 10,
      },
    })

    const { logRouteAudit } = await import('@/lib/route-audit')
    expect(vi.mocked(logRouteAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'MARKET_DATA_PROVIDER_CREATE',
        resource: 'market_data_provider',
        resourceId: 'p1',
      })
    )
  })
})

describe('PATCH /api/settings/market-data/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await patchProvider(
      buildRequest('http://localhost/api/settings/market-data/providers/p1', 'PATCH', undefined, {
        enabled: false,
      }),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(401)
    expect(dbMocks.marketDataProvider.update).not.toHaveBeenCalled()
  })

  it('returns 400 when the patch body fails validation', async () => {
    await login()

    const response = await patchProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers/p1',
        'PATCH',
        'session=valid-token',
        { priority: 'not-a-number' }
      ),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.details).toBeDefined()
    expect(dbMocks.marketDataProvider.update).not.toHaveBeenCalled()
  })

  it('returns 404 when the provider is not owned by the company', async () => {
    await login()
    dbMocks.marketDataProvider.findFirst.mockResolvedValue(null)

    const response = await patchProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers/p1',
        'PATCH',
        'session=valid-token',
        { enabled: false }
      ),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(404)
    expect(dbMocks.marketDataProvider.update).not.toHaveBeenCalled()
  })

  it('merges the patch over existing values and audits the update', async () => {
    await login()
    dbMocks.marketDataProvider.findFirst.mockResolvedValue({
      id: 'p1',
      provider: 'edinet',
      enabled: true,
      priority: 10,
      lastError: 'boom',
    })
    dbMocks.marketDataProvider.update.mockResolvedValue({
      id: 'p1',
      provider: 'edinet',
      enabled: false,
      priority: 10,
    })

    const response = await patchProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers/p1',
        'PATCH',
        'session=valid-token',
        { enabled: false }
      ),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual({ id: 'p1', provider: 'edinet', enabled: false, priority: 10 })

    expect(dbMocks.marketDataProvider.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { enabled: false, priority: 10, lastError: 'boom' },
    })

    const { logRouteAudit } = await import('@/lib/route-audit')
    expect(vi.mocked(logRouteAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'MARKET_DATA_PROVIDER_UPDATE',
        resource: 'market_data_provider',
        resourceId: 'p1',
      })
    )
  })
})

describe('DELETE /api/settings/market-data/providers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await deleteProvider(
      buildRequest('http://localhost/api/settings/market-data/providers/p1', 'DELETE', undefined),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(401)
    expect(dbMocks.marketDataProvider.delete).not.toHaveBeenCalled()
  })

  it('returns 404 when the provider is not owned by the company', async () => {
    await login()
    dbMocks.marketDataProvider.findFirst.mockResolvedValue(null)

    const response = await deleteProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers/p1',
        'DELETE',
        'session=valid-token'
      ),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(404)
    expect(dbMocks.marketDataProvider.delete).not.toHaveBeenCalled()
  })

  it('deletes the owned provider and audits the delete', async () => {
    await login()
    dbMocks.marketDataProvider.findFirst.mockResolvedValue(providerRow)
    dbMocks.marketDataProvider.delete.mockResolvedValue(providerRow)

    const response = await deleteProvider(
      buildRequest(
        'http://localhost/api/settings/market-data/providers/p1',
        'DELETE',
        'session=valid-token'
      ),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    expect(dbMocks.marketDataProvider.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })

    const { logRouteAudit } = await import('@/lib/route-audit')
    expect(vi.mocked(logRouteAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'MARKET_DATA_PROVIDER_DELETE',
        resource: 'market_data_provider',
        resourceId: 'p1',
      })
    )
  })
})

describe('POST /api/settings/market-data/jquants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await saveJquants(
      buildRequest('http://localhost/api/settings/market-data/jquants', 'POST', undefined, {
        email: 'u@example.com',
        password: 'pass',
      })
    )

    expect(response.status).toBe(401)
    expect(cryptoMocks.encrypt).not.toHaveBeenCalled()
  })

  it('returns 400 when email or password is missing', async () => {
    await login()

    const response = await saveJquants(
      buildRequest(
        'http://localhost/api/settings/market-data/jquants',
        'POST',
        'session=valid-token',
        { email: 'u@example.com' }
      )
    )

    expect(response.status).toBe(400)
    expect(cryptoMocks.encrypt).not.toHaveBeenCalled()
  })

  it('creates a new jquants provider with encrypted credentials when none exists', async () => {
    await login()
    dbMocks.marketDataProvider.findUnique.mockResolvedValue(null)
    dbMocks.marketDataProvider.create.mockResolvedValue({
      id: 'p1',
      provider: 'jquants',
      enabled: true,
    })

    const response = await saveJquants(
      buildRequest(
        'http://localhost/api/settings/market-data/jquants',
        'POST',
        'session=valid-token',
        { email: 'u@example.com', password: 'pass' }
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual({ id: 'p1', provider: 'jquants', enabled: true })

    expect(cryptoMocks.encrypt).toHaveBeenCalledWith('u@example.com')
    expect(cryptoMocks.encrypt).toHaveBeenCalledWith('pass')
    expect(dbMocks.marketDataProvider.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        provider: 'jquants',
        encryptedEmail: 'enc:u@example.com',
        encryptedPassword: 'enc:pass',
        enabled: true,
        priority: 10,
      },
    })

    const { logRouteAudit } = await import('@/lib/route-audit')
    expect(vi.mocked(logRouteAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JQUANTS_CREDENTIALS_SAVE',
        resourceId: 'p1',
      })
    )
  })

  it('updates the existing jquants provider credentials in place', async () => {
    await login()
    dbMocks.marketDataProvider.findUnique.mockResolvedValue({
      id: 'p1',
      provider: 'jquants',
      encryptedEmail: 'enc:old@example.com',
      encryptedPassword: 'enc:oldpass',
    })
    dbMocks.marketDataProvider.update.mockResolvedValue({
      id: 'p1',
      provider: 'jquants',
      enabled: true,
    })

    const response = await saveJquants(
      buildRequest(
        'http://localhost/api/settings/market-data/jquants',
        'POST',
        'session=valid-token',
        { email: 'new@example.com', password: 'newpass' }
      )
    )

    expect(response.status).toBe(200)
    expect(dbMocks.marketDataProvider.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        encryptedEmail: 'enc:new@example.com',
        encryptedPassword: 'enc:newpass',
        lastError: null,
      },
    })
    expect(dbMocks.marketDataProvider.create).not.toHaveBeenCalled()
  })
})

describe('POST /api/settings/market-data/jquants/test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await testJquants(
      buildRequest('http://localhost/api/settings/market-data/jquants/test', 'POST', undefined)
    )

    expect(response.status).toBe(401)
    expect(jquantsMocks.authenticate).not.toHaveBeenCalled()
  })

  it('returns 400 when jquants credentials are not configured', async () => {
    await login()
    dbMocks.marketDataProvider.findUnique.mockResolvedValue(null)

    const response = await testJquants(
      buildRequest(
        'http://localhost/api/settings/market-data/jquants/test',
        'POST',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/not configured/i)
    expect(jquantsMocks.authenticate).not.toHaveBeenCalled()
  })

  it('records lastError and audits a failure when authentication fails', async () => {
    await login()
    dbMocks.marketDataProvider.findUnique.mockResolvedValue({
      id: 'p1',
      encryptedEmail: 'enc:u@example.com',
      encryptedPassword: 'enc:pass',
    })
    jquantsMocks.authenticate.mockResolvedValue({
      success: false,
      error: { message: 'Invalid credentials' },
    })

    const response = await testJquants(
      buildRequest(
        'http://localhost/api/settings/market-data/jquants/test',
        'POST',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid credentials')

    expect(cryptoMocks.decrypt).toHaveBeenCalledWith('enc:u@example.com')
    expect(cryptoMocks.decrypt).toHaveBeenCalledWith('enc:pass')
    expect(dbMocks.marketDataProvider.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { lastError: 'Invalid credentials' },
    })
    expect(jquantsMocks.testConnection).not.toHaveBeenCalled()

    const { logRouteAudit } = await import('@/lib/route-audit')
    expect(vi.mocked(logRouteAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JQUANTS_CONNECTION_TEST',
        resourceId: 'p1',
        result: 'FAILURE',
      })
    )
  })

  it('refreshes lastSyncAt and reports connected on a successful connection test', async () => {
    await login()
    dbMocks.marketDataProvider.findUnique.mockResolvedValue({
      id: 'p1',
      encryptedEmail: 'enc:u@example.com',
      encryptedPassword: 'enc:pass',
    })
    jquantsMocks.authenticate.mockResolvedValue({ success: true })
    jquantsMocks.testConnection.mockResolvedValue({ success: true, data: { ok: true } })

    const response = await testJquants(
      buildRequest(
        'http://localhost/api/settings/market-data/jquants/test',
        'POST',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual({ connected: true })

    expect(jquantsMocks.authenticate).toHaveBeenCalledWith({
      provider: 'jquants',
      email: 'u@example.com',
      password: 'pass',
    })
    expect(dbMocks.marketDataProvider.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { lastSyncAt: expect.any(Date), lastError: null },
    })

    const { logRouteAudit } = await import('@/lib/route-audit')
    expect(vi.mocked(logRouteAudit)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logRouteAudit).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        action: 'JQUANTS_CONNECTION_TEST',
        resource: 'market_data_provider',
        resourceId: 'p1',
      })
    )
    expect(vi.mocked(logRouteAudit).mock.calls[0][0]).not.toHaveProperty('result')
  })
})
