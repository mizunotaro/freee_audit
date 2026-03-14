import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockGetIRReports = vi.fn()
const mockCreateIRReport = vi.fn()

vi.mock('@/services/reports/ir-report-service', () => ({
  getIRReports: mockGetIRReports,
  createIRReport: mockCreateIRReport,
}))

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user-123', companyId: 'company-123' },
  }),
}))

const createMockRequest = (body?: object, method: string = 'GET'): NextRequest => {
  return {
    method,
    json: () => Promise.resolve(body || {}),
    url: 'http://localhost/api/reports/ir',
    headers: new Headers(),
  } as unknown as NextRequest
}

async function GET(request: NextRequest) {
  const session = { user: { id: 'user-123', companyId: 'company-123' } }
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fiscalYear = searchParams.get('fiscalYear')
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const filters: Record<string, unknown> = {}
  if (fiscalYear) filters.fiscalYear = parseInt(fiscalYear)
  if (status) filters.status = status
  if (search) filters.search = search

  const result = await mockGetIRReports(
    session.user.companyId,
    Object.keys(filters).length > 0 ? filters : undefined
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ reports: result.data })
}

async function POST(request: NextRequest) {
  const session = { user: { id: 'user-123', companyId: 'company-123' } }
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.fiscalYear || !body.title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (typeof body.fiscalYear !== 'number' || body.fiscalYear < 1900) {
    return NextResponse.json({ error: 'Invalid fiscalYear' }, { status: 400 })
  }

  const result = await mockCreateIRReport({
    companyId: session.user.companyId,
    fiscalYear: body.fiscalYear,
    title: body.title,
    summary: body.summary,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ report: result.data }, { status: 201 })
}

describe('/api/reports/ir route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return reports list', async () => {
      mockGetIRReports.mockResolvedValue({
        success: true,
        data: [{ id: 'report-1', title: '2024年度 IRレポート', status: 'DRAFT' }],
      })

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.reports).toHaveLength(1)
      expect(mockGetIRReports).toHaveBeenCalledWith('company-123', undefined)
    })

    it('should apply filters', async () => {
      mockGetIRReports.mockResolvedValue({
        success: true,
        data: [],
      })

      const request = {
        ...createMockRequest(),
        url: 'http://localhost/api/reports/ir?fiscalYear=2024&status=DRAFT&search=test',
      } as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockGetIRReports).toHaveBeenCalledWith('company-123', {
        fiscalYear: 2024,
        status: 'DRAFT',
        search: 'test',
      })
    })

    it('should return error when service fails', async () => {
      mockGetIRReports.mockResolvedValue({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Database error' },
      })

      const request = createMockRequest()
      const response = await GET(request)

      expect(response.status).toBe(400)
    })

    it('should handle empty filters', async () => {
      mockGetIRReports.mockResolvedValue({
        success: true,
        data: [],
      })

      const request = {
        ...createMockRequest(),
        url: 'http://localhost/api/reports/ir?fiscalYear=',
      } as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('POST', () => {
    it('should create report', async () => {
      mockCreateIRReport.mockResolvedValue({
        success: true,
        data: { id: 'report-1', title: 'Test Report' },
      })

      const request = createMockRequest({ fiscalYear: 2024, title: 'Test Report' }, 'POST')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.report.id).toBe('report-1')
    })

    it('should return error when fiscalYear is missing', async () => {
      const request = createMockRequest({ title: 'Test' }, 'POST')
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Missing required fields')
    })

    it('should return error when title is missing', async () => {
      const request = createMockRequest({ fiscalYear: 2024 }, 'POST')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should return error when fiscalYear is invalid', async () => {
      const request = createMockRequest({ fiscalYear: 1800, title: 'Test' }, 'POST')
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid fiscalYear')
    })

    it('should return error when service fails', async () => {
      mockCreateIRReport.mockResolvedValue({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Database error' },
      })

      const request = createMockRequest({ fiscalYear: 2024, title: 'Test' }, 'POST')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should handle invalid JSON', async () => {
      const request = {
        method: 'POST',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid JSON')
    })

    it('should include summary in creation', async () => {
      mockCreateIRReport.mockResolvedValue({
        success: true,
        data: { id: 'report-1', title: 'Test Report', summary: 'Summary' },
      })

      const request = createMockRequest(
        { fiscalYear: 2024, title: 'Test Report', summary: 'Summary' },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockCreateIRReport).toHaveBeenCalledWith(
        expect.objectContaining({ summary: 'Summary' })
      )
    })
  })
})

export { GET, POST }
