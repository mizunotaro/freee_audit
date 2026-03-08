import { describe, it, expect, beforeEach } from 'vitest'
import {
  AccountingExpertPersona,
  accountingExpertPersona,
} from '@/lib/ai/personas/accounting-expert'
import type { PromptVariables } from '@/lib/ai/personas/types'

describe('AccountingExpertPersona', () => {
  let persona: AccountingExpertPersona

  beforeEach(() => {
    persona = new AccountingExpertPersona()
  })

  describe('buildJournalProposalPrompt', () => {
    it('should build a valid prompt with OCR text', () => {
      const variables: PromptVariables = {
        ocrText: '株式会社テスト\n2024年3月15日\n文具・消耗品費\n10,000円（税込）',
      }

      const result = persona.buildJournalProposalPrompt(variables)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.systemPrompt).toContain('公認会計士・税理士')
        expect(result.data.systemPrompt).toContain('JGAAP')
        expect(result.data.userPrompt).toContain('OCRテキスト')
        expect(result.data.userPrompt).toContain('株式会社テスト')
        expect(result.data.estimatedTokens).toBeGreaterThan(0)
        expect(result.data.personaType).toBe('cpa')
        expect(result.data.personaVersion).toBe('1.0.0')
      }
    })

    it('should include all optional context when provided', () => {
      const variables: PromptVariables = {
        ocrText: 'Test receipt',
        companyContext: 'Test Company Inc.',
        chartOfAccounts: '100: Cash, 200: Accounts Payable',
        fiscalYearEnd: 3,
        additionalContext: 'This is a test',
      }

      const result = persona.buildJournalProposalPrompt(variables)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.userPrompt).toContain('会社情報')
        expect(result.data.userPrompt).toContain('Test Company Inc.')
        expect(result.data.userPrompt).toContain('勘定科目表')
        expect(result.data.userPrompt).toContain('事業年度末: 3月')
        expect(result.data.userPrompt).toContain('補足情報')
        expect(result.data.userPrompt).toContain('This is a test')
      }
    })

    it('should reject empty OCR text', () => {
      const variables: PromptVariables = {
        ocrText: '   ',
      }

      const result = persona.buildJournalProposalPrompt(variables)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('validation_error')
        expect(result.error.message).toContain('ocrText cannot be empty')
      }
    })

    it('should reject invalid fiscal year end', () => {
      const variables: PromptVariables = {
        ocrText: 'Test',
        fiscalYearEnd: 13 as 1,
      }

      const result = persona.buildJournalProposalPrompt(variables)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('validation_error')
        expect(result.error.message).toContain('fiscalYearEnd must be a number between 1 and 12')
      }
    })
  })

  describe('validateJournalProposalResponse', () => {
    it('should validate a correct response', () => {
      const response = {
        entries: [
          {
            entryDate: '2024-03-15',
            description: '文具購入',
            debitAccount: '521',
            debitAccountName: '消耗品費',
            creditAccount: '111',
            creditAccountName: '現金',
            amount: 10000,
            taxAmount: 1000,
            taxType: 'taxable_10',
          },
        ],
        rationale: '消耗品費として計上',
        confidence: 0.95,
        warnings: [],
      }

      const result = persona.validateJournalProposalResponse(response)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.entries).toHaveLength(1)
        expect(result.data.entries[0]?.entryDate).toBe('2024-03-15')
        expect(result.data.rationale).toBe('消耗品費として計上')
        expect(result.data.confidence).toBe(0.95)
        expect(result.data.warnings).toHaveLength(0)
      }
    })

    it('should reject response without entries array', () => {
      const response = {
        rationale: 'test',
        confidence: 0.5,
        warnings: [],
      }

      const result = persona.validateJournalProposalResponse(response)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('validation_error')
        expect(result.error.message).toContain('entries must be an array')
      }
    })

    it('should reject invalid confidence value', () => {
      const response = {
        entries: [],
        rationale: 'test',
        confidence: 1.5,
        warnings: [],
      }

      const result = persona.validateJournalProposalResponse(response)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toContain('confidence must be a number between 0 and 1')
      }
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(accountingExpertPersona).toBeInstanceOf(AccountingExpertPersona)
    })
  })
})
