import { describe, it, expect } from 'vitest'
import {
  BaseValidator,
  type ValidatorContext,
  type ValidationResult,
} from '@/services/dd/validators/base-validator'
import { Result } from '@/types/result'
import type { DDSeverity, DDAnalyticsContext, DDJournalData } from '@/services/dd/types'

class TestableValidator extends BaseValidator {
  readonly category = 'REVENUE_RECOGNITION' as const
  readonly supportedRules = ['COMPLETENESS']

  async validate(): Promise<Result<ValidationResult>> {
    return { success: true, data: { passed: true, findings: [], evidence: [] } }
  }
}

function makeContext(overrides: Partial<DDAnalyticsContext> = {}): ValidatorContext {
  return {
    companyId: 'co-1',
    fiscalYear: 2024,
    analyticsContext: {
      companyId: 'co-1',
      fiscalYears: [2024],
      trialBalances: [],
      journals: [],
      accountItems: [],
      partners: [],
      ...overrides,
    },
  }
}

describe('BaseValidator', () => {
  let validator: TestableValidator

  let v: any

  beforeEach(function () {
    validator = new TestableValidator()
    v = validator
  })

  describe('createFinding', () => {
    it('should create a finding with all fields', function () {
      const finding = v.createFinding(
        'Test Finding',
        'Test description',
        'HIGH',
        'Test impact',
        'Test recommendation',
        'JGAAP-001'
      )

      expect(finding.id).toContain('REVENUE_RECOGNITION')
      expect(finding.title).toBe('Test Finding')
      expect(finding.description).toBe('Test description')
      expect(finding.severity).toBe('HIGH')
      expect(finding.impact).toBe('Test impact')
      expect(finding.recommendation).toBe('Test recommendation')
      expect(finding.relatedStandard).toBe('JGAAP-001')
    })
  })

  describe('createEvidence', () => {
    it('should create evidence entry', function () {
      const evidence = v.createEvidence('JOURNAL', 'ref-001', 'Test summary')
      expect(evidence.type).toBe('JOURNAL')
      expect(evidence.reference).toBe('ref-001')
      expect(evidence.summary).toBe('Test summary')
    })
  })

  describe('calculateVariance', () => {
    it('should calculate variance between actual and expected', function () {
      expect(v.calculateVariance(110, 100)).toBeCloseTo(0.1, 5)
      expect(v.calculateVariance(100, 100)).toBe(0)
      expect(v.calculateVariance(0, 0)).toBe(0)
      expect(v.calculateVariance(100, 0)).toBe(Infinity)
    })
  })

  describe('checkThreshold', () => {
    it('should check if value is within threshold', function () {
      expect(v.checkThreshold(100, 100)).toBe(true)
      expect(v.checkThreshold(100, 50)).toBe(false)
    })
    it('should check with tolerance', function () {
      expect(v.checkThreshold(110, 100, 0.15)).toBe(true)
      expect(v.checkThreshold(120, 100, 0.15)).toBe(false)
    })
  })

  describe('calculateTrend', () => {
    it('should identify increasing trend', function () {
      const trend = v.calculateTrend([100, 110, 120])
      expect(trend.direction).toBe('increasing')
      expect(trend.percentageChange).toBe(20)
      expect(trend.average).toBeCloseTo(110, 5)
    })
    it('should identify decreasing trend', function () {
      const trend = v.calculateTrend([120, 110, 100])
      expect(trend.direction).toBe('decreasing')
      expect(trend.percentageChange).toBeCloseTo(-16.67, 1)
    })
    it('should identify stable trend', function () {
      const trend = v.calculateTrend([100, 102, 101])
      expect(trend.direction).toBe('stable')
    })
    it('should handle single value', function () {
      const trend = v.calculateTrend([100])
      expect(trend.direction).toBe('stable')
      expect(trend.average).toBe(100)
    })
    it('should handle empty array', function () {
      const trend = v.calculateTrend([])
      expect(trend.direction).toBe('stable')
      expect(trend.average).toBe(0)
    })
  })

  describe('sumJournalAmounts', () => {
    it('should sum debit and credit amounts', function () {
      const journals: DDJournalData[] = [
        {
          id: 'j-1',
          entryDate: new Date('2024-01-15'),
          debitAccount: '1001',
          creditAccount: '4001',
          amount: 1000,
          taxAmount: 100,
          description: 'Test',
        },
        {
          id: 'j-2',
          entryDate: new Date('2024-01-16'),
          debitAccount: '1001',
          creditAccount: '5001',
          amount: 2000,
          taxAmount: 200,
          description: 'Test',
        },
        {
          id: 'j-3',
          entryDate: new Date('2024-01-17'),
          debitAccount: '2001',
          creditAccount: '4001',
          amount: 3000,
          taxAmount: 300,
          description: 'Test',
        },
      ]
      const result = v.sumJournalAmounts(journals, function (account: string) {
        return account === '1001'
      })
      expect(result.debit).toBe(3000)
      expect(result.credit).toBe(0)
    })
  })

  describe('getTrialBalanceForYear', () => {
    it('should return trial balance for matching year', function () {
      const context = makeContext({
        trialBalances: [
          { asOfDate: new Date('2024-03-31'), accounts: [] },
          { asOfDate: new Date('2023-03-31'), accounts: [] },
        ],
      })
      const result = v.getTrialBalanceForYear(context, 2024)
      expect(result).toBeDefined()
      expect(new Date(result!.asOfDate).getFullYear()).toBe(2024)
    })
    it('should return undefined if no matching year', function () {
      const context = makeContext({
        trialBalances: [{ asOfDate: new Date('2023-03-31'), accounts: [] }],
      })
      const result = v.getTrialBalanceForYear(context, 2024)
      expect(result).toBeUndefined()
    })
  })

  describe('getJournalsForYear', () => {
    it('should filter journals for a specific year', function () {
      const context = makeContext({
        journals: [
          {
            id: 'j-1',
            entryDate: new Date('2024-01-15'),
            debitAccount: '1001',
            creditAccount: '4001',
            amount: 1000,
            taxAmount: 100,
            description: 'Test',
          },
          {
            id: 'j-2',
            entryDate: new Date('2023-06-15'),
            debitAccount: '1001',
            creditAccount: '4001',
            amount: 500,
            taxAmount: 50,
            description: 'Test',
          },
          {
            id: 'j-3',
            entryDate: new Date('2024-07-15'),
            debitAccount: '1001',
            creditAccount: '4001',
            amount: 2000,
            taxAmount: 200,
            description: 'Test',
          },
        ],
      })
      const result = v.getJournalsForYear(context, 2024)
      expect(result).toHaveLength(2)
    })
  })
})
