import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeJournal, getAuditStatus } from '@/services/audit/index'
import type { JournalEntry } from '@/types'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { auditStatus: 'PASSED' },
          { auditStatus: 'PASSED' },
          { auditStatus: 'FAILED' },
          { auditStatus: 'PENDING' },
        ]),
    },
  },
}))

describe('Audit Service', () => {
  describe('analyzeJournal', () => {
    const mockJournal: JournalEntry = {
      id: 'test-journal-1',
      entryDate: new Date('2024-01-15'),
      description: 'Test transaction',
      debitAccount: '普通預金',
      creditAccount: '売上高',
      amount: 10000,
      taxAmount: 1000,
      taxType: 'TAXABLE_10',
    }

    it('should return ERROR status when no document is attached', async () => {
      const result = await analyzeJournal(mockJournal, null)

      expect(result.status).toBe('ERROR')
      expect(result.issues).toContain('No document attached')
      expect(result.confidenceScore).toBe(0)
    })

    it('should return PASSED status when document matches journal', async () => {
      const documentContent = `
        請求書
        日付: 2024-01-15
        金額: ¥10,000
      `

      const result = await analyzeJournal(mockJournal, documentContent)

      expect(result.status).toBe('PASSED')
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7)
    })

    it('should return FAILED status when amount mismatch', async () => {
      const documentContent = `
        請求書
        日付: 2024-01-25
        金額: ¥50,000
      `

      const result = await analyzeJournal(mockJournal, documentContent)

      expect(result.status).toBe('FAILED')
      expect(result.confidenceScore).toBeLessThan(0.7)
      expect(result.issues.some((i) => i.includes('Amount mismatch'))).toBe(true)
    })

    it('should detect issues when date mismatch', async () => {
      const documentContent = `
        請求書
        日付: 2024-01-25
        金額: ¥10,000
      `

      const result = await analyzeJournal(mockJournal, documentContent)

      expect(result.issues.some((i) => i.includes('Date mismatch'))).toBe(true)
    })

    it('should calculate confidence score correctly', async () => {
      const documentContent = `
        請求書
        日付: 2024-01-15
        金額: ¥10,000
      `

      const result = await analyzeJournal(mockJournal, documentContent)

      expect(result.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(result.confidenceScore).toBeLessThanOrEqual(1)
    })
  })

  describe('getAuditStatus', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return correct audit status counts', async () => {
      const result = await getAuditStatus(
        'company-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      )

      expect(result.total).toBe(4)
      expect(result.passed).toBe(2)
      expect(result.failed).toBe(1)
      expect(result.pending).toBe(1)
    })
  })
})
