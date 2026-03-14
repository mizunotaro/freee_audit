import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockExportToPDF = vi.fn()
const mockExportToPPTX = vi.fn()

vi.mock('@/services/reports/ir-export-service', () => ({
  exportToPDF: mockExportToPDF,
  exportToPPTX: mockExportToPPTX,
}))

vi.mock('@/services/reports/ir-report-service', () => ({
  getIRReport: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'report-123', title: 'Test', sections: [{ id: 's1' }] },
  }),
}))

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user-123', companyId: 'company-123' },
  }),
}))

const createMockRequest = (body?: object): NextRequest => {
  return {
    method: 'POST',
    json: () => Promise.resolve(body || {}),
    url: 'http://localhost/api/reports/ir/report-123/export',
    headers: new Headers(),
  } as unknown as NextRequest
}

async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

  const format = body.format || 'pdf'
  const options = {
    language: body.language || 'ja',
    paperSize: body.paperSize || 'A4',
    orientation: body.orientation || 'portrait',
    includeCharts: body.includeCharts !== false,
  }

  if (!['pdf', 'pptx'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use pdf or pptx' }, { status: 400 })
  }

  if (!['ja', 'en', 'dual'].includes(options.language)) {
    return NextResponse.json({ error: 'Invalid language. Use ja, en, or dual' }, { status: 400 })
  }

  const result =
    format === 'pdf'
      ? await mockExportToPDF(params.id, options)
      : await mockExportToPPTX(params.id, options)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    downloadUrl: result.data.downloadUrl,
    filename: result.data.filename,
    expiresAt: result.data.expiresAt,
    fileSize: result.data.fileSize,
    mimeType: result.data.mimeType,
  })
}

describe('/api/reports/ir/[id]/export route', () => {
  const mockReportId = 'report-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should export to PDF', async () => {
      mockExportToPDF.mockResolvedValue({
        success: true,
        data: {
          downloadUrl: '/api/download/test',
          filename: 'ir_report_2024.pdf',
          expiresAt: new Date(),
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      })

      const request = createMockRequest({ format: 'pdf' })
      const response = await POST(request, { params: { id: mockReportId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toContain('.pdf')
      expect(data.mimeType).toBe('application/pdf')
    })

    it('should export to PPTX', async () => {
      mockExportToPPTX.mockResolvedValue({
        success: true,
        data: {
          downloadUrl: '/api/download/test',
          filename: 'ir_report_2024.pptx',
          expiresAt: new Date(),
          fileSize: 2048,
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        },
      })

      const request = createMockRequest({ format: 'pptx' })
      const response = await POST(request, { params: { id: mockReportId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toContain('.pptx')
    })

    it('should return error for invalid format', async () => {
      const request = createMockRequest({ format: 'docx' })
      const response = await POST(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid format')
    })

    it('should return error for invalid language', async () => {
      const request = createMockRequest({ language: 'fr' })
      const response = await POST(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('Invalid language')
    })

    it('should use default values', async () => {
      mockExportToPDF.mockResolvedValue({
        success: true,
        data: {
          downloadUrl: '/api/download/test',
          filename: 'test.pdf',
          expiresAt: new Date(),
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      })

      const request = createMockRequest({})
      const response = await POST(request, { params: { id: mockReportId } })

      expect(response.status).toBe(200)
      expect(mockExportToPDF).toHaveBeenCalledWith(
        mockReportId,
        expect.objectContaining({
          language: 'ja',
          paperSize: 'A4',
          orientation: 'portrait',
          includeCharts: true,
        })
      )
    })

    it('should handle invalid JSON', async () => {
      const request = {
        method: 'POST',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as unknown as NextRequest

      const response = await POST(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid JSON')
    })

    it('should return error when export fails', async () => {
      mockExportToPDF.mockResolvedValue({
        success: false,
        error: { code: 'EXPORT_ERROR', message: 'Export failed' },
      })

      const request = createMockRequest({ format: 'pdf' })
      const response = await POST(request, { params: { id: mockReportId } })

      expect(response.status).toBe(400)
    })

    it('should handle all language options', async () => {
      mockExportToPDF.mockResolvedValue({
        success: true,
        data: {
          downloadUrl: '/api/download/test',
          filename: 'test.pdf',
          expiresAt: new Date(),
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      })

      const languages = ['ja', 'en', 'dual']
      for (const language of languages) {
        const request = createMockRequest({ language })
        const response = await POST(request, { params: { id: mockReportId } })

        expect(response.status).toBe(200)
      }
    })

    it('should include charts when specified', async () => {
      mockExportToPDF.mockResolvedValue({
        success: true,
        data: {
          downloadUrl: '/api/download/test',
          filename: 'test.pdf',
          expiresAt: new Date(),
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      })

      const request = createMockRequest({ includeCharts: true })
      await POST(request, { params: { id: mockReportId } })

      expect(mockExportToPDF).toHaveBeenCalledWith(
        mockReportId,
        expect.objectContaining({ includeCharts: true })
      )
    })

    it('should exclude charts when specified', async () => {
      mockExportToPDF.mockResolvedValue({
        success: true,
        data: {
          downloadUrl: '/api/download/test',
          filename: 'test.pdf',
          expiresAt: new Date(),
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      })

      const request = createMockRequest({ includeCharts: false })
      await POST(request, { params: { id: mockReportId } })

      expect(mockExportToPDF).toHaveBeenCalledWith(
        mockReportId,
        expect.objectContaining({ includeCharts: false })
      )
    })
  })
})

export { POST }
