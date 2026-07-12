import { describe, it, expect, vi } from 'vitest'

const { getRequestConfigMock } = vi.hoisted(() => ({
  getRequestConfigMock: vi.fn((config: unknown) => config),
}))

vi.mock('next-intl/server', () => ({
  getRequestConfig: getRequestConfigMock,
}))

vi.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['ja', 'en'],
    defaultLocale: 'ja',
    localePrefix: 'always',
  },
}))

import requestConfig from '@/i18n/request'

type ConfigResult = { locale: string; messages: Record<string, unknown> }
type ConfigFn = (ctx: { requestLocale: Promise<unknown> | unknown }) => Promise<ConfigResult>

const getConfig = requestConfig as unknown as ConfigFn

function withLocale(value: unknown): Promise<ConfigResult> {
  return getConfig({ requestLocale: Promise.resolve(value) })
}

function saveMessage(result: ConfigResult): unknown {
  const common = result.messages.common as { save?: unknown } | undefined
  return common?.save
}

describe('src/i18n/request', () => {
  describe('module registration', () => {
    it('registers a request config with next-intl exactly once at import', () => {
      expect(getRequestConfigMock).toHaveBeenCalledTimes(1)
    })

    it('exports the config initializer returned by getRequestConfig', () => {
      expect(typeof getConfig).toBe('function')
    })
  })

  describe('happy path — supported locales pass through', () => {
    it('returns locale "ja" and the Japanese message bundle for requestLocale "ja"', async () => {
      const result = await withLocale('ja')
      expect(result.locale).toBe('ja')
      expect(saveMessage(result)).toBe('保存')
    })

    it('returns locale "en" and the English message bundle for requestLocale "en"', async () => {
      const result = await withLocale('en')
      expect(result.locale).toBe('en')
      expect(saveMessage(result)).toBe('Save')
    })

    it('loads a distinct message bundle per locale', async () => {
      const ja = await withLocale('ja')
      const en = await withLocale('en')
      expect(saveMessage(ja)).not.toBe(saveMessage(en))
    })

    it('awaits a thenable requestLocale (matches next-intl contract)', async () => {
      const result = await getConfig({ requestLocale: Promise.resolve('en') })
      expect(result.locale).toBe('en')
    })
  })

  describe('return shape', () => {
    it('returns an object with exactly locale and messages keys', async () => {
      const result = await withLocale('ja')
      expect(Object.keys(result).sort()).toEqual(['locale', 'messages'])
    })

    it('provides messages as a non-null object', async () => {
      const result = await withLocale('ja')
      expect(typeof result.messages).toBe('object')
      expect(result.messages).not.toBeNull()
    })
  })

  describe('fail-safe — unsupported/missing locale degrades to default "ja"', () => {
    const fallbackCases: Array<{ label: string; value: unknown }> = [
      { label: 'undefined', value: undefined },
      { label: 'null', value: null },
      { label: 'empty string', value: '' },
      { label: 'unsupported "fr"', value: 'fr' },
      { label: 'unsupported "de"', value: 'de' },
      { label: 'uppercase "JA" (case-sensitive)', value: 'JA' },
      { label: 'regional "ja-JP"', value: 'ja-JP' },
      { label: 'regional "en-US"', value: 'en-US' },
      { label: 'numeric "1"', value: '1' },
    ]

    it.each(fallbackCases)('falls back to default locale for $label', async ({ value }) => {
      const result = await withLocale(value)
      expect(result.locale).toBe('ja')
    })

    it('still returns a valid message bundle after fallback (safe state)', async () => {
      const result = await withLocale('fr')
      expect(result.locale).toBe('ja')
      expect(saveMessage(result)).toBe('保存')
    })

    it('returns the exact default-locale bundle after fallback', async () => {
      const fallback = await withLocale('does-not-exist')
      const direct = await withLocale('ja')
      expect(fallback.messages).toEqual(direct.messages)
    })
  })

  describe('error path', () => {
    it('propagates a rejected requestLocale promise (no internal catch)', async () => {
      await expect(
        getConfig({ requestLocale: Promise.reject(new Error('locale unavailable')) })
      ).rejects.toThrow('locale unavailable')
    })
  })
})
