import type { Settings } from '@prisma/client'

export interface SafeSettings {
  theme: string
  aiProvider: string
  secretSource: string
  azureEndpoint: string | null
  awsAccessKeyId: string | null
  awsRegion: string | null
  gcpProjectId: string | null
  freeeClientId: string | null
  freeeCompanyId: string | null
  analysisPrompt: string | null
  fiscalYearEndMonth: number | null
  taxBusinessType: string | null
  hasOpenaiApiKey: boolean
  hasGeminiApiKey: boolean
  hasClaudeApiKey: boolean
  hasAzureApiKey: boolean
  hasAwsSecretAccessKey: boolean
  hasGcpApiKey: boolean
  hasFreeeClientSecret: boolean
}

export const SENSITIVE_FIELDS = [
  'openaiApiKey',
  'geminiApiKey',
  'claudeApiKey',
  'azureApiKey',
  'awsSecretAccessKey',
  'gcpApiKey',
  'freeeClientSecret',
] as const

export type SensitiveFieldName = (typeof SENSITIVE_FIELDS)[number]

export function sanitizeSettings(settings: Settings | null): SafeSettings {
  if (!settings) {
    return {
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
    }
  }

  return {
    theme: settings.theme,
    aiProvider: settings.aiProvider,
    secretSource: settings.secretSource,
    azureEndpoint: settings.azureEndpoint,
    awsAccessKeyId: settings.awsAccessKeyId,
    awsRegion: settings.awsRegion,
    gcpProjectId: settings.gcpProjectId,
    freeeClientId: settings.freeeClientId,
    freeeCompanyId: settings.freeeCompanyId,
    analysisPrompt: settings.analysisPrompt,
    fiscalYearEndMonth: settings.fiscalYearEndMonth,
    taxBusinessType: settings.taxBusinessType,
    hasOpenaiApiKey: !!settings.openaiApiKey,
    hasGeminiApiKey: !!settings.geminiApiKey,
    hasClaudeApiKey: !!settings.claudeApiKey,
    hasAzureApiKey: !!settings.azureApiKey,
    hasAwsSecretAccessKey: !!settings.awsSecretAccessKey,
    hasGcpApiKey: !!settings.gcpApiKey,
    hasFreeeClientSecret: !!settings.freeeClientSecret,
  }
}

export function validateApiKeyUpdate(
  userRole: string,
  updates: Record<string, unknown>
): { isValid: boolean; error?: string } {
  const hasSensitiveUpdates = SENSITIVE_FIELDS.some((field) => updates[field] !== undefined)

  if (hasSensitiveUpdates && !['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
    return {
      isValid: false,
      error: 'Only administrators can modify API keys',
    }
  }

  return { isValid: true }
}
