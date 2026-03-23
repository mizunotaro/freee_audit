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

export class BusinessReportValidator {
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
