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
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    supportsZDR: false,
    dataResidency: ['GLOBAL'],
    apiDocsUrl: 'https://platform.deepseek.com/docs',
  },
  kimi: {
    name: 'kimi',
    displayName: 'Kimi (Moonshot)',
    supportsZDR: false,
    dataResidency: ['GLOBAL'],
    apiDocsUrl: 'https://platform.moonshot.cn/docs',
  },
  qwen: {
    name: 'qwen',
    displayName: 'Qwen (通義千問)',
    supportsZDR: false,
    dataResidency: ['GLOBAL'],
    apiDocsUrl: 'https://help.aliyun.com/zh/dashscope/',
  },
  groq: {
    name: 'groq',
    displayName: 'Groq',
    supportsZDR: false,
    dataResidency: ['US'],
    apiDocsUrl: 'https://console.groq.com/docs',
    statusUrl: 'https://status.groq.com',
  },
  azure: {
    name: 'azure',
    displayName: 'Azure OpenAI',
    supportsZDR: true,
    dataResidency: ['US', 'EU', 'GLOBAL'],
    apiDocsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/',
    statusUrl: 'https://status.azure.com',
  },
  aws: {
    name: 'aws',
    displayName: 'AWS Bedrock',
    supportsZDR: true,
    dataResidency: ['US', 'EU', 'GLOBAL'],
    apiDocsUrl: 'https://docs.aws.amazon.com/bedrock/',
    statusUrl: 'https://status.aws.amazon.com',
  },
  gcp: {
    name: 'gcp',
    displayName: 'Google Cloud Vertex AI',
    supportsZDR: false,
    dataResidency: ['US', 'EU', 'GLOBAL'],
    apiDocsUrl: 'https://cloud.google.com/vertex-ai/docs',
    statusUrl: 'https://status.cloud.google.com',
  },
  freee: {
    name: 'freee',
    displayName: 'freee API',
    supportsZDR: false,
    dataResidency: ['GLOBAL'],
    apiDocsUrl: 'https://developer.freee.co.jp/docs',
  },
  custom: {
    name: 'custom',
    displayName: 'Custom LLM',
    supportsZDR: false,
    dataResidency: ['GLOBAL'],
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
