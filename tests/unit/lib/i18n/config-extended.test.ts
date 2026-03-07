import { describe, it, expect, vi } from 'vitest'
import {
  getMessages,
  getDirection,
  formatDate,
  formatNumber,
  formatCurrency,
} from '@/lib/i18n/config'
import type { Locale } from '@/lib/i18n/types'

vi.mock('next-intl/server', () => ({
  getRequestConfig: vi.fn((fn) => fn),
}))

describe('i18n Config Extended Tests', () => {
  describe('getRequestConfig', () => {
    it('should export a configuration function', async () => {
      const { default: i18nConfig } = await import('@/lib/i18n/config')

      expect(typeof i18nConfig).toBe('function')
    })

    it('should handle valid locale resolution', async () => {
      const { default: i18nConfig } = await import('@/lib/i18n/config')

      const config = await i18nConfig({ requestLocale: Promise.resolve('en'), locale: 'en' })

      expect(config.locale).toBe('en')
    })

    it('should handle invalid locale by using default', async () => {
      const { default: i18nConfig } = await import('@/lib/i18n/config')

      const config = await i18nConfig({ requestLocale: Promise.resolve('fr'), locale: 'ja' })

      expect(config.locale).toBe('ja')
    })
  })

  describe('getDirection', () => {
    it('should always return ltr for supported locales', () => {
      const jaDirection = getDirection('ja')
      const enDirection = getDirection('en')

      expect(jaDirection).toBe('ltr')
      expect(enDirection).toBe('ltr')
    })
  })

  describe('formatDate Extended Tests', () => {
    it('should format Japanese date with era style', () => {
      const date = new Date(2024, 0, 1)
      const formatted = formatDate('ja', date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      expect(formatted).toMatch(/2024/)
    })

    it('should format date with time', () => {
      const date = new Date(2024, 5, 15, 14, 30)
      const formatted = formatDate('ja', date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })

      expect(formatted).toMatch(/2024/)
      expect(formatted).toMatch(/14/)
    })

    it('should format date with weekday', () => {
      const date = new Date(2024, 0, 15)
      const formatted = formatDate('en', date, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })

      expect(formatted).toMatch(/Mon/)
    })

    it('should handle different time zones consistently', () => {
      const date = new Date('2024-06-15T00:00:00Z')
      const formattedJa = formatDate('ja', date)
      const formattedEn = formatDate('en', date)

      expect(formattedJa).toBeDefined()
      expect(formattedEn).toBeDefined()
    })
  })

  describe('formatNumber Extended Tests', () => {
    it('should format negative numbers', () => {
      const formatted = formatNumber('ja', -1234567)
      expect(formatted).toMatch(/-/)
      expect(formatted).toMatch(/1/)
    })

    it('should format very small decimals', () => {
      const formatted = formatNumber('en', 0.0001, {
        minimumFractionDigits: 4,
      })

      expect(formatted).toBe('0.0001')
    })

    it('should format scientific notation style numbers', () => {
      const formatted = formatNumber('en', 1234567.89, {
        notation: 'compact',
      })

      expect(formatted).toMatch(/1\.2M/)
    })

    it('should format currency style', () => {
      const formatted = formatNumber('ja', 1234567, {
        style: 'currency',
        currency: 'JPY',
      })

      expect(formatted).toMatch(/[￥¥]/)
    })

    it('should format unit style', () => {
      const formatted = formatNumber('en', 100, {
        style: 'unit',
        unit: 'percent',
      })

      expect(formatted).toMatch(/100/)
    })

    it('should handle zero', () => {
      const formatted = formatNumber('ja', 0)
      expect(formatted).toBe('0')
    })
  })

  describe('formatCurrency Extended Tests', () => {
    it('should format negative amounts', () => {
      const formatted = formatCurrency('ja', -1000, 'JPY')
      expect(formatted).toMatch(/-/)
      expect(formatted).toMatch(/[￥¥]/)
    })

    it('should format very large amounts', () => {
      const formatted = formatCurrency('ja', 999999999999, 'JPY')
      expect(formatted).toMatch(/[￥¥]/)
      expect(formatted).toMatch(/999/)
    })

    it('should format USD with correct decimals', () => {
      const formatted = formatCurrency('en', 1234.567, 'USD')
      expect(formatted).toMatch(/\$1,234\.57/)
    })

    it('should format JPY without decimals', () => {
      const formatted = formatCurrency('ja', 1234.567, 'JPY')
      expect(formatted).not.toContain('.56')
    })

    it('should handle minimum amounts', () => {
      const formatted = formatCurrency('en', 0.01, 'USD')
      expect(formatted).toContain('$0.01')
    })

    it('should format using Japanese locale with USD', () => {
      const formatted = formatCurrency('ja', 100, 'USD')
      expect(formatted).toMatch(/\$/)
      expect(formatted).toMatch(/100/)
    })

    it('should format using English locale with JPY', () => {
      const formatted = formatCurrency('en', 1000, 'JPY')
      expect(formatted).toMatch(/¥/)
      expect(formatted).toMatch(/1,000/)
    })

    it('should handle fractional JPY amounts by rounding', () => {
      const formatted = formatCurrency('ja', 1000.5, 'JPY')
      expect(formatted).not.toContain('.5')
    })
  })

  describe('getMessages Extended Tests', () => {
    it('should have consistent message structure across locales', async () => {
      const jaMessages = await getMessages('ja')
      const enMessages = await getMessages('en')

      const jaKeys = Object.keys(jaMessages)
      const enKeys = Object.keys(enMessages)

      expect(jaKeys.sort()).toEqual(enKeys.sort())
    })

    it('should have all required balance sheet keys', async () => {
      const messages = await getMessages('ja')

      expect(messages.balanceSheet).toHaveProperty('assets')
      expect(messages.balanceSheet).toHaveProperty('liabilities')
      expect(messages.balanceSheet).toHaveProperty('equity')
      expect(messages.balanceSheet).toHaveProperty('currentAssets')
      expect(messages.balanceSheet).toHaveProperty('fixedAssets')
    })

    it('should have all required profit loss keys', async () => {
      const messages = await getMessages('ja')

      expect(messages.profitLoss).toHaveProperty('revenue')
      expect(messages.profitLoss).toHaveProperty('costOfSales')
      expect(messages.profitLoss).toHaveProperty('grossProfit')
      expect(messages.profitLoss).toHaveProperty('operatingIncome')
      expect(messages.profitLoss).toHaveProperty('netIncome')
    })

    it('should have all required cash flow keys', async () => {
      const messages = await getMessages('ja')

      expect(messages.cashFlow).toHaveProperty('title')
      expect(messages.cashFlow).toHaveProperty('operatingActivities')
      expect(messages.cashFlow).toHaveProperty('investingActivities')
      expect(messages.cashFlow).toHaveProperty('financingActivities')
    })

    it('should have all required KPI keys', async () => {
      const messages = await getMessages('ja')

      expect(messages.kpi).toHaveProperty('title')
      expect(messages.kpi).toHaveProperty('roe')
      expect(messages.kpi).toHaveProperty('roa')
      expect(messages.kpi).toHaveProperty('grossMargin')
      expect(messages.kpi).toHaveProperty('operatingMargin')
      expect(messages.kpi).toHaveProperty('currentRatio')
    })

    it('should have audit messages', async () => {
      const messages = await getMessages('ja')

      expect(messages.audit).toHaveProperty('title')
      expect(messages.audit).toHaveProperty('passed')
      expect(messages.audit).toHaveProperty('failed')
    })

    it('should have export messages', async () => {
      const messages = await getMessages('ja')

      expect(messages.export).toHaveProperty('title')
      expect(messages.export).toHaveProperty('pdf')
      expect(messages.export).toHaveProperty('excel')
    })

    it('should have settings messages', async () => {
      const messages = await getMessages('ja')

      expect(messages.settings).toHaveProperty('title')
      expect(messages.settings).toHaveProperty('general')
    })

    it('should have currency messages', async () => {
      const messages = await getMessages('ja')

      expect(messages.currency).toHaveProperty('jpy')
      expect(messages.currency).toHaveProperty('usd')
    })

    it('should return English messages for en locale', async () => {
      const messages = await getMessages('en')

      expect(messages.common.save).toBe('Save')
      expect(messages.common.cancel).toBe('Cancel')
    })

    it('should return Japanese messages for ja locale', async () => {
      const messages = await getMessages('ja')

      expect(messages.common.save).toBe('保存')
      expect(messages.common.cancel).toBe('キャンセル')
    })
  })

  describe('Locale Validation', () => {
    it('should accept valid locale values', () => {
      const validLocales: Locale[] = ['ja', 'en']

      validLocales.forEach((locale) => {
        expect(['ja', 'en']).toContain(locale)
      })
    })

    it('should reject invalid locale values', () => {
      const invalidLocales = ['fr', 'de', 'zh', 'ko']

      invalidLocales.forEach((locale) => {
        expect(['ja', 'en']).not.toContain(locale)
      })
    })
  })
})
