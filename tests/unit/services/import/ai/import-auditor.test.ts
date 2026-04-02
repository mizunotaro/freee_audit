import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportAuditor } from '@/services/import/ai/import-auditor'
import type { ImportAuditContext, ImportAuditIssue } from '@/services/import/ai/types'

function createMockDetector() {
  return {
    detectDuplicates: vi.fn().mockReturnValue([]),
    detectAmountAnomalies: vi.fn().mockReturnValue([]),
    detectDateIssues: vi.fn().mockReturnValue([]),
    detectTaxIssues: vi.fn().mockReturnValue([]),
    detectBalanceIssues: vi.fn().mockReturnValue([]),
  }
}

describe('ImportAuditor', () => {
  let auditor: ImportAuditor
  let mockDetector: ReturnType<typeof createMockDetector>

  beforeEach(() => {
    mockDetector = createMockDetector()
    auditor = new ImportAuditor(mockDetector as any)
  })

  describe('audit', () => {
    const defaultContext: ImportAuditContext = {
      importType: 'journal',
      companyId: 'co-1',
      language: 'ja',
    }

    it('should return successful audit for clean data', async function () {
      const rows = [
        {
          entryDate: '2024-01-15',
          description: 'Test',
          amount: 1000,
          debitAccount: 'Cash',
          creditAccount: 'Rev',
          taxAmount: 100,
          taxType: '10%',
        },
      ]

      const result = await auditor.audit(rows, defaultContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.success).toBe(true)
        expect(result.data.summary.totalRows).toBe(1)
        expect(result.data.summary.validRows).toBe(1)
        expect(result.data.riskScore).toBe(0)
      }
    })

    it('should detect duplicate entries', async function () {
      const duplicateIssue: ImportAuditIssue = {
        id: 'dup-1',
        row: 2,
        type: 'duplicate_entry',
        severity: 'high',
        category: 'accuracy',
        message: 'Duplicate entry detected',
        messageJa: '重複エントリが検出されました',
      }
      mockDetector.detectDuplicates.mockReturnValue([duplicateIssue])

      const rows = [
        {
          entryDate: '2024-01-15',
          description: 'Test',
          amount: 1000,
          debitAccount: 'Cash',
          creditAccount: 'Rev',
          taxAmount: 100,
          taxType: '10%',
        },
        {
          entryDate: '2024-01-15',
          description: 'Test',
          amount: 1000,
          debitAccount: 'Cash',
          creditAccount: 'Rev',
          taxAmount: 100,
          taxType: '10%',
        },
      ]

      const result = await auditor.audit(rows, defaultContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.summary.highIssues).toBe(1)
        expect(result.data.issues).toHaveLength(1)
      }
    })

    it('should detect critical issues', async function () {
      const criticalIssue: ImportAuditIssue = {
        id: 'crit-1',
        row: 2,
        type: 'balance_mismatch',
        severity: 'critical',
        category: 'consistency',
        message: 'Balance mismatch',
        messageJa: 'バランス不一致',
      }
      mockDetector.detectBalanceIssues.mockReturnValue([criticalIssue])

      const rows = [
        {
          entryDate: '2024-01-15',
          description: 'Test',
          amount: 1000,
          debitAccount: 'Cash',
          creditAccount: 'Rev',
          taxAmount: 100,
          taxType: '10%',
        },
      ]

      const result = await auditor.audit(rows, defaultContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.success).toBe(false)
        expect(result.data.summary.criticalIssues).toBe(1)
      }
    })

    it('should skip journal-specific checks for non-journal imports', async function () {
      const nonJournalContext: ImportAuditContext = {
        importType: 'account_item',
        companyId: 'co-1',
        language: 'ja',
      }

      const rows = [{ amount: 1000 }]

      await auditor.audit(rows, nonJournalContext)

      expect(mockDetector.detectAmountAnomalies).not.toHaveBeenCalled()
      expect(mockDetector.detectDateIssues).not.toHaveBeenCalled()
      expect(mockDetector.detectTaxIssues).not.toHaveBeenCalled()
      expect(mockDetector.detectBalanceIssues).not.toHaveBeenCalled()
    })

    it('should detect long descriptions as business rule violations', async function () {
      const longDesc = 'a'.repeat(201)
      const rows = [
        {
          description: longDesc,
          amount: 1000,
          debitAccount: 'Cash',
          creditAccount: 'Rev',
          taxAmount: 0,
          taxType: '',
          entryDate: '2024-01-01',
        },
      ]

      const result = await auditor.audit(
        rows,
        { ...defaultContext },
        {
          checkBusinessRules: true,
          checkDuplicates: false,
          checkAmountAnomalies: false,
          checkDateValidity: false,
          checkTaxCalculations: false,
          checkBalanceConsistency: false,
        }
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.issues.some((i) => i.type === 'format_error')).toBe(true)
      }
    })

    it('should limit issues to maxIssuesToReport', async function () {
      const issues: ImportAuditIssue[] = Array.from({ length: 20 }, (_, i) => ({
        id: `dup-${i}`,
        row: i + 2,
        type: 'duplicate_entry' as const,
        severity: 'low' as const,
        category: 'accuracy' as const,
        message: `Duplicate ${i}`,
        messageJa: `重複 ${i}`,
      }))
      mockDetector.detectDuplicates.mockReturnValue(issues)

      const rows = Array.from({ length: 20 }, (_, i) => ({
        entryDate: '2024-01-15',
        description: `Entry ${i}`,
        amount: 1000,
        debitAccount: 'Cash',
        creditAccount: 'Rev',
        taxAmount: 0,
        taxType: '',
      }))

      const result = await auditor.audit(rows, defaultContext, { maxIssuesToReport: 5 })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.issues.length).toBeLessThanOrEqual(5)
      }
    })

    it('should generate recommendations for issues', async function () {
      const criticalIssue: ImportAuditIssue = {
        id: 'crit-1',
        row: 2,
        type: 'format_error',
        severity: 'critical',
        category: 'completeness',
        message: 'Critical error',
        messageJa: '重大エラー',
      }
      mockDetector.detectDuplicates.mockReturnValue([criticalIssue])

      const rows = [
        {
          entryDate: '2024-01-15',
          description: 'Test',
          amount: 1000,
          debitAccount: 'Cash',
          creditAccount: 'Rev',
          taxAmount: 0,
          taxType: '',
        },
      ]

      const result = await auditor.audit(rows, defaultContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.recommendations.length).toBeGreaterThan(0)
        expect(result.data.recommendations[0].priority).toBe('critical')
      }
    })

    it('should calculate risk score', async function () {
      const highIssue: ImportAuditIssue = {
        id: 'high-1',
        row: 2,
        type: 'unusual_amount',
        severity: 'high',
        category: 'accuracy',
        message: 'Unusual amount',
        messageJa: '異常金額',
      }
      mockDetector.detectDuplicates.mockReturnValue([highIssue])

      const rows = [
        {
          entryDate: '2024-01-15',
          description: 'Test',
          amount: 1000,
          debitAccount: 'Cash',
          creditAccount: 'Rev',
          taxAmount: 0,
          taxType: '',
        },
      ]

      const result = await auditor.audit(rows, defaultContext)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.riskScore).toBeGreaterThan(0)
      }
    })

    it('should return failure on unexpected errors', async function () {
      mockDetector.detectDuplicates.mockImplementation(function () {
        throw new Error('Unexpected')
      })

      const result = await auditor.audit([], defaultContext)

      expect(result.success).toBe(false)
    })
  })
})
