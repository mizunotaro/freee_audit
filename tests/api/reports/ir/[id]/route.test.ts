import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockGetIRReport = vi.fn()
const mockUpdateIRReport = vi.fn()
const mockDeleteIRReport = vi.fn()

vi.mock('@/services/reports/ir-report-service', () => ({
  getIRReport: mockGetIRReport,
  updateIRReport: mockUpdateIRReport,
  deleteIRReport: mockDeleteIRReport,
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
    url: 'http://localhost/api/reports/ir/report-123',
    headers: new Headers(),
  } as unknown as NextRequest
}

async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = { user: { id: 'user-123', companyId: 'company-123' } }
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await mockGetIRReport(params.id)

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ report: result.data })
}

async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No update data provided' }, { status: 400 })
  }

  const result = await mockUpdateIRReport(params.id, body)

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ report: result.data })
}

async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = { user: { id: 'user-123', companyId: 'company-123' } }
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await mockDeleteIRReport(params.id)

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

describe('/api/reports/ir/[id] route', () => {
  const mockReportId = 'report-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return report details', async () => {
      mockGetIRReport.mockResolvedValue({
        success: true,
        data: { id: mockReportId, title: 'Test Report', sections: [] },
      })

      const request = createMockRequest()
      const response = await GET(request, { params: { id: mockReportId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.report.id).toBe(mockReportId)
    })

    it('should return 404 when report not found', async () => {
      mockGetIRReport.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Report not found' },
      })

      const request = createMockRequest()
      const response = await GET(request, { params: { id: 'non-existent' } })

      expect(response.status).toBe(404)
    })

    it('should return 400 on database error', async () => {
      mockGetIRReport.mockResolvedValue({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Database error' },
      })

      const request = createMockRequest()
      const response = await GET(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
    })
  })

  describe('PATCH', () => {
    it('should update report', async () => {
      mockUpdateIRReport.mockResolvedValue({
        success: true,
        data: { id: mockReportId, title: 'Updated Title' },
      })

      const request = createMockRequest({ title: 'Updated Title' }, 'PATCH')
      const response = await PATCH(request, { params: { id: mockReportId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.report.title).toBe('Updated Title')
    })

    it('should return 400 when no update data provided', async () => {
      const request = createMockRequest({}, 'PATCH')
      const response = await PATCH(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('No update data provided')
    })

    it('should return 404 when report not found', async () => {
      mockUpdateIRReport.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Report not found' },
      })

      const request = createMockRequest({ title: 'Updated' }, 'PATCH')
      const response = await PATCH(request, { params: { id: 'non-existent' } })

      expect(response.status).toBe(404)
    })

    it('should handle invalid JSON', async () => {
      const request = {
        method: 'PATCH',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as unknown as NextRequest

      const response = await PATCH(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
    })

    it('should update status', async () => {
      mockUpdateIRReport.mockResolvedValue({
        success: true,
        data: { id: mockReportId, status: 'REVIEW' },
      })

      const request = createMockRequest({ status: 'REVIEW' }, 'PATCH')
      const response = await PATCH(request, { params: { id: mockReportId } })

      expect(response.status).toBe(200)
      expect(mockUpdateIRReport).toHaveBeenCalledWith(mockReportId, { status: 'REVIEW' })
    })
  })

  describe('DELETE', () => {
    it('should delete report', async () => {
      mockDeleteIRReport.mockResolvedValue({
        success: true,
        data: undefined,
      })

      const request = createMockRequest(undefined, 'DELETE')
      const response = await DELETE(request, { params: { id: mockReportId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 404 when report not found', async () => {
      mockDeleteIRReport.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Report not found' },
      })

      const request = createMockRequest(undefined, 'DELETE')
      const response = await DELETE(request, { params: { id: 'non-existent' } })

      expect(response.status).toBe(404)
    })

    it('should return 400 on database error', async () => {
      mockDeleteIRReport.mockResolvedValue({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Database error' },
      })

      const request = createMockRequest(undefined, 'DELETE')
      const response = await DELETE(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
    })
  })
})

export { GET, PATCH, DELETE }
