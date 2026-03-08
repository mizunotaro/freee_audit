import { describe, it, expect } from 'vitest'
import {
  getAccountingStandardConfig,
  ACCOUNTING_STANDARD_CONFIGS,
} from '@/types/accounting-standard'
import type { AccountingStandard } from '@/types/accounting-standard'

describe('AccountingStandard', () => {
  describe('getAccountingStandardConfig', () => {
    it('should return JGAAP config', () => {
      const config = getAccountingStandardConfig('JGAAP')
      expect(config.standard).toBe('JGAAP')
      expect(config.cashFlow.method).toBe('indirect')
    })

    it('should return USGAAP config with both methods', () => {
      const config = getAccountingStandardConfig('USGAAP')
      expect(config.cashFlow.method).toBe('both')
    })

    it('should return IFRS config with financing interest', () => {
      const config = getAccountingStandardConfig('IFRS')
      expect(config.cashFlow.interestClassification).toBe('financing')
    })
  })

  describe('ACCOUNTING_STANDARD_CONFIGS', () => {
    it('should have all three standards', () => {
      expect(Object.keys(ACCOUNTING_STANDARD_CONFIGS)).toHaveLength(3)
    })

    it('should have consistent structure', () => {
      for (const standard of ['JGAAP', 'USGAAP', 'IFRS'] as AccountingStandard[]) {
        const config = ACCOUNTING_STANDARD_CONFIGS[standard]
        expect(config.cashFlow).toBeDefined()
        expect(config.depreciation).toBeDefined()
        expect(config.taxEffect).toBeDefined()
      }
    })
  })
})
