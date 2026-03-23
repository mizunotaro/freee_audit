/**
 * PII Detector - 個人情報検出・マスキングモジュール
 *
 * 機能:
 * - 日本語・英語PIIパターン検出
 * - 自動マスキング
 * - 検出ログ出力
 *
 * @module lib/security/pii-detector
 */

import { secureLogger } from '@/lib/utils/secure-logger'

export type PIICategory =
  | 'email'
  | 'phone_jp'
  | 'phone_intl'
  | 'credit_card'
  | 'bank_account_jp'
  | 'postal_code_jp'
  | 'address_jp'
  | 'company_name_jp'
  | 'person_name_jp'
  | 'my_number'
  | 'drivers_license'
  | 'passport'
  | 'ip_address'
  | 'url'

export interface PIIPattern {
  category: PIICategory
  pattern: RegExp
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  maskChar?: string
}

export interface PIIDetection {
  category: PIICategory
  match: string
  startIndex: number
  endIndex: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface PIIDetectionResult {
  hasPII: boolean
  detections: PIIDetection[]
  maskedContent: string
  summary: Record<PIICategory, number>
  riskScore: number
}

const PII_PATTERNS: PIIPattern[] = [
  {
    category: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    description: 'Email address',
    severity: 'high',
  },
  {
    category: 'phone_jp',
    pattern: /(?:\+81|0)(?:[789]0|[1-9]\d{0,2})[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/g,
    description: 'Japanese phone number',
    severity: 'high',
  },
  {
    category: 'phone_intl',
    pattern: /\+\d{1,3}[-\s]?\d{1,4}[-\s]?\d{1,4}[-\s]?\d{1,9}/g,
    description: 'International phone number',
    severity: 'medium',
  },
  {
    category: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{3,4}\b/g,
    description: 'Credit card number',
    severity: 'critical',
  },
  {
    category: 'bank_account_jp',
    pattern: /\b\d{4,5}[-\s]?\d{3,8}[-\s]?\d{1,8}\b/g,
    description: 'Japanese bank account number',
    severity: 'critical',
  },
  {
    category: 'postal_code_jp',
    pattern: /(?:〒|郵便番号)[：:\s]*\d{3}[-\s]?\d{4}/g,
    description: 'Japanese postal code',
    severity: 'low',
  },
  {
    category: 'my_number',
    pattern: /\b\d{3}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    description: 'Japanese My Number',
    severity: 'critical',
  },
  {
    category: 'drivers_license',
    pattern: /\b\d{2}[-\s]?\d{2}[-\s]?\d{6}[-\s]?\d{2}\b/g,
    description: 'Japanese drivers license number',
    severity: 'critical',
  },
  {
    category: 'passport',
    pattern: /\b[A-Z]{1,2}\d{7,9}\b/g,
    description: 'Passport number',
    severity: 'high',
  },
  {
    category: 'ip_address',
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    description: 'IPv4 address',
    severity: 'medium',
  },
  {
    category: 'url',
    pattern: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
    description: 'URL',
    severity: 'low',
  },
  {
    category: 'company_name_jp',
    pattern: /(?:株式会社|有限会社|合同会社|合資会社|合名会社)[\s\S]{1,50}/g,
    description: 'Japanese company name',
    severity: 'low',
  },
]

const SEVERITY_SCORES: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 5,
  critical: 10,
}

const MASK_CHARS: Record<string, string> = {
  email: '*',
  phone_jp: '#',
  phone_intl: '#',
  credit_card: 'X',
  bank_account_jp: 'X',
  my_number: 'X',
  drivers_license: 'X',
  passport: 'X',
  default: '*',
}

function getMaskChar(category: PIICategory): string {
  return MASK_CHARS[category] ?? MASK_CHARS.default
}

function maskMatch(match: string, category: PIICategory): string {
  const maskChar = getMaskChar(category)
  const length = match.length

  if (length <= 4) {
    return maskChar.repeat(length)
  }

  const visibleStart = Math.min(2, Math.floor(length * 0.2))
  const visibleEnd = Math.min(2, Math.floor(length * 0.2))

  const start = match.slice(0, visibleStart)
  const end = match.slice(-visibleEnd)
  const middle = maskChar.repeat(length - visibleStart - visibleEnd)

  return `${start}${middle}${end}`
}

export function detectPII(content: string): PIIDetectionResult {
  const detections: PIIDetection[] = []
  const summary: Record<PIICategory, number> = {} as Record<PIICategory, number>
  let maskedContent = content
  const replacements: Array<{ start: number; end: number; masked: string }> = []

  for (const pattern of PII_PATTERNS) {
    pattern.pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.pattern.exec(content)) !== null) {
      const detection: PIIDetection = {
        category: pattern.category,
        match: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        severity: pattern.severity,
      }

      detections.push(detection)
      summary[pattern.category] = (summary[pattern.category] ?? 0) + 1

      const masked = maskMatch(match[0], pattern.category)
      replacements.push({
        start: detection.startIndex,
        end: detection.endIndex,
        masked,
      })
    }
  }

  replacements.sort((a, b) => b.start - a.start)

  for (const { start, end, masked } of replacements) {
    maskedContent = maskedContent.slice(0, start) + masked + maskedContent.slice(end)
  }

  const riskScore = detections.reduce((sum, d) => sum + SEVERITY_SCORES[d.severity], 0)

  return {
    hasPII: detections.length > 0,
    detections,
    maskedContent,
    summary,
    riskScore,
  }
}

export function maskPII(content: string): string {
  const result = detectPII(content)
  return result.maskedContent
}

export function hasPII(content: string): boolean {
  for (const pattern of PII_PATTERNS) {
    pattern.pattern.lastIndex = 0
    if (pattern.pattern.test(content)) {
      return true
    }
  }
  return false
}

export function warnOnPII(content: string, context: string): PIIDetectionResult {
  const result = detectPII(content)

  if (result.hasPII) {
    const criticalCount = result.detections.filter((d) => d.severity === 'critical').length
    const highCount = result.detections.filter((d) => d.severity === 'high').length

    secureLogger.security('PII_DETECTED', {
      context,
      totalDetections: result.detections.length,
      criticalCount,
      highCount,
      riskScore: result.riskScore,
      categories: Object.keys(result.summary),
    })
  }

  return result
}

export function sanitizeForAI(content: string): string {
  const result = detectPII(content)

  if (result.riskScore > 15) {
    secureLogger.warn('HIGH_PII_RISK_CONTENT_BLOCKED', {
      riskScore: result.riskScore,
      detectionCount: result.detections.length,
    })
    throw new Error('Content contains too much PII. Please sanitize before processing.')
  }

  if (result.hasPII) {
    secureLogger.info('PII_MASKED_FOR_AI', {
      riskScore: result.riskScore,
      categories: Object.keys(result.summary),
    })
  }

  return result.maskedContent
}

export function validateNoPII(content: string, options?: { allowLowRisk?: boolean }): void {
  const result = detectPII(content)

  const blockingDetections = options?.allowLowRisk
    ? result.detections.filter((d) => d.severity !== 'low')
    : result.detections

  if (blockingDetections.length > 0) {
    const categories = [...new Set(blockingDetections.map((d) => d.category))]
    throw new Error(`PII detected: ${categories.join(', ')}`)
  }
}
