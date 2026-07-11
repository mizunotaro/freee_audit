import { describe, it, expect } from 'vitest'
import { JOURNAL_PROPOSAL_PROMPT, PROMPT_VERSION } from '@/services/ai/prompts/journal-proposal'

describe('services/ai/prompts/journal-proposal', () => {
  describe('PROMPT_VERSION', () => {
    it('is the semver string 1.0.0', () => {
      expect(PROMPT_VERSION).toBe('1.0.0')
    })
  })

  describe('JOURNAL_PROPOSAL_PROMPT', () => {
    it('exposes system and user prompt strings', () => {
      expect(typeof JOURNAL_PROPOSAL_PROMPT.system).toBe('string')
      expect(typeof JOURNAL_PROPOSAL_PROMPT.user).toBe('string')
      expect(JOURNAL_PROPOSAL_PROMPT.system.length).toBeGreaterThan(0)
      expect(JOURNAL_PROPOSAL_PROMPT.user.length).toBeGreaterThan(0)
    })

    it('configures the CPA/tax-accountant persona in the system prompt', () => {
      const system = JOURNAL_PROPOSAL_PROMPT.system

      expect(system).toContain('公認会計士')
      expect(system).toContain('税理士')
      expect(system).toContain('JSON')
      expect(system).toContain('勘定科目')
      expect(system).toContain('消費税法')
    })

    it('constrains confidence and warnings in the system prompt rules', () => {
      const system = JOURNAL_PROPOSAL_PROMPT.system

      expect(system).toContain('confidence')
      expect(system).toContain('warnings')
    })

    it('declares every OCR template placeholder in the user prompt', () => {
      const user = JOURNAL_PROPOSAL_PROMPT.user

      const placeholders = [
        '{{ocrDate}}',
        '{{ocrAmount}}',
        '{{ocrTaxAmount}}',
        '{{ocrTaxRate}}',
        '{{ocrVendor}}',
        '{{ocrItems}}',
        '{{additionalContext}}',
        '{{chartOfAccounts}}',
      ]

      for (const token of placeholders) {
        expect(user).toContain(token)
      }
    })

    it('documents the expected JSON response schema in the user prompt', () => {
      const user = JOURNAL_PROPOSAL_PROMPT.user

      const schemaFields = [
        'entries',
        'entryDate',
        'description',
        'debitAccount',
        'debitAccountName',
        'creditAccount',
        'creditAccountName',
        'amount',
        'taxAmount',
        'taxType',
        'rationale',
        'confidence',
        'warnings',
      ]

      for (const field of schemaFields) {
        expect(user).toContain(field)
      }
    })

    it('is frozen as a const literal (no extra keys beyond system/user)', () => {
      expect(Object.keys(JOURNAL_PROPOSAL_PROMPT).sort()).toEqual(['system', 'user'])
    })
  })
})
