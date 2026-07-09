import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const dbMocks = vi.hoisted(() => ({
  dDChecklist: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/lib/db', () => ({
  prisma: { dDChecklist: dbMocks.dDChecklist },
}))

const serviceMocks = vi.hoisted(() => ({
  getChecklist: vi.fn(),
  createChecklist: vi.fn(),
  updateChecklistItem: vi.fn(),
}))
vi.mock('@/services/dd/checklist-service', () => ({
  ddChecklistService: {
    getChecklist: serviceMocks.getChecklist,
    createChecklist: serviceMocks.createChecklist,
    updateChecklistItem: serviceMocks.updateChecklistItem,
  },
}))

import { GET as getList, POST as postChecklist } from '@/app/api/dd/checklists/route'
import {
  GET as getOne,
  PUT as putItem,
  DELETE as deleteChecklist,
} from '@/app/api/dd/checklists/[id]/route'
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
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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

const createdAt = new Date('2024-01-01T00:00:00.000Z')
const updatedAt = new Date('2024-02-01T00:00:00.000Z')

const checklistRow = {
  id: 'c1',
  type: 'TAX_DD',
  fiscalYear: 2024,
  status: 'IN_PROGRESS',
  materiality: null,
  overallScore: null,
  createdAt,
  updatedAt,
  items: [
    {
      id: 'i1',
      category: 'TAX',
      itemCode: 'T-1',
      title: 'Check VAT',
      status: 'PENDING',
      severity: 'HIGH',
    },
  ],
}

describe('GET /api/dd/checklists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await getList(
      buildRequest('http://localhost/api/dd/checklists', 'GET', undefined)
    )

    expect(response.status).toBe(401)
    expect(dbMocks.dDChecklist.findMany).not.toHaveBeenCalled()
  })

  it('returns paginated checklists and serializes dates to ISO', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    dbMocks.dDChecklist.findMany.mockResolvedValue([checklistRow])
    dbMocks.dDChecklist.count.mockResolvedValue(1)

    const response = await getList(
      buildRequest(
        'http://localhost/api/dd/checklists?type=TAX_DD&page=1&limit=20',
        'GET',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('c1')
    expect(body.data[0].createdAt).toBe(createdAt.toISOString())
    expect(body.data[0].updatedAt).toBe(updatedAt.toISOString())
    expect(body.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })

    const where = dbMocks.dDChecklist.findMany.mock.calls[0][0].where
    expect(where).toEqual({ companyId: 'company-1', type: 'TAX_DD' })
  })
})

describe('POST /api/dd/checklists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when type or fiscalYear is missing', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postChecklist(
      buildRequest('http://localhost/api/dd/checklists', 'POST', 'session=valid-token', {
        type: 'TAX_DD',
      })
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.createChecklist).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid checklist type', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postChecklist(
      buildRequest('http://localhost/api/dd/checklists', 'POST', 'session=valid-token', {
        type: 'NOT_A_TYPE',
        fiscalYear: 2024,
      })
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.createChecklist).not.toHaveBeenCalled()
  })

  it('creates a checklist and serializes the created date', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.createChecklist.mockResolvedValue({
      success: true,
      data: {
        id: 'c1',
        type: 'TAX_DD',
        fiscalYear: 2024,
        status: 'IN_PROGRESS',
        materiality: null,
        createdAt,
      },
    })

    const response = await postChecklist(
      buildRequest('http://localhost/api/dd/checklists', 'POST', 'session=valid-token', {
        type: 'TAX_DD',
        fiscalYear: 2024,
        materialityThreshold: 1000,
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.id).toBe('c1')
    expect(body.data.createdAt).toBe(createdAt.toISOString())
    expect(serviceMocks.createChecklist).toHaveBeenCalledWith({
      type: 'TAX_DD',
      fiscalYear: 2024,
      companyId: 'company-1',
      materialityThreshold: 1000,
      skipItems: undefined,
      focusCategories: undefined,
      createdBy: 'user-1',
    })
  })

  it('surfaces a service failure as 400', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.createChecklist.mockResolvedValue({
      success: false,
      error: { message: 'Definitions missing' },
    })

    const response = await postChecklist(
      buildRequest('http://localhost/api/dd/checklists', 'POST', 'session=valid-token', {
        type: 'TAX_DD',
        fiscalYear: 2024,
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.message).toBe('Definitions missing')
  })
})

describe('GET /api/dd/checklists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the checklist does not exist', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.getChecklist.mockResolvedValue({
      success: false,
      error: { message: 'not found' },
    })

    const response = await getOne(
      buildRequest('http://localhost/api/dd/checklists/c1', 'GET', 'session=valid-token'),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(404)
  })

  it('returns 403 when the checklist belongs to another company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.getChecklist.mockResolvedValue({
      success: true,
      data: { ...checklistRow, companyId: 'company-2', items: [] },
    })

    const response = await getOne(
      buildRequest('http://localhost/api/dd/checklists/c1', 'GET', 'session=valid-token'),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(403)
  })

  it('returns the checklist with parsed findings for the owning company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const checkedAt = new Date('2024-03-01T00:00:00.000Z')
    serviceMocks.getChecklist.mockResolvedValue({
      success: true,
      data: {
        ...checklistRow,
        companyId: 'company-1',
        items: [
          {
            id: 'i1',
            category: 'TAX',
            itemCode: 'T-1',
            title: 'Check VAT',
            description: 'desc',
            status: 'PASSED',
            severity: 'HIGH',
            findings: '{"note":"ok"}',
            recommendation: 'rec',
            evidence: 'ev',
            checkedAt,
            checkedBy: 'user-1',
          },
        ],
      },
    })

    const response = await getOne(
      buildRequest('http://localhost/api/dd/checklists/c1', 'GET', 'session=valid-token'),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.items[0].findings).toEqual({ note: 'ok' })
    expect(body.data.items[0].checkedAt).toBe(checkedAt.toISOString())
    expect(body.data.createdAt).toBe(createdAt.toISOString())
  })
})

describe('PUT /api/dd/checklists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when itemId is missing', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.getChecklist.mockResolvedValue({
      success: true,
      data: { ...checklistRow, companyId: 'company-1', items: [] },
    })

    const response = await putItem(
      buildRequest('http://localhost/api/dd/checklists/c1', 'PUT', 'session=valid-token', {
        status: 'PASSED',
      }),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.updateChecklistItem).not.toHaveBeenCalled()
  })

  it('updates the item and serializes checkedAt', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.getChecklist.mockResolvedValue({
      success: true,
      data: { ...checklistRow, companyId: 'company-1', items: [] },
    })
    const checkedAt = new Date('2024-03-02T00:00:00.000Z')
    serviceMocks.updateChecklistItem.mockResolvedValue({
      success: true,
      data: { id: 'i1', status: 'PASSED', checkedAt },
    })

    const response = await putItem(
      buildRequest('http://localhost/api/dd/checklists/c1', 'PUT', 'session=valid-token', {
        itemId: 'i1',
        status: 'PASSED',
        findings: { note: 'ok' },
        recommendation: 'rec',
        evidence: 'ev',
      }),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.id).toBe('i1')
    expect(body.data.checkedAt).toBe(checkedAt.toISOString())
    expect(serviceMocks.updateChecklistItem).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({
        status: 'PASSED',
        findings: JSON.stringify({ note: 'ok' }),
        recommendation: 'rec',
        evidence: 'ev',
        checkedBy: 'user-1',
      })
    )
  })

  it('surfaces an item update failure as 400', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.getChecklist.mockResolvedValue({
      success: true,
      data: { ...checklistRow, companyId: 'company-1', items: [] },
    })
    serviceMocks.updateChecklistItem.mockResolvedValue({
      success: false,
      error: { message: 'cannot update' },
    })

    const response = await putItem(
      buildRequest('http://localhost/api/dd/checklists/c1', 'PUT', 'session=valid-token', {
        itemId: 'i1',
        status: 'PASSED',
      }),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(400)
    expect((await response.json()).error.message).toBe('cannot update')
  })
})

describe('DELETE /api/dd/checklists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the checklist does not exist', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    dbMocks.dDChecklist.findUnique.mockResolvedValue(null)

    const response = await deleteChecklist(
      buildRequest('http://localhost/api/dd/checklists/c1', 'DELETE', 'session=valid-token'),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(404)
    expect(dbMocks.dDChecklist.delete).not.toHaveBeenCalled()
  })

  it('returns 403 when the checklist belongs to another company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    dbMocks.dDChecklist.findUnique.mockResolvedValue({ companyId: 'company-2' })

    const response = await deleteChecklist(
      buildRequest('http://localhost/api/dd/checklists/c1', 'DELETE', 'session=valid-token'),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(403)
    expect(dbMocks.dDChecklist.delete).not.toHaveBeenCalled()
  })

  it('deletes the checklist for the owning company', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    dbMocks.dDChecklist.findUnique.mockResolvedValue({ companyId: 'company-1' })
    dbMocks.dDChecklist.delete.mockResolvedValue(undefined)

    const response = await deleteChecklist(
      buildRequest('http://localhost/api/dd/checklists/c1', 'DELETE', 'session=valid-token'),
      { params: Promise.resolve({ id: 'c1' }) }
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(dbMocks.dDChecklist.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })
})
