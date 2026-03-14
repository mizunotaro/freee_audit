import type { AIProvider, GenerateOptions, GenerateResult } from '@/lib/integrations/ai/provider'

export interface GenerateWithFallbackOptions extends GenerateOptions {
  seed?: number
  retryWithoutTemperature?: boolean
}

export interface GenerateWithFallbackResult extends GenerateResult {
  temperatureUsed?: boolean
  fallbackUsed?: boolean
}

const TEMPERATURE_ERROR_PATTERNS = [
  /temperature/i,
  /unsupported.*parameter/i,
  /invalid.*parameter/i,
  /does not support/i,
  /not supported/i,
]

function isTemperatureError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return TEMPERATURE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as Record<string, unknown>).message).toLowerCase()
    return TEMPERATURE_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  }
  return false
}

export async function generateWithFallback(
  provider: AIProvider,
  options: GenerateWithFallbackOptions
): Promise<GenerateWithFallbackResult> {
  const { seed, retryWithoutTemperature = true, ...generateOptions } = options

  try {
    const requestOptions: GenerateOptions = {
      ...generateOptions,
      ...(seed !== undefined && { seed }),
    }

    const result = await provider.generate(requestOptions)

    return {
      ...result,
      temperatureUsed: generateOptions.temperature !== undefined,
      fallbackUsed: false,
    }
  } catch (error) {
    if (
      retryWithoutTemperature &&
      generateOptions.temperature !== undefined &&
      isTemperatureError(error)
    ) {
      const fallbackOptions: GenerateOptions = {
        ...generateOptions,
        temperature: undefined,
        ...(seed !== undefined && { seed }),
      }

      const result = await provider.generate(fallbackOptions)

      return {
        ...result,
        temperatureUsed: false,
        fallbackUsed: true,
      }
    }

    throw error
  }
}

export function createSeededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return (s >>> 16) / 0x7fff
  }
}

export function seededRandomInRange(seed: number, min: number, max: number): number {
  const random = createSeededRandom(seed)
  return min + Math.floor(random() * (max - min + 1))
}
