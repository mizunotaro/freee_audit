import { describe, it, expect, beforeEach } from 'vitest'
import { IssueDetector } from '@/services/import/ai/issue-detector'

describe('IssueDetector', () => {
  let detector: IssueDetector

  beforeEach(() => {
    detector = new IssueDetector()
  })

  describe('detectDuplicates', () => {
    it('should detect duplicate journal entries', () => {
      const rows = [
        {
          row: 2,
          data: {
            entryDate: '2024-01-15',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 10000,
          },
        },
        {
          row: 3,
          data: {
            entryDate: '2024-01-15',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 10000,
          },
        },
        {
          row: 4,
          data: {
            entryDate: '2024-01-16',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 20000,
          },
        },
      ]

      const issues = detector.detectDuplicates(rows)

      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('duplicate_entry')
      expect(issues[0].row).toBe(3)
      expect(issues[0].relatedRows).toContain(2)
    })

    it('should return empty array when no duplicates', () => {
      const rows = [
        {
          row: 2,
          data: {
            entryDate: '2024-01-15',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 10000,
          },
        },
        {
          row: 3,
          data: {
            entryDate: '2024-01-16',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 10000,
          },
        },
      ]

      const issues = detector.detectDuplicates(rows)

      expect(issues).toHaveLength(0)
    })

    it('should detect multiple duplicates', () => {
      const rows = [
        {
          row: 2,
          data: {
            entryDate: '2024-01-15',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 10000,
          },
        },
        {
          row: 3,
          data: {
            entryDate: '2024-01-15',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 10000,
          },
        },
        {
          row: 4,
          data: {
            entryDate: '2024-01-15',
            debitAccount: '現金',
            creditAccount: '売上',
            amount: 10000,
          },
        },
      ]

      const issues = detector.detectDuplicates(rows)

      expect(issues).toHaveLength(2)
    })
  })

  describe('detectAmountAnomalies', () => {
    it('should detect unusual amounts using z-score', () => {
      const rows = [
        { row: 2, data: { amount: 10000 } },
        { row: 3, data: { amount: 11000 } },
        { row: 4, data: { amount: 10500 } },
        { row: 5, data: { amount: 10000000 } }, // Anomaly
      ]

      const issues = detector.detectAmountAnomalies(rows, 'amount')

      expect(issues.some((i) => i.row === 5)).toBe(true)
      expect(issues.find((i) => i.row === 5)?.type).toBe('unusual_amount')
    })

    it('should not flag normal amounts', () => {
      const rows = [
        { row: 2, data: { amount: 10000 } },
        { row: 3, data: { amount: 11000 } },
        { row: 4, data: { amount: 10500 } },
      ]

      const issues = detector.detectAmountAnomalies(rows, 'amount')

      expect(issues).toHaveLength(0)
    })

    it('should handle string amounts with commas', () => {
      const rows = [
        { row: 2, data: { amount: '10,000' } },
        { row: 3, data: { amount: '11,000' } },
        { row: 4, data: { amount: '1,000,000' } },
      ]

      const issues = detector.detectAmountAnomalies(rows, 'amount')

      expect(issues.some((i) => i.row === 4)).toBe(true)
    })

    it('should return empty array for less than 3 rows', () => {
      const rows = [
        { row: 2, data: { amount: 10000 } },
        { row: 3, data: { amount: 10000000 } },
      ]

      const issues = detector.detectAmountAnomalies(rows, 'amount')

      expect(issues).toHaveLength(0)
    })
  })

  describe('detectDateIssues', () => {
    it('should detect invalid date format', () => {
      const rows = [
        { row: 2, data: { entryDate: '2024/01/15' } },
        { row: 3, data: { entryDate: '2024-01-15' } },
      ]

      const issues = detector.detectDateIssues(rows, 'entryDate')

      expect(issues.some((i) => i.row === 2 && i.type === 'invalid_date')).toBe(true)
    })

    it('should detect missing dates', () => {
      const rows = [
        { row: 2, data: {} },
        { row: 3, data: { entryDate: '' } },
      ]

      const issues = detector.detectDateIssues(rows, 'entryDate')

      expect(issues.every((i) => i.severity === 'critical')).toBe(true)
      expect(issues).toHaveLength(2)
    })

    it('should detect dates in the past', () => {
      const rows = [{ row: 2, data: { entryDate: '2020-01-01' } }]

      const issues = detector.detectDateIssues(rows, 'entryDate')

      expect(issues.some((i) => i.type === 'period_mismatch')).toBe(true)
    })

    it('should accept valid dates', () => {
      const rows = [
        { row: 2, data: { entryDate: '2024-01-15' } },
        { row: 3, data: { entryDate: '2024-12-31' } },
      ]

      const issues = detector.detectDateIssues(rows, 'entryDate')

      expect(issues.filter((i) => i.severity === 'critical')).toHaveLength(0)
    })
  })

  describe('detectTaxIssues', () => {
    it('should detect tax calculation errors for 10% tax', () => {
      const rows = [
        { row: 2, data: { amount: 110000, taxAmount: 10000, taxType: '課税10%' } },
        { row: 3, data: { amount: 110000, taxAmount: 5000, taxType: '課税10%' } }, // Wrong
      ]

      const issues = detector.detectTaxIssues(rows, 'amount', 'taxAmount', 'taxType')

      expect(issues.some((i) => i.row === 3 && i.type === 'tax_calculation_error')).toBe(true)
    })

    it('should accept correct tax calculations', () => {
      const rows = [{ row: 2, data: { amount: 110000, taxAmount: 10000, taxType: '課税10%' } }]

      const issues = detector.detectTaxIssues(rows, 'amount', 'taxAmount', 'taxType')

      expect(issues).toHaveLength(0)
    })

    it('should handle tax exempt entries', () => {
      const rows = [{ row: 2, data: { amount: 10000, taxAmount: 0, taxType: '免税' } }]

      const issues = detector.detectTaxIssues(rows, 'amount', 'taxAmount', 'taxType')

      expect(issues).toHaveLength(0)
    })
  })

  describe('detectBalanceIssues', () => {
    it('should detect missing debit account', () => {
      const rows = [{ row: 2, data: { creditAccount: '売上', amount: 10000 } }]

      const issues = detector.detectBalanceIssues(rows)

      expect(issues.some((i) => i.field === 'debitAccount')).toBe(true)
    })

    it('should detect missing credit account', () => {
      const rows = [{ row: 2, data: { debitAccount: '現金', amount: 10000 } }]

      const issues = detector.detectBalanceIssues(rows)

      expect(issues.some((i) => i.field === 'creditAccount')).toBe(true)
    })

    it('should detect same debit and credit account', () => {
      const rows = [
        { row: 2, data: { debitAccount: '現金', creditAccount: '現金', amount: 10000 } },
      ]

      const issues = detector.detectBalanceIssues(rows)

      expect(issues.some((i) => i.type === 'category_inconsistency')).toBe(true)
    })

    it('should detect invalid amount', () => {
      const rows = [
        { row: 2, data: { debitAccount: '現金', creditAccount: '売上', amount: -1000 } },
        { row: 3, data: { debitAccount: '現金', creditAccount: '売上' } },
      ]

      const issues = detector.detectBalanceIssues(rows)

      expect(issues.some((i) => i.field === 'amount')).toBe(true)
    })

    it('should accept valid journal entries', () => {
      const rows = [
        { row: 2, data: { debitAccount: '現金', creditAccount: '売上', amount: 10000 } },
      ]

      const issues = detector.detectBalanceIssues(rows)

      expect(issues).toHaveLength(0)
    })
  })
})
