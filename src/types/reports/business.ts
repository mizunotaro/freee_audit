export interface BusinessReportData {
  fiscalYear: number
  companyName: string
  businessOverview: string
  businessEnvironment: string
  managementPolicy: string
  issuesAndRisks: string
  financialHighlights: string
  researchAndDevelopment: string
  corporateGovernance: string
}

export interface BusinessReportSection {
  key: keyof Omit<BusinessReportData, 'fiscalYear' | 'companyName'>
  title: string
  description: string
}
