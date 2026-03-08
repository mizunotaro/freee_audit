export const JOURNAL_PROPOSAL_CONFIG = {
  version: '1.0.0',

  api: {
    analyzeEndpoint: '/api/journal-proposal/analyze',
    timeout: 30000,
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },

  upload: {
    maxFileSize: 10 * 1024 * 1024,
    acceptedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
    acceptedExtensions: ['.pdf', '.png', '.jpg', '.jpeg'],
  },

  pagination: {
    defaultPageSize: 10,
    maxPageSize: 100,
  },

  confidence: {
    thresholds: {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
    },
    labels: {
      ja: {
        high: '高',
        medium: '中',
        low: '低',
        veryLow: '要確認',
      },
      en: {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        veryLow: 'Review Required',
      },
    },
  },

  defaults: {
    companyId: 'default-company',
    userId: 'default-user',
    userContext: 'Upload from UI',
  },
} as const

export type JournalProposalConfig = typeof JOURNAL_PROPOSAL_CONFIG
