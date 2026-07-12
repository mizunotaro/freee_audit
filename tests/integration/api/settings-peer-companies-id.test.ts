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

import { GET, PUT, DELETE } from '@/app/api/settings/peer-companies/[id]/route'
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

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function buildRequest(
  method: 'GET' | 'PUT' | 'DELETE',
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
  return new NextRequest('http://localhost/api/settings/peer-companies/peer-1', init)
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

describe('GET /api/settings/peer-companies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildRequest('GET', undefined), ctx('peer-1'))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    expect(dbMocks.peerCompany.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 when the peer does not exist for the company', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findFirst.mockResolvedValue(null)

    const response = await GET(buildRequest('GET', 'session=valid-token'), ctx('peer-1'))

    expect(response.status).toBe(404)
    expect(dbMocks.peerCompany.findFirst).toHaveBeenCalledWith({
      where: { id: 'peer-1', companyId: 'company-1' },
    })
  })

  it('returns the peer for an authenticated request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findFirst.mockResolvedValue(samplePeer)

    const response = await GET(buildRequest('GET', 'session=valid-token'), ctx('peer-1'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(samplePeer)
  })
})

describe('PUT /api/settings/peer-companies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await PUT(buildRequest('PUT', undefined, { name: 'Updated' }), ctx('peer-1'))

    expect(response.status).toBe(401)
    expect(dbMocks.peerCompany.update).not.toHaveBeenCalled()
  })

  it('returns 400 when the body fails validation', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await PUT(
      buildRequest('PUT', 'session=valid-token', { employees: 1.5 }),
      ctx('peer-1')
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.details).toBeDefined()
    expect(dbMocks.peerCompany.update).not.toHaveBeenCalled()
  })

  it('returns 404 when the peer does not exist', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findFirst.mockResolvedValue(null)

    const response = await PUT(
      buildRequest('PUT', 'session=valid-token', { name: 'Updated' }),
      ctx('peer-1')
    )

    expect(response.status).toBe(404)
    expect(dbMocks.peerCompany.update).not.toHaveBeenCalled()
  })

  it('updates the peer and audits the action', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findFirst.mockResolvedValue(samplePeer)
    const updated = { ...samplePeer, name: 'Updated Co' }
    dbMocks.peerCompany.update.mockResolvedValue(updated)

    const response = await PUT(
      buildRequest('PUT', 'session=valid-token', { name: 'Updated Co' }),
      ctx('peer-1')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(updated)
    expect(dbMocks.peerCompany.update).toHaveBeenCalledWith({
      where: { id: 'peer-1' },
      data: expect.objectContaining({ name: 'Updated Co' }),
    })
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'PEER_COMPANY_UPDATE',
        resource: 'peer_company',
        resourceId: 'peer-1',
      })
    )
  })
})

describe('DELETE /api/settings/peer-companies/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await DELETE(buildRequest('DELETE', undefined), ctx('peer-1'))

    expect(response.status).toBe(401)
    expect(dbMocks.peerCompany.delete).not.toHaveBeenCalled()
  })

  it('returns 404 when the peer does not exist', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findFirst.mockResolvedValue(null)

    const response = await DELETE(buildRequest('DELETE', 'session=valid-token'), ctx('peer-1'))

    expect(response.status).toBe(404)
    expect(dbMocks.peerCompany.delete).not.toHaveBeenCalled()
  })

  it('deletes the peer and audits the action', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    dbMocks.peerCompany.findFirst.mockResolvedValue(samplePeer)
    dbMocks.peerCompany.delete.mockResolvedValue(samplePeer)

    const response = await DELETE(buildRequest('DELETE', 'session=valid-token'), ctx('peer-1'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(dbMocks.peerCompany.delete).toHaveBeenCalledWith({ where: { id: 'peer-1' } })
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'PEER_COMPANY_DELETE',
        resource: 'peer_company',
        resourceId: 'peer-1',
      })
    )
  })
})
