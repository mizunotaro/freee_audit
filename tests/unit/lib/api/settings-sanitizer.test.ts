import { describe, it, expect } from 'vitest'
import type { Settings } from '@prisma/client'
import {
  sanitizeSettings,
  validateApiKeyUpdate,
  SENSITIVE_FIELDS,
} from '@/lib/api/settings-sanitizer'

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 'settings-1',
    userId: 'user-1',
    theme: 'system',
    aiProvider: 'openai',
    aiModel: null,
    aiZdrEnabled: true,
    aiDataResidency: null,
    openaiApiKey: null,
    geminiApiKey: null,
    claudeApiKey: null,
    azureApiKey: null,
    azureEndpoint: null,
    awsAccessKeyId: null,
    awsSecretAccessKey: null,
    awsRegion: 'ap-northeast-1',
    gcpApiKey: null,
    gcpProjectId: null,
    openrouterApiKey: null,
    secretSource: 'local',
    freeeClientId: null,
    freeeClientSecret: null,
    freeeCompanyId: null,
    analysisPrompt: null,
    fiscalYearEndMonth: 12,
    taxBusinessType: 'general',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Settings
}

describe('settings-sanitizer', () => {
  describe('SENSITIVE_FIELDS', () => {
    it('lists the seven secret fields', () => {
      expect(SENSITIVE_FIELDS).toEqual([
        'openaiApiKey',
        'geminiApiKey',
        'claudeApiKey',
        'azureApiKey',
        'awsSecretAccessKey',
        'gcpApiKey',
        'freeeClientSecret',
      ])
    })
  })

  describe('sanitizeSettings', () => {
    it('returns safe defaults when settings is null', () => {
      const result = sanitizeSettings(null)

      expect(result).toEqual({
        theme: 'system',
        aiProvider: 'openai',
        secretSource: 'local',
        azureEndpoint: null,
        awsAccessKeyId: null,
        awsRegion: 'ap-northeast-1',
        gcpProjectId: null,
        freeeClientId: null,
        freeeCompanyId: null,
        analysisPrompt: null,
        fiscalYearEndMonth: 12,
        taxBusinessType: 'general',
        hasOpenaiApiKey: false,
        hasGeminiApiKey: false,
        hasClaudeApiKey: false,
        hasAzureApiKey: false,
        hasAwsSecretAccessKey: false,
        hasGcpApiKey: false,
        hasFreeeClientSecret: false,
      })
    })

    it('maps plain settings fields straight through', () => {
      const settings = createSettings({
        theme: 'dark',
        aiProvider: 'claude',
        secretSource: 'env',
        azureEndpoint: 'https://azure.example',
        awsAccessKeyId: 'AKIAKEY',
        awsRegion: 'us-east-1',
        gcpProjectId: 'proj-1',
        freeeClientId: 'client-id',
        freeeCompanyId: '12345',
        analysisPrompt: 'Analyze this',
        fiscalYearEndMonth: 3,
        taxBusinessType: 'blue',
      })

      const result = sanitizeSettings(settings)

      expect(result.theme).toBe('dark')
      expect(result.aiProvider).toBe('claude')
      expect(result.secretSource).toBe('env')
      expect(result.azureEndpoint).toBe('https://azure.example')
      expect(result.awsAccessKeyId).toBe('AKIAKEY')
      expect(result.awsRegion).toBe('us-east-1')
      expect(result.gcpProjectId).toBe('proj-1')
      expect(result.freeeClientId).toBe('client-id')
      expect(result.freeeCompanyId).toBe('12345')
      expect(result.analysisPrompt).toBe('Analyze this')
      expect(result.fiscalYearEndMonth).toBe(3)
      expect(result.taxBusinessType).toBe('blue')
    })

    it('reports has* booleans true when secrets are present', () => {
      const settings = createSettings({
        openaiApiKey: 'sk-openai',
        geminiApiKey: 'gem-key',
        claudeApiKey: 'claude-key',
        azureApiKey: 'azure-key',
        awsSecretAccessKey: 'aws-secret',
        gcpApiKey: 'gcp-key',
        freeeClientSecret: 'freee-secret',
      })

      const result = sanitizeSettings(settings)

      expect(result.hasOpenaiApiKey).toBe(true)
      expect(result.hasGeminiApiKey).toBe(true)
      expect(result.hasClaudeApiKey).toBe(true)
      expect(result.hasAzureApiKey).toBe(true)
      expect(result.hasAwsSecretAccessKey).toBe(true)
      expect(result.hasGcpApiKey).toBe(true)
      expect(result.hasFreeeClientSecret).toBe(true)
    })

    it('reports has* booleans false when secrets are null', () => {
      const result = sanitizeSettings(createSettings())

      expect(result.hasOpenaiApiKey).toBe(false)
      expect(result.hasGeminiApiKey).toBe(false)
      expect(result.hasClaudeApiKey).toBe(false)
      expect(result.hasAzureApiKey).toBe(false)
      expect(result.hasAwsSecretAccessKey).toBe(false)
      expect(result.hasGcpApiKey).toBe(false)
      expect(result.hasFreeeClientSecret).toBe(false)
    })

    it('never leaks secret values into the sanitized output', () => {
      const result = sanitizeSettings(
        createSettings({ openaiApiKey: 'sk-leak', claudeApiKey: 'claude-leak' })
      )

      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain('sk-leak')
      expect(serialized).not.toContain('claude-leak')
    })
  })

  describe('validateApiKeyUpdate', () => {
    it('rejects sensitive updates from a non-admin role', () => {
      const result = validateApiKeyUpdate('VIEWER', { openaiApiKey: 'sk-x' })

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Only administrators can modify API keys')
    })

    it('rejects sensitive updates from an accountant', () => {
      const result = validateApiKeyUpdate('ACCOUNTANT', { freeeClientSecret: 's' })

      expect(result.isValid).toBe(false)
    })

    it('allows sensitive updates from ADMIN', () => {
      const result = validateApiKeyUpdate('ADMIN', { openaiApiKey: 'sk-x' })
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('allows sensitive updates from SUPER_ADMIN', () => {
      const result = validateApiKeyUpdate('SUPER_ADMIN', { claudeApiKey: 'k' })
      expect(result.isValid).toBe(true)
    })

    it('allows every declared sensitive field for an admin', () => {
      for (const field of SENSITIVE_FIELDS) {
        const result = validateApiKeyUpdate('ADMIN', { [field]: 'value' })
        expect(result.isValid).toBe(true)
      }
    })

    it('allows non-sensitive updates regardless of role', () => {
      const result = validateApiKeyUpdate('VIEWER', { theme: 'dark', aiProvider: 'gemini' })
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('treats an explicit undefined sensitive value as absent', () => {
      const result = validateApiKeyUpdate('VIEWER', { openaiApiKey: undefined })
      expect(result.isValid).toBe(true)
    })
  })
})
