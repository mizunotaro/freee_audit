import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/types/result'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue(success(undefined)),
}))

const dbMocks = vi.hoisted(() => ({
  peerCompany: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({ prisma: { peerCompany: dbMocks.peerCompany } }))

import { GET, POST } from '@/app/api/settings/peer-companies/route'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'
import type { AuthUser } from '@/lib/auth'

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildGetRequest(query: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest(`http://localhost/api/settings/peer-companies${query}`, { headers })
}

function buildPostRequest(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/settings/peer-companies', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

const samplePeer = {
  id: 'peer-1',
  companyId: 'company-1',
  ticker: '7203',
  name: 'Peer Co',
  industry: 'manufacturing',
  similarityScore: 0.9,
  isActive: true,
}

describe('GET /api/settings/peer-companies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildGetRequest(''))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Unauthorized' })
    expect(dbMocks.peerCompany.findMany).not.toHaveBeenCalled()
  })

  it('returns 401 when the user has no company', async () => {
    vi.mocked(validateSession).mockResolvedValue({ ...authenticatedUser, companyId: null })

    const response = await GET(buildGetRequest('', 'session=valid-token'))

    expect(response.status).toBe(401)
    expect(dbMocks.peerCompany.findMany).not.toHaveBeenCalled()
  })

  it('lists peers scoped to the company with active+industry filters applied', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findMany.mockResolvedValue([samplePeer])

    const response = await GET(
      buildGetRequest('?activeOnly=true&industry=manufacturing', 'session=valid-token')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([samplePeer])
    expect(dbMocks.peerCompany.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        isActive: true,
        industry: 'manufacturing',
      },
      orderBy: [{ similarityScore: 'desc' }, { name: 'asc' }],
    })
  })
})

describe('POST /api/settings/peer-companies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(buildPostRequest({ name: 'Peer Co' }))

    expect(response.status).toBe(401)
    expect(dbMocks.peerCompany.create).not.toHaveBeenCalled()
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await POST(buildPostRequest({}, 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.details).toBeDefined()
    expect(dbMocks.peerCompany.create).not.toHaveBeenCalled()
  })

  it('returns 409 when the ticker already exists for the company', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findUnique.mockResolvedValue(samplePeer)

    const response = await POST(
      buildPostRequest({ ticker: '7203', name: 'Peer Co' }, 'session=valid-token')
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(dbMocks.peerCompany.create).not.toHaveBeenCalled()
  })

  it('creates a peer and audits the action', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findUnique.mockResolvedValue(null)
    dbMocks.peerCompany.create.mockResolvedValue(samplePeer)

    const response = await POST(
      buildPostRequest(
        { ticker: '7203', name: 'Peer Co', industry: 'manufacturing' },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(samplePeer)
    expect(dbMocks.peerCompany.create).toHaveBeenCalledTimes(1)
    const createArgs = dbMocks.peerCompany.create.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(createArgs.data.companyId).toBe('company-1')
    expect(createArgs.data.dataSource).toBe('manual')

    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'PEER_COMPANY_CREATE',
        resource: 'peer_company',
        resourceId: 'peer-1',
      })
    )
  })
})
