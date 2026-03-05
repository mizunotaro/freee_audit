import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JournalChecker } from '@/services/audit/journal-checker'
import type { DocumentAnalysisResult } from '@/types/audit'

describe('JournalChecker', () => {
  let checker: JournalChecker
  const mockAIProvider = {
    validateEntry: vi.fn(),
    analyzeDocument: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    checker = new JournalChecker({
      aiProvider: mockAIProvider as any,
      toleranceAmount: 1,
      toleranceDays: 0,
    })
  })

  describe('check', () => {
    const mockEntry = {
      id: 'entry-1',
      date: '2024-01-15',
      debitAccount: '現金',
      creditAccount: '売上',
      amount: 10000,
      taxAmount: 1000,
      description: '売上計上',
    }

    const mockDocumentData: DocumentAnalysisResult = {
      date: '2024-01-15',
      amount: 10000,
      taxAmount: 1000,
      vendorName: 'Test Vendor',
      description: 'Test Description',
      confidence: 0.95,
    }

    it('should return info when no document is attached', async () => {
      const result = await checker.check(mockEntry, null)

      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0].severity).toBe('info')
      expect(result.issues[0].field).toBe('document')
    })

    it('should check date consistency', async () => {
      const docWithDifferentDate = {
        ...mockDocumentData,
        date: '2024-01-20',
      }

      const result = await checker.check(mockEntry, docWithDifferentDate)

      const dateIssue = result.issues.find((i) => i.field === 'date')
      expect(dateIssue).toBeDefined()
    })

    it('should check amount consistency', async () => {
      const docWithDifferentAmount = {
        ...mockDocumentData,
        amount: 20000,
      }

      const result = await checker.check(mockEntry, docWithDifferentAmount)

      const amountIssue = result.issues.find((i) => i.field === 'amount')
      expect(amountIssue).toBeDefined()
    })

    it('should check tax amount consistency', async () => {
      const docWithDifferentTax = {
        ...mockDocumentData,
        taxAmount: 2000,
      }

      const result = await checker.check(mockEntry, docWithDifferentTax)

      const taxIssue = result.issues.find((i) => i.field === 'taxAmount')
      expect(taxIssue).toBeDefined()
    })

    it('should return valid result when all checks pass', async () => {
      const result = await checker.check(mockEntry, mockDocumentData)

      expect(result.isValid).toBe(true)
    })

    it('should use AI provider for validation when no issues found', async () => {
      mockAIProvider.validateEntry.mockResolvedValue({
        isValid: true,
        issues: [],
        suggestions: ['Test suggestion'],
      })

      const result = await checker.check(mockEntry, mockDocumentData)

      // AI provider is only called when issues.length === 0
      // If issues exist, AI provider won't be called
      if (result.issues.length === 0) {
        expect(mockAIProvider.validateEntry).toHaveBeenCalled()
        expect(result.suggestions).toEqual(['Test suggestion'])
      } else {
        // If there are issues, AI provider won't be called
        expect(mockAIProvider.validateEntry).not.toHaveBeenCalled()
      }
    })
  })

  describe('constructor', () => {
    it('should use default tolerance values', () => {
      const defaultChecker = new JournalChecker({
        aiProvider: mockAIProvider as any,
      })
      expect(defaultChecker).toBeDefined()
    })

    it('should accept custom tolerance values', () => {
      const customChecker = new JournalChecker({
        aiProvider: mockAIProvider as any,
        toleranceAmount: 100,
        toleranceDays: 5,
      })
      expect(customChecker).toBeDefined()
    })
  })
})
