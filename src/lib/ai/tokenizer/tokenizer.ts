import type { Tiktoken, TiktokenEncoding } from 'tiktoken'
import type { EncodingName } from './encodings'
import { getEncodingForModel, getTiktokenEncodingName } from './encodings'
import { calculateCost, getModelContextLength, type CostEstimate } from './cost-calculator'

let get_encoding: ((encoding: TiktokenEncoding) => Tiktoken) | null = null

async function loadTiktoken(): Promise<void> {
  if (get_encoding) return

  try {
    const tiktoken = await import('tiktoken')
    get_encoding = tiktoken.get_encoding
  } catch (error) {
    console.warn('[Tokenizer] Failed to load tiktoken, using fallback estimation:', error)
  }
}

loadTiktoken().catch(() => {})

export interface TokenCountResult {
  tokens: number
  encoding: EncodingName
  characterCount: number
  truncated: boolean
}

export interface TokenizerOptions {
  model?: string
  encoding?: EncodingName
  maxTokens?: number
  truncate?: boolean
}

interface EncoderCacheEntry {
  encoder: Tiktoken
  refCount: number
}

class TokenizerService {
  private encoderCache: Map<EncodingName, EncoderCacheEntry> = new Map()
  private initializationError: Error | null = null
  private fallbackRatio: number = 4

  private getEncoder(encoding: EncodingName): Tiktoken | null {
    if (!get_encoding) {
      return null
    }

    const cached = this.encoderCache.get(encoding)
    if (cached) {
      cached.refCount++
      return cached.encoder
    }

    try {
      const tiktokenName = getTiktokenEncodingName(encoding) as TiktokenEncoding
      const encoder = get_encoding(tiktokenName)
      this.encoderCache.set(encoding, { encoder, refCount: 1 })
      return encoder
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error : new Error('Unknown encoding error')
      console.warn(
        `[Tokenizer] Failed to initialize encoder for ${encoding}:`,
        this.initializationError.message
      )
      return null
    }
  }

  private releaseEncoder(_encoding: EncodingName): void {}

  private sanitizeText(text: string): string {
    return (
      text
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
    )
  }

  private estimateTokensFallback(text: string): number {
    return Math.ceil(text.length / this.fallbackRatio)
  }

  countTokens(text: string, options?: TokenizerOptions): TokenCountResult {
    const sanitizedText = this.sanitizeText(text)
    const characterCount = sanitizedText.length

    const encoding =
      options?.encoding ?? (options?.model ? getEncodingForModel(options.model) : 'cl100k_base')

    const encoder = this.getEncoder(encoding)

    let tokens: number
    let truncated = false

    if (encoder) {
      try {
        const encoded = encoder.encode(sanitizedText)
        tokens = encoded.length

        if (options?.maxTokens && tokens > options.maxTokens) {
          if (options.truncate) {
            tokens = options.maxTokens
            truncated = true
          }
        }
      } catch (error) {
        console.warn('[Tokenizer] Encoding failed, using fallback:', error)
        tokens = this.estimateTokensFallback(sanitizedText)
      } finally {
        this.releaseEncoder(encoding)
      }
    } else {
      tokens = this.estimateTokensFallback(sanitizedText)
    }

    return {
      tokens,
      encoding,
      characterCount,
      truncated,
    }
  }

  estimateCost(input: string, estimatedOutputTokens: number, model: string): CostEstimate {
    const inputResult = this.countTokens(input, { model })
    return calculateCost(inputResult.tokens, estimatedOutputTokens, model)
  }

  isWithinLimit(text: string, maxTokens: number, model?: string): boolean {
    const result = this.countTokens(text, { model, maxTokens })
    return result.tokens <= maxTokens
  }

  truncateToLimit(text: string, maxTokens: number, model?: string): string {
    const sanitizedText = this.sanitizeText(text)
    const encoding = model ? getEncodingForModel(model) : 'cl100k_base'
    const encoder = this.getEncoder(encoding)

    if (!encoder) {
      const fallbackMaxChars = maxTokens * this.fallbackRatio
      if (sanitizedText.length <= fallbackMaxChars) {
        return sanitizedText
      }
      return sanitizedText.slice(0, fallbackMaxChars)
    }

    try {
      const encoded = encoder.encode(sanitizedText)

      if (encoded.length <= maxTokens) {
        return sanitizedText
      }

      const truncatedEncoded = encoded.slice(0, maxTokens)
      const decodedBytes = encoder.decode(truncatedEncoded)
      const decoder = new TextDecoder('utf-8', { fatal: false })

      return decoder.decode(decodedBytes)
    } catch (error) {
      console.warn('[Tokenizer] Truncation failed, using character-based fallback:', error)
      const fallbackMaxChars = maxTokens * this.fallbackRatio
      return sanitizedText.slice(0, fallbackMaxChars)
    } finally {
      this.releaseEncoder(encoding)
    }
  }

  estimateImageTokens(
    width: number,
    height: number,
    detail: 'low' | 'high' | 'auto' = 'auto'
  ): number {
    if (detail === 'low') {
      return 85
    }

    const maxDimension = 2048
    const tileSize = 512

    let scaledWidth = width
    let scaledHeight = height

    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height)
      scaledWidth = Math.floor(width * ratio)
      scaledHeight = Math.floor(height * ratio)
    }

    if (scaledWidth > tileSize || scaledHeight > tileSize) {
      const minDimension = Math.min(scaledWidth, scaledHeight)
      const scaleFactor = minDimension / tileSize
      scaledWidth = Math.floor(scaledWidth / scaleFactor)
      scaledHeight = Math.floor(scaledHeight / scaleFactor)
    }

    const tilesX = Math.ceil(scaledWidth / tileSize)
    const tilesY = Math.ceil(scaledHeight / tileSize)
    const numTiles = tilesX * tilesY

    return numTiles * 170 + 85
  }

  getContextLength(model: string): number {
    return getModelContextLength(model)
  }

  getCacheStats(): { size: number; encodings: EncodingName[] } {
    return {
      size: this.encoderCache.size,
      encodings: Array.from(this.encoderCache.keys()),
    }
  }

  clearCache(): void {
    const entries = Array.from(this.encoderCache.entries())
    for (const [_encoding, entry] of entries) {
      entry.encoder.free()
    }
    this.encoderCache.clear()
  }

  getInitializationError(): Error | null {
    return this.initializationError
  }
}

export const tokenizerService = new TokenizerService()

export { TokenizerService }
export type { CostEstimate }
