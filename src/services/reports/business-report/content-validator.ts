import type { ValidationResult, ValidationError, ValidationWarning } from '@/types/reports/business'
import type { BusinessReportSectionType } from '@/lib/prompts/business-report/keidanren-prompts'

interface SectionValidationRule {
  requiredKeywords?: string[]
  minLength?: number
  maxLength?: number
  numberPatterns?: RegExp[]
  requiredSections?: string[]
}

const SECTION_VALIDATION_RULES: Record<BusinessReportSectionType, SectionValidationRule> = {
  'companyStatus.businessDescription': {
    minLength: 100,
    maxLength: 5000,
    requiredKeywords: ['事業', '会社'],
  },
  'companyStatus.businessPerformance': {
    minLength: 200,
    maxLength: 10000,
    requiredKeywords: ['売上高', '利益'],
    numberPatterns: [/\d{1,3}(,\d{3})*円/, /\d+(\.\d)?%/],
  },
  'companyStatus.productionOrders': {
    maxLength: 5000,
  },
  'companyStatus.financialSummary': {
    minLength: 200,
    maxLength: 10000,
    requiredKeywords: ['資産', '負債', '純資産'],
    numberPatterns: [/\d{1,3}(,\d{3})*円/],
  },
  'companyStatus.riskManagement': {
    minLength: 100,
    maxLength: 10000,
    requiredKeywords: ['リスク'],
  },
  'shares.totalShares': {
    minLength: 50,
    maxLength: 5000,
    numberPatterns: [/\d{1,3}(,\d{3})*株/],
  },
  'shares.shareholdingStructure': {
    minLength: 100,
    maxLength: 10000,
    requiredKeywords: ['株式', '株主'],
  },
  'shares.majorShareholders': {
    minLength: 50,
    maxLength: 10000,
    numberPatterns: [/\d{1,3}(,\d{3})*株/, /\d+(\.\d)?%/],
  },
  'stockOptions.stockAcquisitionRights': {
    maxLength: 10000,
  },
  'officers.directors': {
    minLength: 50,
    maxLength: 20000,
    requiredKeywords: ['取締役'],
  },
  'officers.auditors': {
    minLength: 50,
    maxLength: 10000,
    requiredKeywords: ['監査役'],
  },
  'officers.compensation': {
    minLength: 50,
    maxLength: 10000,
    numberPatterns: [/\d{1,3}(,\d{3})*円/, /\d名/],
  },
  'officers.boardMeetings': {
    minLength: 50,
    maxLength: 10000,
    numberPatterns: [/\d+回/],
  },
  'auditor.info': {
    minLength: 50,
    maxLength: 5000,
    requiredKeywords: ['監査'],
  },
  'auditor.opinion': {
    minLength: 50,
    maxLength: 5000,
  },
  'internalControl.basicPolicy': {
    minLength: 100,
    maxLength: 20000,
    requiredKeywords: ['内部統制'],
  },
  'internalControl.organizationalStructure': {
    minLength: 100,
    maxLength: 10000,
  },
  'internalControl.compliance': {
    minLength: 100,
    maxLength: 10000,
    requiredKeywords: ['コンプライアンス'],
  },
  'controlPolicy.policy': {
    maxLength: 10000,
  },
  'subsidiary.info': {
    maxLength: 5000,
  },
  'relatedPartyTransactions.info': {
    maxLength: 10000,
  },
  'importantMatters.subsequentEvents': {
    maxLength: 10000,
  },
  'importantMatters.litigation': {
    maxLength: 10000,
  },
}

export function validateGeneratedContent(
  sectionType: BusinessReportSectionType,
  content: string
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  const rule = SECTION_VALIDATION_RULES[sectionType]
  if (!rule) {
    return {
      isValid: true,
      errors: [],
      warnings: [{ field: sectionType, message: 'バリデーションルールが定義されていません' }],
    }
  }

  if (rule.minLength !== undefined && content.length < rule.minLength) {
    warnings.push({
      field: sectionType,
      message: `文字数が不足しています（現在: ${content.length}文字、推奨: ${rule.minLength}文字以上）`,
      suggestion: 'より詳細な記載を追加してください',
    })
  }

  if (rule.maxLength !== undefined && content.length > rule.maxLength) {
    errors.push({
      field: sectionType,
      message: `文字数が上限を超えています（現在: ${content.length}文字、上限: ${rule.maxLength}文字）`,
      code: 'CONTENT_TOO_LONG',
    })
  }

  if (rule.requiredKeywords) {
    for (const keyword of rule.requiredKeywords) {
      if (!content.includes(keyword)) {
        warnings.push({
          field: sectionType,
          message: `必須キーワード「${keyword}」が含まれていません`,
          suggestion: `「${keyword}」に関する記載を追加してください`,
        })
      }
    }
  }

  if (rule.numberPatterns) {
    for (const pattern of rule.numberPatterns) {
      if (!pattern.test(content)) {
        warnings.push({
          field: sectionType,
          message: `数値データの形式が見つかりません（期待: ${pattern.source}）`,
          suggestion: '具体的な数値を含めることを検討してください',
        })
        break
      }
    }
  }

  const placeholderPatterns = [
    /\{\{[^}]+\}\}/g,
    /\[内容を入力/,
    /\[金額\]/,
    /\[数値\]/,
    /\[説明\]/,
    /〇〇/g,
    /△△/g,
  ]

  for (const pattern of placeholderPatterns) {
    const matches = content.match(pattern)
    if (matches && matches.length > 3) {
      warnings.push({
        field: sectionType,
        message: 'プレースホルダーが多数残っています',
        suggestion: '実際のデータに置き換えてください',
      })
      break
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export function calculateConfidence(
  sectionType: BusinessReportSectionType,
  content: string,
  hasSourceData: boolean
): number {
  const validation = validateGeneratedContent(sectionType, content)
  let confidence = 1.0

  confidence -= validation.errors.length * 0.3
  confidence -= validation.warnings.length * 0.1

  if (!hasSourceData) {
    confidence -= 0.2
  }

  if (content.length < 50) {
    confidence -= 0.3
  }

  const placeholderCount = (content.match(/〇〇|△△|\[\]/g) || []).length
  confidence -= placeholderCount * 0.05

  return Math.max(0, Math.min(1, confidence))
}

const LEGAL_TERMS: Record<string, string[]> = {
  companyLaw: ['取締役会', '株主総会', '監査役', '定款', '会社法'],
  accounting: ['貸借対照表', '損益計算書', 'キャッシュフロー', '純資産'],
  governance: ['内部統制', 'コンプライアンス', 'リスク管理'],
}

export function checkLegalTerminology(content: string): {
  used: string[]
  missing: string[]
} {
  const used: string[] = []
  const missing: string[] = []

  const allTerms = Object.values(LEGAL_TERMS).flat()
  for (const term of allTerms) {
    if (content.includes(term)) {
      used.push(term)
    }
  }

  return { used, missing }
}

export function validateCompleteReport(sections: Record<string, string>): {
  isValid: boolean
  completeness: number
  missingSections: string[]
  warnings: string[]
} {
  const requiredSections = [
    'companyStatus.businessDescription',
    'companyStatus.businessPerformance',
    'companyStatus.financialSummary',
    'shares.totalShares',
    'officers.directors',
    'officers.auditors',
    'auditor.info',
    'internalControl.basicPolicy',
  ]

  const missingSections: string[] = []
  let filledCount = 0

  for (const section of requiredSections) {
    const content = sections[section]
    if (!content || content.trim().length < 50) {
      missingSections.push(section)
    } else {
      filledCount++
    }
  }

  const completeness = (filledCount / requiredSections.length) * 100
  const warnings: string[] = []

  if (completeness < 100) {
    warnings.push(`必須セクションの${100 - completeness}%が未入力です`)
  }

  return {
    isValid: missingSections.length === 0,
    completeness,
    missingSections,
    warnings,
  }
}
