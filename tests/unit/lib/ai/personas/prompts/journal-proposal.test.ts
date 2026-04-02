import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/ai/personas/prompts/constraints', () => ({
  getConstraints: vi.fn().mockReturnValue('Mocked constraints'),
}))

import {
  JOURNAL_PROPOSAL_SYSTEM_PROMPT_JA,
  JOURNAL_PROPOSAL_SYSTEM_PROMPT_EN,
  JOURNAL_PROPOSAL_OUTPUT_FORMAT,
  JUDGMENT_CRITERIA_JA,
  JUDGMENT_CRITERIA_EN,
  buildJournalProposalPrompt,
  getJournalProposalSystemPrompt,
} from '@/lib/ai/personas/prompts/journal-proposal'
import type { PromptVariables } from '@/lib/ai/personas/types'

describe('JOURNAL_PROPOSAL_SYSTEM_PROMPT_JA', () => {
  it('should be a non-empty string', () => {
    expect(JOURNAL_PROPOSAL_SYSTEM_PROMPT_JA.length).toBeGreaterThan(0)
  })

  it('should contain JGAAP reference', () => {
    expect(JOURNAL_PROPOSAL_SYSTEM_PROMPT_JA).toContain('JGAAP')
  })

  it('should contain accrual basis reference', () => {
    expect(JOURNAL_PROPOSAL_SYSTEM_PROMPT_JA).toContain('発生基準')
  })
})

describe('JOURNAL_PROPOSAL_SYSTEM_PROMPT_EN', () => {
  it('should be a non-empty string', () => {
    expect(JOURNAL_PROPOSAL_SYSTEM_PROMPT_EN.length).toBeGreaterThan(0)
  })

  it('should contain JGAAP reference', () => {
    expect(JOURNAL_PROPOSAL_SYSTEM_PROMPT_EN).toContain('JGAAP')
  })

  it('should contain accrual basis reference', () => {
    expect(JOURNAL_PROPOSAL_SYSTEM_PROMPT_EN).toContain('accrual')
  })
})

describe('JOURNAL_PROPOSAL_OUTPUT_FORMAT', () => {
  it('should contain JSON structure', () => {
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('entries')
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('rationale')
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('confidence')
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('warnings')
  })

  it('should contain tax type enum values', () => {
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('taxable_10')
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('taxable_8')
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('exempt')
    expect(JOURNAL_PROPOSAL_OUTPUT_FORMAT).toContain('non_taxable')
  })
})

describe('JUDGMENT_CRITERIA_JA', () => {
  it('should contain judgment sections', () => {
    expect(JUDGMENT_CRITERIA_JA).toContain('発生基準の適用')
    expect(JUDGMENT_CRITERIA_JA).toContain('勘定科目の選択')
    expect(JUDGMENT_CRITERIA_JA).toContain('消費税処理')
    expect(JUDGMENT_CRITERIA_JA).toContain('証憑要件')
  })
})

describe('JUDGMENT_CRITERIA_EN', () => {
  it('should contain judgment sections', () => {
    expect(JUDGMENT_CRITERIA_EN).toContain('Accrual Basis Application')
    expect(JUDGMENT_CRITERIA_EN).toContain('Account Selection')
    expect(JUDGMENT_CRITERIA_EN).toContain('Consumption Tax Treatment')
    expect(JUDGMENT_CRITERIA_EN).toContain('Documentary Requirements')
  })
})

describe('buildJournalProposalPrompt', () => {
  const baseVariables: PromptVariables = {
    ocrText: '領収書テストテキスト',
  }

  it('should build prompt in Japanese by default', () => {
    const result = buildJournalProposalPrompt(baseVariables)
    expect(result.systemPrompt).toContain('Mocked constraints')
    expect(result.userPrompt).toContain('入力情報')
    expect(result.userPrompt).toContain(baseVariables.ocrText)
  })

  it('should build prompt in English', () => {
    const result = buildJournalProposalPrompt(baseVariables, 'en')
    expect(result.userPrompt).toContain('Input Information')
    expect(result.userPrompt).toContain('OCR Text')
  })

  it('should include company context when provided', () => {
    const variables: PromptVariables = {
      ocrText: 'test',
      companyContext: 'Test Company',
    }
    const result = buildJournalProposalPrompt(variables, 'ja')
    expect(result.userPrompt).toContain('会社情報')
    expect(result.userPrompt).toContain('Test Company')
  })

  it('should include chart of accounts when provided', () => {
    const variables: PromptVariables = {
      ocrText: 'test',
      chartOfAccounts: '1000 現金\n2000 売掛金',
    }
    const result = buildJournalProposalPrompt(variables, 'ja')
    expect(result.userPrompt).toContain('勘定科目表')
  })

  it('should include fiscal year end when provided', () => {
    const variables: PromptVariables = {
      ocrText: 'test',
      fiscalYearEnd: 3,
    }
    const result = buildJournalProposalPrompt(variables, 'ja')
    expect(result.userPrompt).toContain('事業年度末')
    expect(result.userPrompt).toContain('3月')
  })

  it('should include fiscal year end in English', () => {
    const variables: PromptVariables = {
      ocrText: 'test',
      fiscalYearEnd: 12,
    }
    const result = buildJournalProposalPrompt(variables, 'en')
    expect(result.userPrompt).toContain('Fiscal Year End')
    expect(result.userPrompt).toContain('Month 12')
  })

  it('should include additional context when provided', () => {
    const variables: PromptVariables = {
      ocrText: 'test',
      additionalContext: 'Special notes',
    }
    const result = buildJournalProposalPrompt(variables, 'ja')
    expect(result.userPrompt).toContain('補足情報')
    expect(result.userPrompt).toContain('Special notes')
  })

  it('should not include optional fields when not provided', () => {
    const result = buildJournalProposalPrompt(baseVariables, 'ja')
    expect(result.userPrompt).not.toContain('会社情報')
    expect(result.userPrompt).not.toContain('勘定科目表')
    expect(result.userPrompt).not.toContain('事業年度末')
    expect(result.userPrompt).not.toContain('補足情報')
  })
})

describe('getJournalProposalSystemPrompt', () => {
  it('should return Japanese system prompt', () => {
    const result = getJournalProposalSystemPrompt('ja')
    expect(result).toContain(JOURNAL_PROPOSAL_SYSTEM_PROMPT_JA)
    expect(result).toContain('Mocked constraints')
    expect(result).toContain(JUDGMENT_CRITERIA_JA)
    expect(result).toContain(JOURNAL_PROPOSAL_OUTPUT_FORMAT)
  })

  it('should return English system prompt', () => {
    const result = getJournalProposalSystemPrompt('en')
    expect(result).toContain(JOURNAL_PROPOSAL_SYSTEM_PROMPT_EN)
    expect(result).toContain('Mocked constraints')
    expect(result).toContain(JUDGMENT_CRITERIA_EN)
    expect(result).toContain(JOURNAL_PROPOSAL_OUTPUT_FORMAT)
  })
})
