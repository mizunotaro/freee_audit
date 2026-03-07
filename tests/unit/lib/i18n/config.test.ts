import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  locales,
  defaultLocale,
  getMessages,
  getDirection,
  formatDate,
  formatNumber,
  formatCurrency,
} from '@/lib/i18n/config'
import type { Locale, Messages } from '@/lib/i18n/types'

vi.mock('next-intl/server', () => ({
  getRequestConfig: vi.fn((fn) => fn),
}))

describe('i18n Config', () => {
  describe('locales', () => {
    it('should include Japanese and English', () => {
      expect(locales).toContain('ja')
      expect(locales).toContain('en')
    })

    it('should have exactly two locales', () => {
      expect(locales).toHaveLength(2)
    })
  })

  describe('defaultLocale', () => {
    it('should be Japanese', () => {
      expect(defaultLocale).toBe('ja')
    })
  })

  describe('getMessages', () => {
    it('should return messages for Japanese locale', async () => {
      const messages = await getMessages('ja')
      expect(messages).toBeDefined()
      expect(messages.common).toBeDefined()
      expect(messages.navigation).toBeDefined()
    })

    it('should return messages for English locale', async () => {
      const messages = await getMessages('en')
      expect(messages).toBeDefined()
      expect(messages.common).toBeDefined()
      expect(messages.navigation).toBeDefined()
    })

    it('should return correct structure for common messages', async () => {
      const messages = await getMessages('ja')
      expect(messages.common).toHaveProperty('save')
      expect(messages.common).toHaveProperty('cancel')
      expect(messages.common).toHaveProperty('delete')
      expect(messages.common).toHaveProperty('edit')
    })

    it('should return correct structure for navigation messages', async () => {
      const messages = await getMessages('ja')
      expect(messages.navigation).toHaveProperty('dashboard')
      expect(messages.navigation).toHaveProperty('reports')
      expect(messages.navigation).toHaveProperty('settings')
    })

    it('should return correct structure for report messages', async () => {
      const messages = await getMessages('ja')
      expect(messages.report).toHaveProperty('balanceSheet')
      expect(messages.report).toHaveProperty('profitLoss')
      expect(messages.report).toHaveProperty('cashFlow')
    })
  })

  describe('getDirection', () => {
    it('should return ltr for Japanese', () => {
      expect(getDirection('ja')).toBe('ltr')
    })

    it('should return ltr for English', () => {
      expect(getDirection('en')).toBe('ltr')
    })
  })

  describe('formatDate', () => {
    it('should format date for Japanese locale', () => {
      const date = new Date(2024, 0, 15)
      const formatted = formatDate('ja', date)
      expect(formatted).toMatch(/2024/)
      expect(formatted).toMatch(/1/)
      expect(formatted).toMatch(/15/)
    })

    it('should format date for English locale', () => {
      const date = new Date(2024, 0, 15)
      const formatted = formatDate('en', date)
      expect(formatted).toMatch(/2024/)
    })

    it('should respect custom options', () => {
      const date = new Date(2024, 0, 15)
      const formatted = formatDate('en', date, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      expect(formatted).toMatch(/Monday/)
      expect(formatted).toMatch(/January/)
      expect(formatted).toMatch(/2024/)
    })

    it('should use default options when not provided', () => {
      const date = new Date(2024, 5, 15)
      const formatted = formatDate('ja', date)
      expect(formatted).toBeDefined()
      expect(formatted.length).toBeGreaterThan(0)
    })
  })

  describe('formatNumber', () => {
    it('should format number for Japanese locale', () => {
      const formatted = formatNumber('ja', 1234567)
      expect(formatted).toMatch(/1/)
      expect(formatted).toMatch(/234/)
      expect(formatted).toMatch(/567/)
    })

    it('should format number for English locale', () => {
      const formatted = formatNumber('en', 1234567)
      expect(formatted).toContain('1')
      expect(formatted).toContain('234')
      expect(formatted).toContain('567')
    })

    it('should respect custom options', () => {
      const formatted = formatNumber('en', 0.123, {
        style: 'percent',
        minimumFractionDigits: 2,
      })
      expect(formatted).toMatch(/12/)
      expect(formatted).toMatch(/%/)
    })

    it('should handle decimal numbers', () => {
      const formatted = formatNumber('en', 1234.567, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      expect(formatted).toMatch(/1,234\.57/)
    })

    it('should handle large numbers', () => {
      const formatted = formatNumber('ja', 1000000000)
      expect(formatted).toBeDefined()
      expect(formatted.length).toBeGreaterThan(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format JPY currency for Japanese locale', () => {
      const formatted = formatCurrency('ja', 12345, 'JPY')
      expect(formatted).toMatch(/[￥¥]/)
      expect(formatted).toContain('12,345')
    })

    it('should format USD currency for English locale', () => {
      const formatted = formatCurrency('en', 123.45, 'USD')
      expect(formatted).toContain('$')
      expect(formatted).toContain('123.45')
    })

    it('should format JPY with no decimals', () => {
      const formatted = formatCurrency('ja', 1000, 'JPY')
      expect(formatted).not.toContain('.00')
    })

    it('should format USD with two decimals', () => {
      const formatted = formatCurrency('en', 1000, 'USD')
      expect(formatted).toContain('.00')
    })

    it('should handle zero amount', () => {
      const formattedJpy = formatCurrency('ja', 0, 'JPY')
      const formattedUsd = formatCurrency('en', 0, 'USD')
      expect(formattedJpy).toMatch(/[￥¥]/)
      expect(formattedUsd).toContain('$')
    })

    it('should handle large amounts', () => {
      const formatted = formatCurrency('ja', 1000000000, 'JPY')
      expect(formatted).toMatch(/[￥¥]/)
    })
  })
})

describe('Locale Types', () => {
  it('should accept valid locale values', () => {
    const ja: Locale = 'ja'
    const en: Locale = 'en'
    expect(ja).toBe('ja')
    expect(en).toBe('en')
  })
})

describe('Messages Structure', () => {
  it('should have all required namespaces', async () => {
    const messages = await getMessages('ja')

    const requiredNamespaces = [
      'common',
      'navigation',
      'report',
      'balanceSheet',
      'profitLoss',
      'cashFlow',
      'cashFlowStatement',
      'kpi',
      'budget',
      'audit',
      'export',
      'currency',
      'settings',
      'language',
    ] as const

    for (const ns of requiredNamespaces) {
      expect(messages[ns]).toBeDefined()
    }
  })

  it('should have balance sheet labels', async () => {
    const messages = await getMessages('ja')
    expect(messages.balanceSheet).toHaveProperty('title')
    expect(messages.balanceSheet).toHaveProperty('assets')
    expect(messages.balanceSheet).toHaveProperty('liabilities')
    expect(messages.balanceSheet).toHaveProperty('equity')
  })

  it('should have profit loss labels', async () => {
    const messages = await getMessages('ja')
    expect(messages.profitLoss).toHaveProperty('title')
    expect(messages.profitLoss).toHaveProperty('revenue')
    expect(messages.profitLoss).toHaveProperty('grossProfit')
    expect(messages.profitLoss).toHaveProperty('netIncome')
  })

  it('should have cash flow labels', async () => {
    const messages = await getMessages('ja')
    expect(messages.cashFlow).toHaveProperty('title')
    expect(messages.cashFlow).toHaveProperty('operatingActivities')
    expect(messages.cashFlow).toHaveProperty('investingActivities')
    expect(messages.cashFlow).toHaveProperty('financingActivities')
  })

  it('should have KPI labels', async () => {
    const messages = await getMessages('ja')
    expect(messages.kpi).toHaveProperty('title')
    expect(messages.kpi).toHaveProperty('roe')
    expect(messages.kpi).toHaveProperty('roa')
    expect(messages.kpi).toHaveProperty('ros')
  })

  it('should have audit labels', async () => {
    const messages = await getMessages('ja')
    expect(messages.audit).toHaveProperty('title')
    expect(messages.audit).toHaveProperty('status')
    expect(messages.audit).toHaveProperty('passed')
    expect(messages.audit).toHaveProperty('failed')
  })
})

describe('Localization Consistency', () => {
  it('should have consistent keys between ja and en common messages', async () => {
    const jaMessages = await getMessages('ja')
    const enMessages = await getMessages('en')

    const jaCommonKeys = Object.keys(jaMessages.common)
    const enCommonKeys = Object.keys(enMessages.common)

    expect(jaCommonKeys.sort()).toEqual(enCommonKeys.sort())
  })

  it('should have en navigation keys present in ja', async () => {
    const jaMessages = await getMessages('ja')
    const enMessages = await getMessages('en')

    const enNavKeys = Object.keys(enMessages.navigation)

    for (const key of enNavKeys) {
      expect(jaMessages.navigation).toHaveProperty(key)
    }
  })
})
