import { describe, it, expect } from 'vitest'
import {
  exportIRReportToPDF,
  exportIRReportSectionsToPDF,
} from '@/services/reports/ir-pdf-exporter'
import {
  exportIRReportToPPTX,
  exportIRReportSectionsToPPTX,
} from '@/services/reports/ir-pptx-exporter'
import type { IRReport, IRReportSection } from '@/types/ir-report'

function createMockReport(overrides: Partial<IRReport> = {}): IRReport {
  return {
    id: 'test-report-1',
    companyId: 'company-1',
    reportType: 'annual',
    title: 'Test IR Report',
    fiscalYear: 2024,
    summary: 'Test summary',
    status: 'DRAFT',
    language: 'ja',
    sections: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function createMockSection(overrides: Partial<IRReportSection> = {}): IRReportSection {
  return {
    id: 'section-1',
    reportId: 'test-report-1',
    sectionType: 'overview',
    title: 'Company Overview',
    content: 'This is a test content for the company overview section.',
    sortOrder: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

describe('IR Export Services - Input Validation', () => {
  describe('PDF Exporter Validation', () => {
    it('should fail with invalid report (missing id)', async () => {
      const report = createMockReport({ id: '' })
      const result = await exportIRReportToPDF(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('missing id')
      }
    })

    it('should fail with invalid report (missing title)', async () => {
      const report = createMockReport({ title: '' })
      const result = await exportIRReportToPDF(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('missing title')
      }
    })

    it('should fail with invalid fiscal year', async () => {
      const report = createMockReport({ fiscalYear: 1800 })
      const result = await exportIRReportToPDF(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('invalid fiscalYear')
      }
    })

    it('should fail with invalid sections type', async () => {
      const report = createMockReport({ sections: 'invalid' as unknown as IRReportSection[] })
      const result = await exportIRReportToPDF(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('sections must be an array')
      }
    })

    it('should fail with invalid sections in exportIRReportSectionsToPDF', async () => {
      const result = await exportIRReportSectionsToPDF(
        'invalid' as unknown as IRReportSection[],
        { title: 'Test', fiscalYear: 2024, companyName: 'Test' },
        { language: 'ja' }
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Sections must be an array')
      }
    })
  })

  describe('PPTX Exporter Validation', () => {
    it('should fail with invalid report (missing id)', async () => {
      const report = createMockReport({ id: '' })
      const result = await exportIRReportToPPTX(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('missing id')
      }
    })

    it('should fail with invalid report (missing title)', async () => {
      const report = createMockReport({ title: '' })
      const result = await exportIRReportToPPTX(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('missing title')
      }
    })

    it('should fail with invalid fiscal year', async () => {
      const report = createMockReport({ fiscalYear: 1800 })
      const result = await exportIRReportToPPTX(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('invalid fiscalYear')
      }
    })

    it('should fail with invalid sections type', async () => {
      const report = createMockReport({ sections: 'invalid' as unknown as IRReportSection[] })
      const result = await exportIRReportToPPTX(report, { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('sections must be an array')
      }
    })

    it('should fail with too many sections', async () => {
      const sections = Array(150)
        .fill(null)
        .map((_, i) => createMockSection({ id: `s${i}` }))
      const result = await exportIRReportToPPTX(createMockReport({ sections }), { language: 'ja' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Too many sections')
      }
    })

    it('should fail with invalid sections in exportIRReportSectionsToPPTX', async () => {
      const result = await exportIRReportSectionsToPPTX(
        'invalid' as unknown as IRReportSection[],
        { title: 'Test', fiscalYear: 2024, companyName: 'Test' },
        { language: 'ja' }
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('Sections must be an array')
      }
    })
  })
})
