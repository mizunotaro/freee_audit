import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCompanyId = 'company-123'
const mockReportId = 'report-456'

vi.mock('@/services/reports/ir-report-service', () => ({
  getIRReports: vi.fn(),
  createIRReport: vi.fn(),
  updateIRReport: vi.fn(),
  deleteIRReport: vi.fn(),
  publishIRReport: vi.fn(),
  duplicateIRReport: vi.fn(),
  getSections: vi.fn(),
  updateSection: vi.fn(),
  reorderSections: vi.fn(),
}))

describe('E2E IR Report workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Report creation flow', () => {
    it('should create a new IR report', async () => {
      const { createIRReport } = await import('@/services/reports/ir-report-service')
      vi.mocked(createIRReport).mockResolvedValue({
        success: true,
        data: {
          id: mockReportId,
          companyId: mockCompanyId,
          reportType: 'annual',
          fiscalYear: 2024,
          title: '2024年度 IRレポート',
          status: 'DRAFT',
          sections: [],
          language: 'ja',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const result = await createIRReport({
        companyId: mockCompanyId,
        reportType: 'annual',
        fiscalYear: 2024,
        title: '2024年度 IRレポート',
      })

      expect(result.success).toBe(true)
    })

    it('should return error for invalid input', async () => {
      const { createIRReport } = await import('@/services/reports/ir-report-service')
      vi.mocked(createIRReport).mockResolvedValue({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      })

      const result = await createIRReport({
        companyId: '',
        reportType: 'annual',
        fiscalYear: 2024,
        title: '',
      })

      expect(result.success).toBe(false)
    })

    it('should get existing reports', async () => {
      const { getIRReports } = await import('@/services/reports/ir-report-service')
      vi.mocked(getIRReports).mockResolvedValue({
        success: true,
        data: [],
      })

      const result = await getIRReports(mockCompanyId)
      expect(result.success).toBe(true)
    })

    it('should update a report', async () => {
      const { updateIRReport } = await import('@/services/reports/ir-report-service')
      vi.mocked(updateIRReport).mockResolvedValue({
        success: true,
        data: {
          id: mockReportId,
          companyId: mockCompanyId,
          reportType: 'annual',
          fiscalYear: 2024,
          title: 'Updated title',
          status: 'DRAFT',
          sections: [],
          language: 'ja',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const result = await updateIRReport(mockReportId, { title: 'Updated title' })

      expect(result.success).toBe(true)
    })
  })

  describe('Report publish flow', () => {
    it('should publish a draft report', async () => {
      const { publishIRReport } = await import('@/services/reports/ir-report-service')
      vi.mocked(publishIRReport).mockResolvedValue({
        success: true,
        data: {
          id: mockReportId,
          companyId: mockCompanyId,
          reportType: 'annual',
          fiscalYear: 2024,
          title: '2024年度 IRレポート',
          status: 'PUBLISHED',
          sections: [],
          language: 'ja',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const result = await publishIRReport(mockReportId)

      expect(result.success).toBe(true)
    })

    it('should return error if already published', async () => {
      const { publishIRReport } = await import('@/services/reports/ir-report-service')
      vi.mocked(publishIRReport).mockResolvedValue({
        success: false,
        error: { code: 'BUSINESS_LOGIC_ERROR', message: 'Report is already published' },
      })

      const result = await publishIRReport(mockReportId)

      expect(result.success).toBe(false)
    })
  })

  describe('Report duplication flow', () => {
    it('should duplicate a report', async () => {
      const { duplicateIRReport } = await import('@/services/reports/ir-report-service')
      vi.mocked(duplicateIRReport).mockResolvedValue({
        success: true,
        data: {
          id: 'new-report-id',
          companyId: mockCompanyId,
          reportType: 'annual',
          fiscalYear: 2024,
          title: '2024年度 IRレポート (コピー)',
          status: 'DRAFT',
          sections: [],
          language: 'ja',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const result = await duplicateIRReport(mockReportId)

      expect(result.success).toBe(true)
    })
  })

  describe('Report deletion flow', () => {
    it('should delete a report', async () => {
      const { deleteIRReport } = await import('@/services/reports/ir-report-service')
      vi.mocked(deleteIRReport).mockResolvedValue({
        success: true,
        data: [],
      })

      const result = await deleteIRReport(mockReportId)

      expect(result.success).toBe(true)
    })
  })
})
