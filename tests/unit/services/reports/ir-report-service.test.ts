import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import {
  getIRReports,
  getIRReport,
  createIRReport,
  updateIRReport,
  deleteIRReport,
  publishIRReport,
  duplicateIRReport,
  getSections,
  updateSection,
  reorderSections,
} from '@/services/reports/ir-report-service'
import type { IRReportFilters, CreateIRReportData, UpdateIRReportData } from '@/types/ir-report'

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn((fn) =>
      fn({
        iRReport: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
        iRReportSection: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
          update: vi.fn(),
          deleteMany: vi.fn(),
        },
      })
    ),
    iRReport: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    iRReportSection: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe('IRReportService', () => {
  const mockCompanyId = 'company-123'
  const mockReportId = 'report-456'

  const mockReport = {
    id: mockReportId,
    companyId: mockCompanyId,
    fiscalYear: 2024,
    title: '2024年度 IRレポート',
    summary: 'Test summary',
    status: 'DRAFT',
    publishedAt: null,
    archivedAt: null,
    sections: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockSections = [
    {
      id: 'section-1',
      reportId: mockReportId,
      sectionType: 'COMPANY_OVERVIEW',
      title: '会社概要',
      content: 'Content here',
      data: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'section-2',
      reportId: mockReportId,
      sectionType: 'FINANCIAL_HIGHLIGHTS',
      title: '財務ハイライト',
      content: 'Financial content',
      data: null,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getIRReports', () => {
    it('should return success with reports list', async () => {
      const mockReports = [{ ...mockReport, sections: undefined }]
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findMany: vi.fn().mockResolvedValue(mockReports),
          },
        }
        return fn(tx)
      })

      const result = await getIRReports(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockReports)
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await getIRReports('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('companyId is required')
      }
    })

    it('should return failure when companyId is not a string', async () => {
      const result = await getIRReports(null as any)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should apply fiscalYear filter', async () => {
      const mockReports = [{ ...mockReport, fiscalYear: 2024, sections: undefined }]
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findMany: vi.fn().mockResolvedValue(mockReports),
          },
        }
        return fn(tx)
      })

      const filters: IRReportFilters = { fiscalYear: 2024 }
      const result = await getIRReports(mockCompanyId, filters)

      expect(result.success).toBe(true)
    })

    it('should apply status filter', async () => {
      const mockReports = [{ ...mockReport, status: 'PUBLISHED', sections: undefined }]
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findMany: vi.fn().mockResolvedValue(mockReports),
          },
        }
        return fn(tx)
      })

      const filters: IRReportFilters = { status: 'PUBLISHED' }
      const result = await getIRReports(mockCompanyId, filters)

      expect(result.success).toBe(true)
    })

    it('should apply search filter', async () => {
      const mockReports = [{ ...mockReport, sections: undefined }]
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findMany: vi.fn().mockResolvedValue(mockReports),
          },
        }
        return fn(tx)
      })

      const filters: IRReportFilters = { search: '2024' }
      const result = await getIRReports(mockCompanyId, filters)

      expect(result.success).toBe(true)
    })

    it('should return failure on database error', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database error'))

      const result = await getIRReports(mockCompanyId)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('getIRReport', () => {
    it('should return success with report details', async () => {
      const reportWithSections = { ...mockReport, sections: mockSections }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findUnique: vi.fn().mockResolvedValue(reportWithSections),
          },
        }
        return fn(tx)
      })

      const result = await getIRReport(mockReportId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(mockReportId)
        expect(result.data.sections).toHaveLength(2)
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await getIRReport('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when report not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        }
        return fn(tx)
      })

      const result = await getIRReport('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('createIRReport', () => {
    const createData: CreateIRReportData = {
      companyId: mockCompanyId,
      reportType: 'annual',
      fiscalYear: 2024,
      title: '2024年度 IRレポート',
    }

    it('should return success with created report', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            create: vi.fn().mockResolvedValue({ ...mockReport, sections: [] }),
          },
        }
        return fn(tx)
      })

      const result = await createIRReport(createData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe(createData.title)
        expect(result.data.status).toBe('DRAFT')
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await createIRReport({ ...createData, companyId: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Missing required fields')
      }
    })

    it('should return failure when fiscalYear is missing', async () => {
      const result = await createIRReport({ ...createData, fiscalYear: undefined as any })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when title is missing', async () => {
      const result = await createIRReport({ ...createData, title: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when fiscalYear is invalid', async () => {
      const result = await createIRReport({ ...createData, fiscalYear: 1800 })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Invalid fiscalYear')
      }
    })

    it('should create report with summary', async () => {
      const dataWithSummary = { ...createData, summary: 'Test summary' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            create: vi
              .fn()
              .mockResolvedValue({ ...mockReport, summary: 'Test summary', sections: [] }),
          },
        }
        return fn(tx)
      })

      const result = await createIRReport(dataWithSummary)

      expect(result.success).toBe(true)
    })
  })

  describe('updateIRReport', () => {
    const updateData: UpdateIRReportData = {
      title: 'Updated Title',
    }

    it('should return success with updated report', async () => {
      vi.mocked(prisma.$transaction)
        .mockImplementationOnce(async (fn: any) => {
          const tx = {
            iRReport: {
              findUnique: vi.fn().mockResolvedValue(mockReport),
            },
          }
          return fn(tx)
        })
        .mockImplementationOnce(async (fn: any) => {
          const tx = {
            iRReport: {
              update: vi
                .fn()
                .mockResolvedValue({ ...mockReport, ...updateData, sections: mockSections }),
            },
          }
          return fn(tx)
        })

      const result = await updateIRReport(mockReportId, updateData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Updated Title')
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await updateIRReport('', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when no update data provided', async () => {
      const result = await updateIRReport(mockReportId, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('No update data provided')
      }
    })

    it('should return failure when report not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        }
        return fn(tx)
      })

      const result = await updateIRReport('non-existent', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('deleteIRReport', () => {
    it('should return success when report deleted', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            delete: vi.fn().mockResolvedValue(mockReport),
          },
          iRReportSection: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        }
        return fn(tx)
      })

      const result = await deleteIRReport(mockReportId)

      expect(result.success).toBe(true)
    })

    it('should return failure when id is missing', async () => {
      const result = await deleteIRReport('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure on database error', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database error'))

      const result = await deleteIRReport(mockReportId)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR')
      }
    })
  })

  describe('publishIRReport', () => {
    it('should return success with published report', async () => {
      const publishedReport = {
        ...mockReport,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        sections: mockSections,
      }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findUnique: vi.fn().mockResolvedValue(mockReport),
            update: vi.fn().mockResolvedValue(publishedReport),
          },
        }
        return fn(tx)
      })

      const result = await publishIRReport(mockReportId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('PUBLISHED')
        expect(result.data.publishedAt).toBeDefined()
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await publishIRReport('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when report not found', async () => {
      vi.mocked(prisma.$transaction)
        .mockImplementation(async (fn: any) => {
          const tx = {
            iRReport: {
              findUnique: vi.fn().mockResolvedValue(null),
              update: vi.fn(),
            },
          }
          const result = await fn(tx)
          return result
        })
        .mockImplementation(async (fn: any) => {
          const tx = {
            iRReport: {
              findUnique: vi.fn().mockResolvedValue(null),
              update: vi.fn(),
            },
          }
          return fn(tx)
        })

      const result = await publishIRReport('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('should return failure when already published', async () => {
      const alreadyPublished = { ...mockReport, status: 'PUBLISHED' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findUnique: vi.fn().mockResolvedValue(alreadyPublished),
            update: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await publishIRReport(mockReportId)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('BUSINESS_LOGIC_ERROR')
        expect(result.error.message).toBe('Report is already published')
      }
    })
  })

  describe('duplicateIRReport', () => {
    it('should return success with duplicated report', async () => {
      const originalReport = { ...mockReport, sections: mockSections }
      const duplicatedReport = {
        ...mockReport,
        id: 'new-report-id',
        title: `${mockReport.title} (コピー)`,
        status: 'DRAFT',
        sections: mockSections,
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findUnique: vi.fn().mockResolvedValue(originalReport),
            create: vi.fn().mockResolvedValue(duplicatedReport),
          },
        }
        return fn(tx)
      })

      const result = await duplicateIRReport(mockReportId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toContain('(コピー)')
        expect(result.data.status).toBe('DRAFT')
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await duplicateIRReport('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when report not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReport: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await duplicateIRReport('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('getSections', () => {
    it('should return success with sections list', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReportSection: {
            findMany: vi.fn().mockResolvedValue(mockSections),
          },
        }
        return fn(tx)
      })

      const result = await getSections(mockReportId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(2)
      }
    })

    it('should return failure when reportId is missing', async () => {
      const result = await getSections('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return empty array when no sections', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReportSection: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        }
        return fn(tx)
      })

      const result = await getSections(mockReportId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([])
      }
    })
  })

  describe('updateSection', () => {
    it('should return success with updated section', async () => {
      const updatedSection = { ...mockSections[0], content: 'Updated content' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReportSection: {
            findFirst: vi.fn().mockResolvedValue(mockSections[0]),
            update: vi.fn().mockResolvedValue(updatedSection),
          },
        }
        return fn(tx)
      })

      const result = await updateSection(mockReportId, 'overview', {
        content: 'Updated content',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toBe('Updated content')
      }
    })

    it('should return failure when reportId is missing', async () => {
      const result = await updateSection('', 'overview', { content: 'test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when sectionType is missing', async () => {
      const result = await updateSection(mockReportId, '' as any, { content: 'test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when no update data provided', async () => {
      const result = await updateSection(mockReportId, 'overview', {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when section not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReportSection: {
            findFirst: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await updateSection(mockReportId, 'overview', { content: 'test' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('reorderSections', () => {
    it('should return success when sections reordered', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReportSection: {
            findMany: vi.fn().mockResolvedValue(mockSections),
            update: vi.fn().mockResolvedValue(mockSections[0]),
          },
        }
        return fn(tx)
      })

      const result = await reorderSections(mockReportId, {
        sectionIds: ['section-2', 'section-1'],
      })

      expect(result.success).toBe(true)
    })

    it('should return failure when reportId is missing', async () => {
      const result = await reorderSections('', { sectionIds: ['section-1'] })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when sectionIds is missing', async () => {
      const result = await reorderSections(mockReportId, {} as any)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('sectionIds array is required')
      }
    })

    it('should return failure when sectionIds is not an array', async () => {
      const result = await reorderSections(mockReportId, { sectionIds: 'not-array' as any })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when invalid section ID in order', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iRReportSection: {
            findMany: vi.fn().mockResolvedValue(mockSections),
            update: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await reorderSections(mockReportId, {
        sectionIds: ['invalid-section-id'],
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Invalid section ID')
      }
    })
  })
})
