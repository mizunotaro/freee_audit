import type { AnalysisCategory } from './types'

export const THRESHOLDS = {
  currentRatio: {
    excellent: 200,
    good: 150,
    fair: 100,
    poor: 80,
  },
  quickRatio: {
    excellent: 150,
    good: 100,
    fair: 80,
    poor: 50,
  },
  debtToEquity: {
    excellent: 0.5,
    good: 1.0,
    fair: 2.0,
    poor: 3.0,
  },
  equityRatio: {
    excellent: 50,
    good: 30,
    fair: 20,
    poor: 10,
  },
  grossMargin: {
    excellent: 40,
    good: 30,
    fair: 20,
    poor: 10,
  },
  operatingMargin: {
    excellent: 15,
    good: 10,
    fair: 5,
    poor: 2,
  },
  netMargin: {
    excellent: 10,
    good: 7,
    fair: 4,
    poor: 1,
  },
  roe: {
    excellent: 15,
    good: 10,
    fair: 5,
    poor: 0,
  },
  roa: {
    excellent: 10,
    good: 6,
    fair: 3,
    poor: 1,
  },
  assetTurnover: {
    excellent: 2.0,
    good: 1.5,
    fair: 1.0,
    poor: 0.5,
  },
} as const

export const GROWTH_THRESHOLDS = {
  excellent: 20,
  good: 10,
  fair: 0,
  poor: -10,
} as const

export const CATEGORY_WEIGHTS: Record<AnalysisCategory, number> = {
  liquidity: 1.0,
  safety: 1.2,
  profitability: 1.3,
  efficiency: 0.8,
  growth: 1.0,
  cashflow: 1.0,
  comprehensive: 0.5,
} as const

export const STATUS_SCORES = {
  excellent: 100,
  good: 75,
  fair: 50,
  poor: 25,
  critical: 0,
} as const

export const STATUS_DESCRIPTIONS_JA = {
  excellent: '非常に良好',
  good: '良好',
  fair: '普通',
  poor: '改善が必要',
  critical: '早急な対応が必要',
} as const

export const CATEGORY_NAMES_JA: Record<AnalysisCategory, string> = {
  liquidity: '流動性',
  safety: '安全性',
  profitability: '収益性',
  efficiency: '効率性',
  growth: '成長性',
  cashflow: 'キャッシュフロー',
  comprehensive: '総合',
} as const

export const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
} as const

export const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
} as const
