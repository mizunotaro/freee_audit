import type { DisclosureCategory } from '@/types/conversion'
import { USGAAP_DISCLOSURE_TEMPLATES, getUSGAAPTemplate, getUSGAAPCategories } from './usgaap'
import { IFRS_DISCLOSURE_TEMPLATES, getIFRSTemplate, getIFRSCategories } from './ifrs'

export type { DisclosureTemplate, DisclosureTemplateContext } from './usgaap'
export { USGAAP_DISCLOSURE_TEMPLATES, getUSGAAPTemplate, getUSGAAPCategories }
export { IFRS_DISCLOSURE_TEMPLATES, getIFRSTemplate, getIFRSCategories }

export type TargetStandard = 'USGAAP' | 'IFRS' | 'JGAAP'

export function getTemplate(category: DisclosureCategory, targetStandard: TargetStandard) {
  if (targetStandard === 'USGAAP') {
    return getUSGAAPTemplate(category)
  }
  if (targetStandard === 'IFRS') {
    return getIFRSTemplate(category)
  }
  return undefined
}

export function getCategories(targetStandard: TargetStandard): string[] {
  if (targetStandard === 'USGAAP') {
    return getUSGAAPCategories()
  }
  if (targetStandard === 'IFRS') {
    return getIFRSCategories()
  }
  return []
}

export function getAllCategories(): DisclosureCategory[] {
  return [
    'significant_accounting_policies',
    'basis_of_conversion',
    'standard_differences',
    'adjusting_entries',
    'fair_value_measurement',
    'related_party',
    'subsequent_events',
    'commitments_contingencies',
    'segment_information',
    'foreign_currency',
    'revenue_recognition',
    'lease_obligations',
    'financial_instruments',
    'other',
  ]
}

export const CATEGORY_DISPLAY_NAMES: Record<DisclosureCategory, { ja: string; en: string }> = {
  significant_accounting_policies: { ja: '重要な会計方針', en: 'Significant Accounting Policies' },
  basis_of_conversion: { ja: '変換の基礎', en: 'Basis of Conversion' },
  standard_differences: {
    ja: '会計基準の主な差異',
    en: 'Significant Differences in Accounting Standards',
  },
  adjusting_entries: { ja: '調整仕訳の開示', en: 'Disclosure of Adjusting Entries' },
  fair_value_measurement: { ja: '公正価値測定', en: 'Fair Value Measurement' },
  related_party: { ja: '関連当事者', en: 'Related Party Transactions' },
  subsequent_events: { ja: '後発事象', en: 'Subsequent Events' },
  commitments_contingencies: {
    ja: 'コミットメント及び偶発事象',
    en: 'Commitments and Contingencies',
  },
  segment_information: { ja: 'セグメント情報', en: 'Segment Information' },
  foreign_currency: { ja: '外貨換算', en: 'Foreign Currency Translation' },
  revenue_recognition: { ja: '収益認識', en: 'Revenue Recognition' },
  lease_obligations: { ja: 'リース債務', en: 'Lease Obligations' },
  financial_instruments: { ja: '金融商品', en: 'Financial Instruments' },
  other: { ja: 'その他', en: 'Other' },
}

export function getCategoryDisplayName(
  category: DisclosureCategory,
  lang: 'ja' | 'en' = 'ja'
): string {
  return CATEGORY_DISPLAY_NAMES[category]?.[lang] ?? category
}
