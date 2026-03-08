import type { AccountCategory } from '@/types/conversion'

export interface DefaultMappingSuggestion {
  sourceCodePattern: string | RegExp
  sourceCategory: AccountCategory
  targetCode: string
  targetName: string
  targetNameEn: string
  confidence: number
  mappingType: '1to1' | '1toN' | 'Nto1' | 'complex'
  notes?: string
}

interface CategoryMapping {
  jgaapCategory: AccountCategory
  usgaapCode: string
  usgaapName: string
  ifrsCode: string
  ifrsName: string
}

const CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    jgaapCategory: 'current_asset',
    usgaapCode: '1000',
    usgaapName: 'Current Assets',
    ifrsCode: '1000',
    ifrsName: 'Current Assets',
  },
  {
    jgaapCategory: 'fixed_asset',
    usgaapCode: '2000',
    usgaapName: 'Property, Plant and Equipment',
    ifrsCode: '2000',
    ifrsName: 'Property, Plant and Equipment',
  },
  {
    jgaapCategory: 'deferred_asset',
    usgaapCode: '1500',
    usgaapName: 'Deferred Tax Assets',
    ifrsCode: '1500',
    ifrsName: 'Deferred Tax Assets',
  },
  {
    jgaapCategory: 'current_liability',
    usgaapCode: '3000',
    usgaapName: 'Current Liabilities',
    ifrsCode: '3000',
    ifrsName: 'Current Liabilities',
  },
  {
    jgaapCategory: 'fixed_liability',
    usgaapCode: '3500',
    usgaapName: 'Long-term Liabilities',
    ifrsCode: '3500',
    ifrsName: 'Non-current Liabilities',
  },
  {
    jgaapCategory: 'deferred_liability',
    usgaapCode: '3600',
    usgaapName: 'Deferred Tax Liabilities',
    ifrsCode: '3600',
    ifrsName: 'Deferred Tax Liabilities',
  },
  {
    jgaapCategory: 'equity',
    usgaapCode: '4000',
    usgaapName: "Stockholders' Equity",
    ifrsCode: '4000',
    ifrsName: 'Equity',
  },
  {
    jgaapCategory: 'revenue',
    usgaapCode: '5000',
    usgaapName: 'Revenue',
    ifrsCode: '5000',
    ifrsName: 'Revenue',
  },
  {
    jgaapCategory: 'cogs',
    usgaapCode: '6000',
    usgaapName: 'Cost of Goods Sold',
    ifrsCode: '6000',
    ifrsName: 'Cost of Sales',
  },
  {
    jgaapCategory: 'sga_expense',
    usgaapCode: '7000',
    usgaapName: 'Operating Expenses',
    ifrsCode: '7000',
    ifrsName: 'Operating Expenses',
  },
  {
    jgaapCategory: 'non_operating_income',
    usgaapCode: '8000',
    usgaapName: 'Other Income',
    ifrsCode: '8000',
    ifrsName: 'Other Income',
  },
  {
    jgaapCategory: 'non_operating_expense',
    usgaapCode: '9000',
    usgaapName: 'Other Expenses',
    ifrsCode: '9000',
    ifrsName: 'Other Expenses',
  },
  {
    jgaapCategory: 'extraordinary_income',
    usgaapCode: '9500',
    usgaapName: 'Gain on Disposal of Assets',
    ifrsCode: '9500',
    ifrsName: 'Gain on Disposal of Assets',
  },
  {
    jgaapCategory: 'extraordinary_loss',
    usgaapCode: '9600',
    usgaapName: 'Loss on Disposal of Assets',
    ifrsCode: '9600',
    ifrsName: 'Loss on Disposal of Assets',
  },
]

const JGAAP_TO_TARGET: Array<{
  jgaapPattern: string | RegExp
  jgaapKeywords: string[]
  usgaap: { code: string; name: string }
  ifrs: { code: string; name: string }
  confidence: number
}> = [
  {
    jgaapPattern: /^1[0-9]{3}$/,
    jgaapKeywords: ['現金', '預金', 'cash', 'deposit'],
    usgaap: { code: '1100', name: 'Cash and Cash Equivalents' },
    ifrs: { code: '1100', name: 'Cash and Cash Equivalents' },
    confidence: 0.95,
  },
  {
    jgaapPattern: /^1[1-2][0-9]{2}$/,
    jgaapKeywords: ['売掛金', '受取手形', 'receivable'],
    usgaap: { code: '1200', name: 'Accounts Receivable' },
    ifrs: { code: '1200', name: 'Trade and Other Receivables' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^1[3-4][0-9]{2}$/,
    jgaapKeywords: ['商品', '製品', '原材料', '仕掛品', 'inventory', 'stock'],
    usgaap: { code: '1300', name: 'Inventory' },
    ifrs: { code: '1300', name: 'Inventories' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^1[5-6][0-9]{2}$/,
    jgaapKeywords: ['前払', '仮払', 'prepaid'],
    usgaap: { code: '1400', name: 'Prepaid Expenses' },
    ifrs: { code: '1400', name: 'Prepaid Expenses' },
    confidence: 0.85,
  },
  {
    jgaapPattern: /^2[0-1][0-9]{2}$/,
    jgaapKeywords: ['建物', '構築物', 'building', 'structure'],
    usgaap: { code: '2100', name: 'Buildings' },
    ifrs: { code: '2100', name: 'Buildings' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^2[2-3][0-9]{2}$/,
    jgaapKeywords: ['機械', '装置', '車両', '工具', 'machinery', 'equipment', 'vehicle'],
    usgaap: { code: '2200', name: 'Machinery and Equipment' },
    ifrs: { code: '2200', name: 'Plant and Equipment' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^2[4-5][0-9]{2}$/,
    jgaapKeywords: ['土地', 'land'],
    usgaap: { code: '2300', name: 'Land' },
    ifrs: { code: '2300', name: 'Land' },
    confidence: 0.95,
  },
  {
    jgaapPattern: /^2[6-7][0-9]{2}$/,
    jgaapKeywords: ['無形', '特許', 'software', 'intangible', 'patent'],
    usgaap: { code: '2400', name: 'Intangible Assets' },
    ifrs: { code: '2400', name: 'Intangible Assets' },
    confidence: 0.85,
  },
  {
    jgaapPattern: /^2[8-9][0-9]{2}$/,
    jgaapKeywords: ['投資', '出資', 'investment', 'securities'],
    usgaap: { code: '2500', name: 'Investments' },
    ifrs: { code: '2500', name: 'Investments' },
    confidence: 0.8,
  },
  {
    jgaapPattern: /^3[0-1][0-9]{2}$/,
    jgaapKeywords: ['買掛金', '支払手形', 'payable'],
    usgaap: { code: '3100', name: 'Accounts Payable' },
    ifrs: { code: '3100', name: 'Trade and Other Payables' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^3[2-3][0-9]{2}$/,
    jgaapKeywords: ['短期借入', '当座借越', 'short-term loan'],
    usgaap: { code: '3200', name: 'Short-term Debt' },
    ifrs: { code: '3200', name: 'Short-term Borrowings' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^3[4-5][0-9]{2}$/,
    jgaapKeywords: ['未払', '預り', 'accrued'],
    usgaap: { code: '3300', name: 'Accrued Expenses' },
    ifrs: { code: '3300', name: 'Accruals' },
    confidence: 0.85,
  },
  {
    jgaapPattern: /^4[0-1][0-9]{2}$/,
    jgaapKeywords: ['長期借入', '社債', 'long-term loan', 'bond'],
    usgaap: { code: '4100', name: 'Long-term Debt' },
    ifrs: { code: '4100', name: 'Non-current Borrowings' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^5[0-1][0-9]{2}$/,
    jgaapKeywords: ['資本金', 'capital', 'stock'],
    usgaap: { code: '5100', name: 'Common Stock' },
    ifrs: { code: '5100', name: 'Share Capital' },
    confidence: 0.95,
  },
  {
    jgaapPattern: /^5[2-3][0-9]{2}$/,
    jgaapKeywords: ['剰余金', '利益', 'retained', 'surplus'],
    usgaap: { code: '5200', name: 'Retained Earnings' },
    ifrs: { code: '5200', name: 'Retained Earnings' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^6[0-3][0-9]{2}$/,
    jgaapKeywords: ['売上', '収益', 'revenue', 'sales'],
    usgaap: { code: '6100', name: 'Revenue' },
    ifrs: { code: '6100', name: 'Revenue' },
    confidence: 0.95,
  },
  {
    jgaapPattern: /^6[4-6][0-9]{2}$/,
    jgaapKeywords: ['原価', 'cost', 'cogs'],
    usgaap: { code: '6200', name: 'Cost of Goods Sold' },
    ifrs: { code: '6200', name: 'Cost of Sales' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^7[0-4][0-9]{2}$/,
    jgaapKeywords: ['給与', '賞与', '退職', 'salary', 'wage', 'pension'],
    usgaap: { code: '7100', name: 'Salaries and Wages' },
    ifrs: { code: '7100', name: 'Employee Benefits Expense' },
    confidence: 0.85,
  },
  {
    jgaapPattern: /^7[5-7][0-9]{2}$/,
    jgaapKeywords: ['広告', '宣伝', 'advertising', 'marketing'],
    usgaap: { code: '7200', name: 'Advertising Expense' },
    ifrs: { code: '7200', name: 'Marketing Expense' },
    confidence: 0.85,
  },
  {
    jgaapPattern: /^7[8-9][0-9]{2}$/,
    jgaapKeywords: ['旅費', '交通', 'travel', 'transportation'],
    usgaap: { code: '7300', name: 'Travel Expense' },
    ifrs: { code: '7300', name: 'Travel Expense' },
    confidence: 0.9,
  },
  {
    jgaapPattern: /^8[0-4][0-9]{2}$/,
    jgaapKeywords: ['営業外収益', '受取利息', 'other income', 'interest'],
    usgaap: { code: '8100', name: 'Other Income' },
    ifrs: { code: '8100', name: 'Other Income' },
    confidence: 0.8,
  },
  {
    jgaapPattern: /^8[5-9][0-9]{2}$/,
    jgaapKeywords: ['営業外費用', '支払利息', 'other expense', 'interest expense'],
    usgaap: { code: '8200', name: 'Interest Expense' },
    ifrs: { code: '8200', name: 'Finance Costs' },
    confidence: 0.8,
  },
  {
    jgaapPattern: /^9[0-4][0-9]{2}$/,
    jgaapKeywords: ['特別利益', 'gain'],
    usgaap: { code: '9100', name: 'Gain on Disposal of Assets' },
    ifrs: { code: '9100', name: 'Gain on Disposal of Assets' },
    confidence: 0.7,
  },
  {
    jgaapPattern: /^9[5-9][0-9]{2}$/,
    jgaapKeywords: ['特別損失', 'loss'],
    usgaap: { code: '9200', name: 'Loss on Disposal of Assets' },
    ifrs: { code: '9200', name: 'Loss on Disposal of Assets' },
    confidence: 0.7,
  },
]

export function generateDefaultMappings(
  sourceCoaId: string,
  targetCoaId: string,
  targetStandard: 'USGAAP' | 'IFRS'
): DefaultMappingSuggestion[] {
  const suggestions: DefaultMappingSuggestion[] = []

  for (const mapping of CATEGORY_MAPPINGS) {
    const target =
      targetStandard === 'USGAAP'
        ? { code: mapping.usgaapCode, name: mapping.usgaapName }
        : { code: mapping.ifrsCode, name: mapping.ifrsName }

    suggestions.push({
      sourceCodePattern: `*:${mapping.jgaapCategory}`,
      sourceCategory: mapping.jgaapCategory,
      targetCode: target.code,
      targetName: target.name,
      targetNameEn: target.name,
      confidence: 0.7,
      mappingType: 'Nto1',
      notes: `Default mapping for ${mapping.jgaapCategory} category`,
    })
  }

  for (const mapping of JGAAP_TO_TARGET) {
    const target = targetStandard === 'USGAAP' ? mapping.usgaap : mapping.ifrs

    suggestions.push({
      sourceCodePattern: mapping.jgaapPattern,
      sourceCategory: inferCategoryFromPattern(mapping.jgaapPattern),
      targetCode: target.code,
      targetName: target.name,
      targetNameEn: target.name,
      confidence: mapping.confidence,
      mappingType: '1to1',
    })
  }

  return suggestions
}

function inferCategoryFromPattern(pattern: string | RegExp): AccountCategory {
  const patternStr = pattern.toString()
  const firstDigit = patternStr.match(/^\/?(\d)/)?.[1] || '0'

  switch (firstDigit) {
    case '1':
      return 'current_asset'
    case '2':
      return 'fixed_asset'
    case '3':
      return 'current_liability'
    case '4':
      return 'fixed_liability'
    case '5':
      return 'equity'
    case '6':
      return 'revenue'
    case '7':
      return 'sga_expense'
    case '8':
      return 'non_operating_income'
    case '9':
      return 'extraordinary_loss'
    default:
      return 'sga_expense'
  }
}

export function matchSourceAccount(
  sourceCode: string,
  sourceName: string,
  suggestions: DefaultMappingSuggestion[]
): DefaultMappingSuggestion | null {
  for (const suggestion of suggestions) {
    if (suggestion.sourceCodePattern instanceof RegExp) {
      if (suggestion.sourceCodePattern.test(sourceCode)) {
        return suggestion
      }
    } else if (typeof suggestion.sourceCodePattern === 'string') {
      if (suggestion.sourceCodePattern.startsWith('*:')) {
        continue
      }
      if (sourceCode === suggestion.sourceCodePattern) {
        return suggestion
      }
    }
  }

  const keywords = extractKeywords(sourceName)
  for (const suggestion of suggestions) {
    const pattern = suggestion.sourceCodePattern
    if (pattern instanceof RegExp) {
      const patternStr = pattern.toString().toLowerCase()
      for (const keyword of keywords) {
        if (patternStr.includes(keyword.toLowerCase())) {
          return {
            ...suggestion,
            confidence: suggestion.confidence * 0.8,
          }
        }
      }
    }
  }

  return null
}

function extractKeywords(name: string): string[] {
  const keywords: string[] = []

  const patterns = [/[一-龯]+/g, /[ぁ-ん]+/g, /[ァ-ン]+/g, /[a-zA-Z]+/g]

  for (const pattern of patterns) {
    const matches = name.match(pattern)
    if (matches) {
      keywords.push(...matches.filter((m) => m.length >= 2))
    }
  }

  return [...new Set(keywords)]
}

export function applyDefaultMappings(
  sourceItems: Array<{ id: string; code: string; name: string; category: AccountCategory }>,
  targetStandard: 'USGAAP' | 'IFRS'
): Array<{
  sourceItemId: string
  sourceCode: string
  targetCode: string
  targetName: string
  confidence: number
  mappingType: '1to1' | '1toN' | 'Nto1' | 'complex'
}> {
  const defaultSuggestions = generateDefaultMappings('', '', targetStandard)
  const results: Array<{
    sourceItemId: string
    sourceCode: string
    targetCode: string
    targetName: string
    confidence: number
    mappingType: '1to1' | '1toN' | 'Nto1' | 'complex'
  }> = []

  for (const item of sourceItems) {
    const match = matchSourceAccount(item.code, item.name, defaultSuggestions)

    if (match) {
      results.push({
        sourceItemId: item.id,
        sourceCode: item.code,
        targetCode: match.targetCode,
        targetName: match.targetName,
        confidence: match.confidence,
        mappingType: match.mappingType,
      })
    } else {
      const categoryMapping = defaultSuggestions.find(
        (s) =>
          typeof s.sourceCodePattern === 'string' && s.sourceCodePattern === `*:${item.category}`
      )

      if (categoryMapping) {
        results.push({
          sourceItemId: item.id,
          sourceCode: item.code,
          targetCode: categoryMapping.targetCode,
          targetName: categoryMapping.targetName,
          confidence: categoryMapping.confidence,
          mappingType: categoryMapping.mappingType,
        })
      }
    }
  }

  return results
}
