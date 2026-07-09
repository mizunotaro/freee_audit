import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  withRateLimit: (handler: unknown) => handler,
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const serviceMocks = vi.hoisted(() => ({
  detectInventoryAlerts: vi.fn(),
  analyzeInventoryTrend: vi.fn(),
  checkInventoryAdjustmentStatus: vi.fn(),
  getInventoryAdjustments: vi.fn(),
  createInventoryAdjustment: vi.fn(),
  skipInventoryAdjustment: vi.fn(),
}))
vi.mock('@/services/inventory/inventory-adjustment', () => ({
  detectInventoryAlerts: serviceMocks.detectInventoryAlerts,
  analyzeInventoryTrend: serviceMocks.analyzeInventoryTrend,
  checkInventoryAdjustmentStatus: serviceMocks.checkInventoryAdjustmentStatus,
  getInventoryAdjustments: serviceMocks.getInventoryAdjustments,
  createInventoryAdjustment: serviceMocks.createInventoryAdjustment,
  skipInventoryAdjustment: serviceMocks.skipInventoryAdjustment,
}))

import { GET, POST } from '@/app/api/inventory/route'
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
  method: 'GET' | 'POST',
  bearer: string | undefined,
  body?: unknown
): NextRequest {
  const headers: Record<string, string> = {}
  if (bearer) headers.authorization = `Bearer ${bearer}`
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

describe('GET /api/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no bearer token is present', async () => {
    const response = await GET(
      buildRequest('http://localhost/api/inventory?fiscalYear=2024', 'GET', undefined)
    )

    expect(response.status).toBe(401)
    expect(serviceMocks.getInventoryAdjustments).not.toHaveBeenCalled()
  })

  it('returns 401 when the session is invalid', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(null)

    const response = await GET(
      buildRequest('http://localhost/api/inventory?fiscalYear=2024', 'GET', 'expired-token')
    )

    expect(response.status).toBe(401)
    expect(serviceMocks.getInventoryAdjustments).not.toHaveBeenCalled()
  })

  it('returns alerts for the alerts action', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const alerts = [{ itemId: 'inv-1', severity: 'HIGH', message: 'overstock' }]
    serviceMocks.detectInventoryAlerts.mockResolvedValue(alerts)

    const response = await GET(
      buildRequest(
        'http://localhost/api/inventory?action=alerts&fiscalYear=2024&month=3',
        'GET',
        'valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.alerts).toEqual(alerts)
    expect(serviceMocks.detectInventoryAlerts).toHaveBeenCalledWith('company-1', 2024, 3)
  })

  it('returns the trend for the trend action', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const trend = [{ month: '2024-01', changeRate: 0.05 }]
    serviceMocks.analyzeInventoryTrend.mockResolvedValue(trend)

    const response = await GET(
      buildRequest(
        'http://localhost/api/inventory?action=trend&fiscalYear=2024',
        'GET',
        'valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.trend).toEqual(trend)
    expect(serviceMocks.analyzeInventoryTrend).toHaveBeenCalledWith('company-1', 2024)
  })

  it('returns the status for the status action', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const status = { required: true, openingBalance: 1000, closingBalance: 900 }
    serviceMocks.checkInventoryAdjustmentStatus.mockResolvedValue(status)

    const response = await GET(
      buildRequest(
        'http://localhost/api/inventory?action=status&fiscalYear=2024&month=3',
        'GET',
        'valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(status)
    expect(serviceMocks.checkInventoryAdjustmentStatus).toHaveBeenCalledWith('company-1', 2024, 3)
  })

  it('returns adjustments when only fiscalYear is given', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const adjustments = [{ id: 'adj-1', fiscalYear: 2024, month: 3 }]
    serviceMocks.getInventoryAdjustments.mockResolvedValue(adjustments)

    const response = await GET(
      buildRequest('http://localhost/api/inventory?fiscalYear=2024', 'GET', 'valid-token')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.adjustments).toEqual(adjustments)
    expect(serviceMocks.getInventoryAdjustments).toHaveBeenCalledWith('company-1', 2024)
  })

  it('returns 400 when no fiscalYear is given', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await GET(buildRequest('http://localhost/api/inventory', 'GET', 'valid-token'))

    expect(response.status).toBe(400)
    expect(serviceMocks.getInventoryAdjustments).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid query parameters', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await GET(
      buildRequest('http://localhost/api/inventory?fiscalYear=2024&month=99', 'GET', 'valid-token')
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.details).toBeDefined()
  })
})

describe('POST /api/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips an adjustment when action=skip', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.skipInventoryAdjustment.mockResolvedValue(undefined)

    const response = await POST(
      buildRequest('http://localhost/api/inventory', 'POST', 'valid-token', {
        action: 'skip',
        fiscalYear: 2024,
        month: 3,
        reason: 'no change',
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true })
    expect(serviceMocks.skipInventoryAdjustment).toHaveBeenCalledWith(
      'company-1',
      2024,
      3,
      'no change'
    )
  })

  it('returns 400 for an invalid skip payload', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await POST(
      buildRequest('http://localhost/api/inventory', 'POST', 'valid-token', {
        action: 'skip',
        month: 3,
      })
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.skipInventoryAdjustment).not.toHaveBeenCalled()
  })

  it('creates an adjustment and returns it', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const created = { id: 'adj-1', fiscalYear: 2024, month: 3, difference: -100 }
    serviceMocks.createInventoryAdjustment.mockResolvedValue(created)

    const response = await POST(
      buildRequest('http://localhost/api/inventory', 'POST', 'valid-token', {
        fiscalYear: 2024,
        month: 3,
        openingBalance: 1000,
        closingBalance: 900,
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.adjustment).toEqual(created)
    expect(serviceMocks.createInventoryAdjustment).toHaveBeenCalledWith({
      companyId: 'company-1',
      fiscalYear: 2024,
      month: 3,
      openingBalance: 1000,
      closingBalance: 900,
    })
  })

  it('returns 400 for an invalid create payload', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await POST(
      buildRequest('http://localhost/api/inventory', 'POST', 'valid-token', {
        fiscalYear: 2024,
        month: 3,
      })
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.createInventoryAdjustment).not.toHaveBeenCalled()
  })
})
