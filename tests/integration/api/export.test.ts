import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const exportMocks = vi.hoisted(() => ({
  exportCSV: vi.fn(),
  excelExport: vi.fn(),
  pdfExport: vi.fn(),
  pptxExport: vi.fn(),
  createExportService: vi.fn(),
}))

vi.mock('@/services/export', () => ({
  DEFAULT_EXPORT_OPTIONS: {
    format: 'excel',
    language: 'ja',
    currency: 'JPY',
    includeCharts: true,
    paperSize: 'A4',
    orientation: 'portrait',
  },
  createExcelExportService: () => ({
    export: exportMocks.excelExport,
    exportCSV: exportMocks.exportCSV,
  }),
  createExportService: exportMocks.createExportService,
}))

import { GET as csvGET } from '@/app/api/export/csv/route'
import { POST as excelPOST } from '@/app/api/export/excel/route'
import { POST as pdfPOST } from '@/app/api/export/pdf/route'
import { POST as pptxPOST } from '@/app/api/export/pptx/route'
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

const exportResult = {
  downloadUrl: 'https://example.com/files/export-abc',
  filename: 'report-2024.xlsx',
  expiresAt: new Date('2024-12-31T00:00:00.000Z'),
  fileSize: 4096,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function buildGet(query: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest(`http://localhost/api/export/csv?${query}`, { headers })
}

function buildPost(url: string, body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  const init: { method: string; headers: Record<string, string>; body: string } = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.clearAllMocks()
  exportMocks.createExportService.mockImplementation((format: string) => {
    if (format === 'pdf') return { success: true, data: { export: exportMocks.pdfExport } }
    if (format === 'pptx') return { success: true, data: { export: exportMocks.pptxExport } }
    return { success: false, error: { message: `Unsupported format: ${format}` } }
  })
})

describe('GET /api/export/csv', () => {
  it('returns 401 when no session cookie is present', async () => {
    const response = await csvGET(buildGet('reportType=balance_sheet&fiscalYear=2024'))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(exportMocks.exportCSV).not.toHaveBeenCalled()
  })

  it('returns 401 when the user has no company associated', async () => {
    vi.mocked(validateSession).mockResolvedValue({ ...authenticatedUser, companyId: null })

    const response = await csvGET(
      buildGet('reportType=balance_sheet&fiscalYear=2024', 'session=valid-token')
    )

    expect(response.status).toBe(401)
    expect(exportMocks.exportCSV).not.toHaveBeenCalled()
  })

  it('returns 400 when reportType or fiscalYear is missing', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await csvGET(buildGet('reportType=balance_sheet', 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'Missing required parameters: reportType, fiscalYear' })
    expect(exportMocks.exportCSV).not.toHaveBeenCalled()
  })

  it('generates a CSV export for an authenticated user', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    exportMocks.exportCSV.mockResolvedValue(exportResult)

    const response = await csvGET(
      buildGet(
        'reportType=balance_sheet&fiscalYear=2024&month=3&language=en',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      downloadUrl: exportResult.downloadUrl,
      expiresAt: '2024-12-31T00:00:00.000Z',
      fileSize: exportResult.fileSize,
      filename: exportResult.filename,
    })
    expect(exportMocks.exportCSV).toHaveBeenCalledTimes(1)
    expect(exportMocks.exportCSV).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        format: 'csv',
        language: 'en',
        currency: 'JPY',
        includeCharts: false,
      })
    )
    // CSV route does not audit
    expect(logRouteAudit).not.toHaveBeenCalled()
  })
})

describe('POST /api/export/excel', () => {
  it('returns 401 when no session cookie is present', async () => {
    const response = await excelPOST(
      buildPost('http://localhost/api/export/excel', {
        reportType: 'profit_loss',
        fiscalYear: 2024,
      })
    )

    expect(response.status).toBe(401)
    expect(exportMocks.excelExport).not.toHaveBeenCalled()
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await excelPOST(
      buildPost(
        'http://localhost/api/export/excel',
        { reportType: 'profit_loss' },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'Missing required fields: reportType, fiscalYear' })
    expect(exportMocks.excelExport).not.toHaveBeenCalled()
  })

  it('generates an Excel export and audits the request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    exportMocks.excelExport.mockResolvedValue(exportResult)

    const response = await excelPOST(
      buildPost(
        'http://localhost/api/export/excel',
        { reportType: 'profit_loss', fiscalYear: 2024, month: 6 },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      downloadUrl: exportResult.downloadUrl,
      expiresAt: '2024-12-31T00:00:00.000Z',
      fileSize: exportResult.fileSize,
      filename: exportResult.filename,
    })
    expect(exportMocks.excelExport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: 'excel' })
    )
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'EXPORT_EXCEL',
        resource: 'export',
        details: { reportType: 'profit_loss', fiscalYear: 2024 },
      })
    )
  })

  it('returns 500 and audits the failure when the export service throws', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    exportMocks.excelExport.mockRejectedValue(new Error('disk full'))

    const response = await excelPOST(
      buildPost(
        'http://localhost/api/export/excel',
        { reportType: 'profit_loss', fiscalYear: 2024 },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toEqual({ error: 'Failed to generate Excel' })
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPORT_EXCEL',
        result: 'FAILURE',
      })
    )
  })
})

describe('POST /api/export/pdf', () => {
  it('returns 400 when the export service cannot be created', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    exportMocks.createExportService.mockReturnValue({
      success: false,
      error: { message: 'PDF renderer unavailable' },
    })

    const response = await pdfPOST(
      buildPost(
        'http://localhost/api/export/pdf',
        { reportType: 'monthly', fiscalYear: 2024 },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'PDF renderer unavailable' })
    expect(exportMocks.pdfExport).not.toHaveBeenCalled()
  })

  it('generates a PDF export and audits the request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    exportMocks.pdfExport.mockResolvedValue(exportResult)

    const response = await pdfPOST(
      buildPost(
        'http://localhost/api/export/pdf',
        { reportType: 'monthly', fiscalYear: 2024, month: 3 },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.downloadUrl).toBe(exportResult.downloadUrl)
    expect(body.expiresAt).toBe('2024-12-31T00:00:00.000Z')
    expect(exportMocks.pdfExport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: 'pdf' })
    )
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXPORT_PDF',
        resource: 'export',
      })
    )
  })
})

describe('POST /api/export/pptx', () => {
  it('returns 400 when the export service cannot be created', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    exportMocks.createExportService.mockReturnValue({
      success: false,
      error: { message: 'PPTX renderer unavailable' },
    })

    const response = await pptxPOST(
      buildPost(
        'http://localhost/api/export/pptx',
        { reportType: 'monthly', fiscalYear: 2024 },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'PPTX renderer unavailable' })
    expect(exportMocks.pptxExport).not.toHaveBeenCalled()
  })

  it('generates a PowerPoint export and audits the request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    exportMocks.pptxExport.mockResolvedValue(exportResult)

    const response = await pptxPOST(
      buildPost(
        'http://localhost/api/export/pptx',
        { reportType: 'balance_sheet', fiscalYear: 2024 },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.filename).toBe(exportResult.filename)
    expect(body.expiresAt).toBe('2024-12-31T00:00:00.000Z')
    expect(exportMocks.pptxExport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ format: 'pptx' })
    )
    expect(logRouteAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXPORT_PPTX' }))
  })
})
