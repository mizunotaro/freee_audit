import type {
  KeidanrenBusinessReport,
  BusinessReportData,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ComplianceResult,
  ComplianceCheckItem,
} from '@/types/reports/business'

const REQUIRED_SIMPLE_FIELDS: Array<keyof BusinessReportData> = [
  'fiscalYear',
  'companyName',
  'businessOverview',
  'businessEnvironment',
  'managementPolicy',
  'issuesAndRisks',
  'financialHighlights',
  'researchAndDevelopment',
  'corporateGovernance',
]

const REQUIRED_KEIDANREN_SECTIONS = [
  'companyStatus',
  'shares',
  'stockOptions',
  'officers',
  'auditor',
  'internalControl',
  'controlPolicy',
  'subsidiary',
  'relatedPartyTransactions',
  'importantMatters',
]

const KEIDANREN_COMPLIANCE_ITEMS: Array<{
  requirement: string
  legalBasis: string
  section: string
}> = [
  {
    requirement: 'Business description must be included',
    legalBasis: 'Company Law Article 439',
    section: 'companyStatus',
  },
  {
    requirement: 'Share information must be disclosed',
    legalBasis: 'Company Law Article 440',
    section: 'shares',
  },
  {
    requirement: 'Officer information must be included',
    legalBasis: 'Company Law Article 441',
    section: 'officers',
  },
  {
    requirement: 'Auditor information must be disclosed',
    legalBasis: 'Company Law Article 442',
    section: 'auditor',
  },
  {
    requirement: 'Internal control system must be described',
    legalBasis: 'Company Law Article 362',
    section: 'internalControl',
  },
]

/**
 * 事業報告書の妥当性・法要件コンプライアンスを検証するサービス。
 *
 * シンプル型・経団連型それぞれの必須項目チェックと、会社法に基づく
 * 開示要件の充足確認を行う。
 */
export class BusinessReportValidator {
  /**
   * シンプル型報告書の必須フィールドと推奨記載量を検証する。
   *
   * @param report - シンプル型報告書データ（部分）
   * @returns 検証結果（必須フィールド欠落はエラー、記載不足は警告）
   */
  validateSimpleReport(report: Partial<BusinessReportData>): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    for (const field of REQUIRED_SIMPLE_FIELDS) {
      if (!report[field]) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          code: 'REQUIRED_FIELD_MISSING',
        })
      }
    }

    if (report.businessOverview && report.businessOverview.length < 100) {
      warnings.push({
        field: 'businessOverview',
        message: 'Business overview is too short for compliance',
        suggestion: 'Provide a more detailed description of business activities',
      })
    }

    if (report.financialHighlights && report.financialHighlights.length < 50) {
      warnings.push({
        field: 'financialHighlights',
        message: 'Financial highlights should include key metrics',
        suggestion: 'Include revenue, profit, and other key financial indicators',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 経団連型報告書の必須セクションと推奨記載内容を検証する。
   *
   * @param report - 経団連型報告書データ（部分）
   * @returns 検証結果（必須セクション欠落はエラー、推奨項目不足は警告）
   */
  validateKeidanrenReport(report: Partial<KeidanrenBusinessReport>): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    for (const section of REQUIRED_KEIDANREN_SECTIONS) {
      if (!report[section as keyof KeidanrenBusinessReport]) {
        errors.push({
          field: section,
          message: `Required section '${section}' is missing`,
          code: 'REQUIRED_SECTION_MISSING',
        })
      }
    }

    if (report.companyStatus) {
      const cs = report.companyStatus
      if (!cs.businessDescription?.mainBusiness) {
        errors.push({
          field: 'companyStatus.businessDescription',
          message: 'Business description mainBusiness is required',
          code: 'CONTENT_MISSING',
        })
      }
      if (!cs.businessPerformance?.analysis) {
        warnings.push({
          field: 'companyStatus.businessPerformance',
          message: 'Business performance analysis is recommended',
        })
      }
    }

    if (report.officers) {
      if (!report.officers.directors || report.officers.directors.length === 0) {
        warnings.push({
          field: 'officers.directors',
          message: 'At least one director should be listed',
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 経団連型報告書の会社法に基づく開示要件コンプライアンスをチェックする。
   *
   * 各要件について該当セクションの有無を確認し、pass/fail を判定する。
   *
   * @param report - 経団連型報告書データ（部分）
   * @returns コンプライアンス結果（全要件充足時のみ `isCompliant: true`）
   */
  checkKeidanrenCompliance(report: Partial<KeidanrenBusinessReport>): ComplianceResult {
    const checkedItems: ComplianceCheckItem[] = []
    const missingRequirements: string[] = []

    for (const item of KEIDANREN_COMPLIANCE_ITEMS) {
      const section = report[item.section as keyof KeidanrenBusinessReport]
      const hasContent = section !== undefined && section !== null

      const status: 'pass' | 'fail' | 'not_applicable' = hasContent ? 'pass' : 'fail'

      if (status === 'fail') {
        missingRequirements.push(item.requirement)
      }

      checkedItems.push({
        requirement: item.requirement,
        legalBasis: item.legalBasis,
        status,
        details: hasContent ? 'Section is present' : 'Section is missing',
      })
    }

    return {
      isCompliant: missingRequirements.length === 0,
      checkedItems,
      missingRequirements,
    }
  }

  /**
   * 単一文面の空欄・推奨最低文字数を検証する。
   *
   * @param content - 検証対象の文面
   * @param minLength - 推奨最低文字数（既定 50）。未満の場合は警告。
   * @returns 検証結果（空欄はエラー、文字数不足は警告）
   */
  validateContent(content: string, minLength: number = 50): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    if (!content || content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Content is empty',
        code: 'EMPTY_CONTENT',
      })
    } else if (content.length < minLength) {
      warnings.push({
        field: 'content',
        message: `Content is shorter than recommended minimum (${minLength} characters)`,
        suggestion: 'Expand the content for better compliance',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
