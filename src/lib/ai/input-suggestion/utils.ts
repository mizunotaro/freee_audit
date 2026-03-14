export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (!input) return ''
  return input
    .normalize('NFC')
    .replace(
      // eslint-disable-next-line no-control-regex
      /[\x00-\x1F\x7F]/g,
      ''
    )
    .slice(0, maxLength)
    .trim()
}

export function validateNumber(
  value: unknown,
  constraints?: { min?: number; max?: number }
): number | undefined {
  if (value === undefined || value === null) return undefined
  const num = Number(value)
  if (!isFinite(num)) return undefined
  if (constraints?.min !== undefined && num < constraints.min) return undefined
  if (constraints?.max !== undefined && num > constraints.max) return undefined
  return num
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function formatCurrency(value: number, language: 'ja' | 'en' = 'ja'): string {
  if (language === 'ja') {
    if (value >= 100000000) {
      return `¥${Math.round(value / 100000000)}億`
    }
    return `¥${Math.round(value / 10000)}万円`
  }
  return `$${value.toLocaleString()}`
}

export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    console.warn('Division by zero, returning 0')
    return 0
  }
  return numerator / denominator
}

export function generateCacheKey(data: Record<string, unknown>): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash.toString(16)
}
