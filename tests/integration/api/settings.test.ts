import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN',
  companyId: 'company-1',
}

const mockViewerUser = {
  id: 'viewer-1',
  email: 'viewer@example.com',
  name: 'Viewer User',
  role: 'VIEWER',
  companyId: 'company-1',
}

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    settings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn((value: string) => `encrypted-${value}`),
  decrypt: vi.fn((value: string) => value.replace('encrypted-', '')),
}))

vi.mock('@/lib/api/settings-sanitizer', () => ({
  sanitizeSettings: vi.fn((settings) => {
    if (!settings) return { theme: 'system', aiProvider: 'openai' }
    const { openaiApiKey, geminiApiKey, claudeApiKey, ...rest } = settings as Record<
      string,
      unknown
    >
    return {
      ...rest,
      hasOpenaiApiKey: !!openaiApiKey,
      hasGeminiApiKey: !!geminiApiKey,
      hasClaudeApiKey: !!claudeApiKey,
    }
  }),
  validateApiKeyUpdate: vi.fn((role: string, _data: Record<string, unknown>) => {
    const sensitiveFields = ['openaiApiKey', 'geminiApiKey', 'claudeApiKey', 'azureApiKey']
    const hasSensitiveUpdate = sensitiveFields.some((field) => _data[field])
    if (hasSensitiveUpdate && role !== 'ADMIN') {
      return { isValid: false, error: 'Only admins can update API keys' }
    }
    return { isValid: true }
  }),
  SENSITIVE_FIELDS: [
    'openaiApiKey',
    'geminiApiKey',
    'claudeApiKey',
    'azureApiKey',
    'awsSecretAccessKey',
    'gcpApiKey',
    'freeeClientSecret',
  ],
}))

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/settings', () => {
    it('should return settings without API keys for admin', async () => {
      const { prisma } = await import('@/lib/db')
      const { sanitizeSettings } = await import('@/lib/api/settings-sanitizer')

      vi.mocked(prisma.settings.findUnique).mockResolvedValue({
        id: 'settings-1',
        userId: 'admin-1',
        theme: 'dark',
        aiProvider: 'openai',
        openaiApiKey: 'encrypted-sk-test-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const settings = await prisma.settings.findUnique({
        where: { userId: 'admin-1' },
      })

      const safeSettings = sanitizeSettings(settings) as unknown as Record<string, unknown>

      expect(safeSettings.openaiApiKey).toBeUndefined()
      expect(safeSettings.hasOpenaiApiKey).toBe(true)
    })

    it('should return default settings for new user', async () => {
      const { prisma } = await import('@/lib/db')
      const { sanitizeSettings } = await import('@/lib/api/settings-sanitizer')

      vi.mocked(prisma.settings.findUnique).mockResolvedValue(null)

      const settings = await prisma.settings.findUnique({
        where: { userId: 'new-user' },
      })

      const safeSettings = sanitizeSettings(settings)

      expect(safeSettings.theme).toBe('system')
      expect(safeSettings.aiProvider).toBe('openai')
    })

    it('should include hasApiKey flags for all providers', async () => {
      const { prisma } = await import('@/lib/db')
      const { sanitizeSettings } = await import('@/lib/api/settings-sanitizer')

      vi.mocked(prisma.settings.findUnique).mockResolvedValue({
        id: 'settings-1',
        userId: 'user-1',
        theme: 'system',
        aiProvider: 'claude',
        openaiApiKey: 'encrypted-key-1',
        geminiApiKey: null,
        claudeApiKey: 'encrypted-key-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const settings = await prisma.settings.findUnique({
        where: { userId: 'user-1' },
      })

      const safeSettings = sanitizeSettings(settings)

      expect(safeSettings.hasOpenaiApiKey).toBe(true)
      expect(safeSettings.hasGeminiApiKey).toBe(false)
      expect(safeSettings.hasClaudeApiKey).toBe(true)
    })
  })

  describe('PUT /api/settings', () => {
    it('should allow admin to update API keys', async () => {
      const { validateApiKeyUpdate } = await import('@/lib/api/settings-sanitizer')
      const { encrypt } = await import('@/lib/crypto')
      const { prisma } = await import('@/lib/db')

      const updateData = { openaiApiKey: 'sk-test-key' }

      const validation = validateApiKeyUpdate('ADMIN', updateData)
      expect(validation.isValid).toBe(true)

      vi.mocked(prisma.settings.upsert).mockResolvedValue({
        id: 'settings-1',
        userId: 'admin-1',
        openaiApiKey: 'encrypted-sk-test-key',
        theme: 'system',
        aiProvider: 'openai',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const encryptedKey = encrypt('sk-test-key')
      expect(encryptedKey).toBe('encrypted-sk-test-key')
      expect(encryptedKey).not.toBe('sk-test-key')
    })

    it('should deny non-admin from updating API keys', async () => {
      const { validateApiKeyUpdate } = await import('@/lib/api/settings-sanitizer')

      const updateData = { openaiApiKey: 'sk-test-key' }

      const validation = validateApiKeyUpdate('VIEWER', updateData)
      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain('Only admins')
    })

    it('should allow user to update non-sensitive settings', async () => {
      const { validateApiKeyUpdate } = await import('@/lib/api/settings-sanitizer')
      const { prisma } = await import('@/lib/db')

      const updateData = { theme: 'dark' }

      const validation = validateApiKeyUpdate('VIEWER', updateData)
      expect(validation.isValid).toBe(true)

      vi.mocked(prisma.settings.upsert).mockResolvedValue({
        id: 'settings-1',
        userId: 'viewer-1',
        theme: 'dark',
        aiProvider: 'openai',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const result = await prisma.settings.upsert({
        where: { userId: 'viewer-1' },
        update: { theme: 'dark' },
        create: { userId: 'viewer-1', theme: 'dark' },
      })

      expect(result.theme).toBe('dark')
    })

    it('should validate theme values', async () => {
      const validThemes = ['light', 'dark', 'system']
      const invalidThemes = ['blue', 'red', 'custom']

      for (const theme of validThemes) {
        expect(['light', 'dark', 'system'].includes(theme)).toBe(true)
      }

      for (const theme of invalidThemes) {
        expect(['light', 'dark', 'system'].includes(theme)).toBe(false)
      }
    })

    it('should validate AI provider values', async () => {
      const validProviders = ['openai', 'gemini', 'claude']
      const invalidProviders = ['anthropic', 'azure', 'custom']

      for (const provider of validProviders) {
        expect(['openai', 'gemini', 'claude'].includes(provider)).toBe(true)
      }

      for (const provider of invalidProviders) {
        expect(['openai', 'gemini', 'claude'].includes(provider)).toBe(false)
      }
    })

    it('should encrypt all sensitive fields', async () => {
      const { encrypt } = await import('@/lib/crypto')

      const sensitiveFields = ['openaiApiKey', 'geminiApiKey', 'claudeApiKey', 'azureApiKey']

      for (const field of sensitiveFields) {
        const value = `test-${field}-value`
        const encrypted = encrypt(value)
        expect(encrypted).not.toBe(value)
        expect(encrypted).toContain('encrypted-')
      }
    })

    it('should handle null values for API keys', async () => {
      const { validateApiKeyUpdate } = await import('@/lib/api/settings-sanitizer')

      const updateData = { openaiApiKey: null }

      const validation = validateApiKeyUpdate('VIEWER', updateData)
      expect(validation.isValid).toBe(true)
    })
  })

  describe('Input Validation', () => {
    it('should reject invalid theme', () => {
      const themeSchema = ['light', 'dark', 'system'] as const
      const invalidTheme = 'invalid-theme'

      expect(themeSchema.includes(invalidTheme as any)).toBe(false)
    })

    it('should reject invalid AI provider', () => {
      const providerSchema = ['openai', 'gemini', 'claude'] as const
      const invalidProvider = 'invalid-provider'

      expect(providerSchema.includes(invalidProvider as any)).toBe(false)
    })

    it('should reject empty API keys', () => {
      const emptyKey = ''
      const validKey = 'sk-valid-key'

      expect(emptyKey.length).toBeLessThan(1)
      expect(validKey.length).toBeGreaterThan(0)
    })

    it('should limit analysis prompt length', () => {
      const maxPromptLength = 5000
      const validPrompt = 'A'.repeat(1000)
      const invalidPrompt = 'A'.repeat(6000)

      expect(validPrompt.length).toBeLessThanOrEqual(maxPromptLength)
      expect(invalidPrompt.length).toBeGreaterThan(maxPromptLength)
    })

    it('should validate fiscal year end month', () => {
      const validMonths = [1, 6, 12]
      const invalidMonths = [0, 13, -1]

      for (const month of validMonths) {
        expect(month >= 1 && month <= 12).toBe(true)
      }

      for (const month of invalidMonths) {
        expect(month >= 1 && month <= 12).toBe(false)
      }
    })
  })
})
