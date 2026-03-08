export type AccountingStandard = 'JGAAP' | 'USGAAP' | 'IFRS'

export interface AccountingStandardConfig {
  standard: AccountingStandard
  displayName: string
  displayNameEn: string

  cashFlow: {
    method: 'indirect' | 'direct' | 'both'
    depreciationTreatment: 'add_back' | 'separate'
    deferredTaxHandling: boolean
    interestClassification: 'operating' | 'financing' | 'separate'
  }

  depreciation: {
    allowedMethods: ('straight_line' | 'declining_balance' | 'accelerated')[]
    defaultMethod: 'straight_line' | 'declining_balance'
    usefulLifeAdjustments: Record<string, number>
  }

  taxEffect: {
    deferredTaxRequired: boolean
    taxRateSource: 'statutory' | 'effective'
  }

  disclosure: {
    segmentReporting: boolean
    relatedParty: boolean
    subsequentEvents: boolean
  }
}

export const ACCOUNTING_STANDARD_CONFIGS: Record<AccountingStandard, AccountingStandardConfig> = {
  JGAAP: {
    standard: 'JGAAP',
    displayName: '日本基準',
    displayNameEn: 'Japanese GAAP',
    cashFlow: {
      method: 'indirect',
      depreciationTreatment: 'add_back',
      deferredTaxHandling: true,
      interestClassification: 'separate',
    },
    depreciation: {
      allowedMethods: ['straight_line', 'declining_balance'],
      defaultMethod: 'declining_balance',
      usefulLifeAdjustments: {},
    },
    taxEffect: {
      deferredTaxRequired: true,
      taxRateSource: 'statutory',
    },
    disclosure: {
      segmentReporting: false,
      relatedParty: true,
      subsequentEvents: true,
    },
  },
  USGAAP: {
    standard: 'USGAAP',
    displayName: '米国基準',
    displayNameEn: 'US GAAP',
    cashFlow: {
      method: 'both',
      depreciationTreatment: 'add_back',
      deferredTaxHandling: true,
      interestClassification: 'operating',
    },
    depreciation: {
      allowedMethods: ['straight_line', 'declining_balance', 'accelerated'],
      defaultMethod: 'straight_line',
      usefulLifeAdjustments: {},
    },
    taxEffect: {
      deferredTaxRequired: true,
      taxRateSource: 'effective',
    },
    disclosure: {
      segmentReporting: true,
      relatedParty: true,
      subsequentEvents: true,
    },
  },
  IFRS: {
    standard: 'IFRS',
    displayName: '国際基準',
    displayNameEn: 'IFRS',
    cashFlow: {
      method: 'indirect',
      depreciationTreatment: 'add_back',
      deferredTaxHandling: true,
      interestClassification: 'financing',
    },
    depreciation: {
      allowedMethods: ['straight_line'],
      defaultMethod: 'straight_line',
      usefulLifeAdjustments: {},
    },
    taxEffect: {
      deferredTaxRequired: true,
      taxRateSource: 'effective',
    },
    disclosure: {
      segmentReporting: true,
      relatedParty: true,
      subsequentEvents: true,
    },
  },
}

export function getAccountingStandardConfig(
  standard: AccountingStandard
): AccountingStandardConfig {
  return ACCOUNTING_STANDARD_CONFIGS[standard]
}
