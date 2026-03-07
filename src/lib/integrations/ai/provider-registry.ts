import { AIProviderType } from './provider'

export type DataResidency = 'US' | 'EU' | 'GLOBAL'

export interface ProviderMetadata {
  name: AIProviderType
  displayName: string
  supportsZDR: boolean
  dataResidency: DataResidency[]
  apiDocsUrl?: string
  statusUrl?: string
}

export const PROVIDER_REGISTRY: Record<AIProviderType, ProviderMetadata> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    supportsZDR: true,
    dataResidency: ['US'],
    apiDocsUrl: 'https://platform.openai.com/docs',
    statusUrl: 'https://status.openai.com',
  },
  claude: {
    name: 'claude',
    displayName: 'Anthropic Claude',
    supportsZDR: true,
    dataResidency: ['US', 'EU'],
    apiDocsUrl: 'https://docs.anthropic.com',
    statusUrl: 'https://status.anthropic.com',
  },
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    supportsZDR: false,
    dataResidency: ['US', 'EU', 'GLOBAL'],
    apiDocsUrl: 'https://ai.google.dev/docs',
    statusUrl: 'https://status.cloud.google.com',
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    supportsZDR: false,
    dataResidency: ['GLOBAL'],
    apiDocsUrl: 'https://openrouter.ai/docs',
  },
}

export function getProviderMetadata(provider: AIProviderType): ProviderMetadata | undefined {
  return PROVIDER_REGISTRY[provider]
}

export function getProvidersByZDR(supportsZDR: boolean): AIProviderType[] {
  return Object.values(PROVIDER_REGISTRY)
    .filter((p) => p.supportsZDR === supportsZDR)
    .map((p) => p.name)
}

export function getProvidersByDataResidency(residency: DataResidency): AIProviderType[] {
  return Object.values(PROVIDER_REGISTRY)
    .filter((p) => p.dataResidency.includes(residency))
    .map((p) => p.name)
}

export function filterProvidersBySecurity(
  providers: AIProviderType[],
  options: {
    requireZDR?: boolean
    allowedDataResidency?: DataResidency[]
  }
): AIProviderType[] {
  return providers.filter((provider) => {
    const metadata = PROVIDER_REGISTRY[provider]
    if (!metadata) return false

    if (options.requireZDR && !metadata.supportsZDR) {
      return false
    }

    if (options.allowedDataResidency && options.allowedDataResidency.length > 0) {
      const hasAllowedResidency = metadata.dataResidency.some((r) =>
        options.allowedDataResidency!.includes(r)
      )
      if (!hasAllowedResidency) {
        return false
      }
    }

    return true
  })
}
