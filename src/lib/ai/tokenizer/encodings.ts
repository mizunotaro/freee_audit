export type EncodingName = 'cl100k_base' | 'o200k_base'

export interface EncodingInfo {
  name: EncodingName
  tiktokenName: string
  description: string
}

export const ENCODING_INFO: Record<EncodingName, EncodingInfo> = {
  cl100k_base: {
    name: 'cl100k_base',
    tiktokenName: 'cl100k_base',
    description:
      'Used by GPT-4, GPT-4 Turbo, GPT-3.5 Turbo, text-embedding-ada-002, Claude models (approximate)',
  },
  o200k_base: {
    name: 'o200k_base',
    tiktokenName: 'o200k_base',
    description: 'Used by GPT-4o, GPT-4o-mini, GPT-5 series',
  },
}

const MODEL_PATTERNS: Array<{ pattern: RegExp; encoding: EncodingName }> = [
  { pattern: /^gpt-4o-mini(-[\da-]{4,})?$/i, encoding: 'o200k_base' },
  { pattern: /^gpt-4o(-[\da-]{4,})?$/i, encoding: 'o200k_base' },
  { pattern: /^gpt-4\.1(-\w+)?$/i, encoding: 'o200k_base' },
  { pattern: /^gpt-5(-\w+)?$/i, encoding: 'o200k_base' },
  { pattern: /^gpt-4-turbo(-\d{4})?$/i, encoding: 'cl100k_base' },
  { pattern: /^gpt-4(-\d{4})?$/i, encoding: 'cl100k_base' },
  { pattern: /^gpt-3\.5-turbo(-\d{4})?$/i, encoding: 'cl100k_base' },
  { pattern: /^claude-/i, encoding: 'cl100k_base' },
  { pattern: /^gemini-/i, encoding: 'cl100k_base' },
]

export function getEncodingForModel(model: string): EncodingName {
  const sanitizedModel = model.trim().toLowerCase()

  for (const { pattern, encoding } of MODEL_PATTERNS) {
    if (pattern.test(sanitizedModel)) {
      return encoding
    }
  }

  return 'cl100k_base'
}

export function getTiktokenEncodingName(encoding: EncodingName): string {
  return ENCODING_INFO[encoding].tiktokenName
}
