const VERSION = '1.0.0'

export interface OutputValidationResult {
  valid: boolean
  sanitizedOutput: string
  violations: OutputViolation[]
  metadata: {
    originalLength: number
    sanitizedLength: number
    checkDurationMs: number
  }
}

export interface OutputViolation {
  type: OutputViolationType
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  action: 'removed' | 'replaced' | 'flagged'
}

export type OutputViolationType =
  | 'pii_leak'
  | 'unauthorized_url'
  | 'code_injection'
  | 'html_injection'
  | 'script_injection'
  | 'sql_injection'
  | 'path_traversal'
  | 'excessive_length'
  | 'invalid_financial_data'
  | 'unsafe_markdown'

interface FinancialDataPattern {
  pattern: RegExp
  label: string
}

const JAPANESE_PHONE = /(?:\+81|0)\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/gu
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gu
const CREDIT_CARD = /\b(?:\d{4}[-\s]?){3}\d{4}\b/gu
const JAPANESE_POSTAL = /\b\d{3}[-\s]\d{4}\b/gu
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/giu
const SCRIPT_PATTERN = /<script[\s>][\s\S]*?<\/script>/giu
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=\s*["'][^"']*["']/giu
const SQL_PATTERN =
  /(?:UNION\s+ALL\s+SELECT|DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET)/giu
const PATH_TRAVERSAL = /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/)/giu
const MARKDOWN_IMAGE_EXTERNAL = /!\[.*?\]\(https?:\/\/[^\s)]+\)/giu

const FINANCIAL_PATTERNS: FinancialDataPattern[] = [
  { pattern: /口座番号[：:\s]*\d{4,7}/g, label: 'bank_account' },
  { pattern: /(?:みずほ|三菱UFJ|三井住友|りそな|埼玉りそな|ゆうちょ)銀行/g, label: 'bank_name' },
  {
    pattern: /(?:クレジット|credit)\s*カード\s*番号[：:\s]*\d[\d\s-]{12,18}/g,
    label: 'credit_card',
  },
]

function removeScripts(input: string, violations: OutputViolation[]): string {
  let result = input

  const scriptMatches = result.match(SCRIPT_PATTERN)
  if (scriptMatches) {
    for (const _match of scriptMatches) {
      violations.push({
        type: 'script_injection',
        severity: 'critical',
        description: 'Script tag detected and removed',
        action: 'removed',
      })
    }
    result = result.replace(SCRIPT_PATTERN, '[REMOVED: script]')
  }

  const eventMatches = result.match(EVENT_HANDLER_PATTERN)
  if (eventMatches) {
    for (const _ of eventMatches) {
      violations.push({
        type: 'html_injection',
        severity: 'high',
        description: 'Event handler attribute detected and removed',
        action: 'removed',
      })
    }
    result = result.replace(EVENT_HANDLER_PATTERN, '')
  }

  return result
}

function removeSqlInjection(input: string, violations: OutputViolation[]): string {
  const matches = input.match(SQL_PATTERN)
  if (matches) {
    for (const _ of matches) {
      violations.push({
        type: 'sql_injection',
        severity: 'critical',
        description: 'SQL injection pattern detected and removed',
        action: 'removed',
      })
    }
    return input.replace(SQL_PATTERN, '[REMOVED: sql]')
  }
  return input
}

function removePathTraversal(input: string, violations: OutputViolation[]): string {
  const matches = input.match(PATH_TRAVERSAL)
  if (matches) {
    for (const _ of matches) {
      violations.push({
        type: 'path_traversal',
        severity: 'high',
        description: 'Path traversal pattern detected and removed',
        action: 'removed',
      })
    }
    return input.replace(PATH_TRAVERSAL, '[REMOVED]')
  }
  return input
}

function redactPii(input: string, violations: OutputViolation[]): string {
  let result = input

  const emailMatches = result.match(EMAIL_PATTERN)
  if (emailMatches) {
    violations.push({
      type: 'pii_leak',
      severity: 'high',
      description: `Email address detected and redacted (${emailMatches.length} found)`,
      action: 'replaced',
    })
    result = result.replace(EMAIL_PATTERN, '[EMAIL REDACTED]')
  }

  const phoneMatches = result.match(JAPANESE_PHONE)
  if (phoneMatches) {
    violations.push({
      type: 'pii_leak',
      severity: 'medium',
      description: `Phone number detected and redacted (${phoneMatches.length} found)`,
      action: 'replaced',
    })
    result = result.replace(JAPANESE_PHONE, '[PHONE REDACTED]')
  }

  const ccMatches = result.match(CREDIT_CARD)
  if (ccMatches) {
    violations.push({
      type: 'pii_leak',
      severity: 'critical',
      description: `Credit card number detected and redacted (${ccMatches.length} found)`,
      action: 'replaced',
    })
    result = result.replace(CREDIT_CARD, '[CC REDACTED]')
  }

  const postalMatches = result.match(JAPANESE_POSTAL)
  if (postalMatches) {
    violations.push({
      type: 'pii_leak',
      severity: 'low',
      description: `Postal code detected and redacted (${postalMatches.length} found)`,
      action: 'replaced',
    })
    result = result.replace(JAPANESE_POSTAL, '[POSTAL REDACTED]')
  }

  return result
}

function sanitizeUrls(input: string, violations: OutputViolation[]): string {
  const urlMatches = input.match(URL_PATTERN)
  if (urlMatches) {
    violations.push({
      type: 'unauthorized_url',
      severity: 'medium',
      description: `URL detected in output (${urlMatches.length} found)`,
      action: 'flagged',
    })
  }
  return input
}

function sanitizeFinancialData(input: string, violations: OutputViolation[]): string {
  let result = input

  for (const { pattern, label } of FINANCIAL_PATTERNS) {
    const matches = result.match(pattern)
    if (matches) {
      violations.push({
        type: 'invalid_financial_data',
        severity: 'high',
        description: `Sensitive financial data detected (${label}), redacted`,
        action: 'replaced',
      })
      result = result.replace(pattern, `[${label.toUpperCase()} REDACTED]`)
    }
  }

  return result
}

function checkLength(input: string, violations: OutputViolation[], maxLength: number): string {
  if (input.length > maxLength) {
    violations.push({
      type: 'excessive_length',
      severity: 'medium',
      description: `Output length ${input.length} exceeds max ${maxLength}, truncated`,
      action: 'flagged',
    })
    return input.slice(0, maxLength)
  }
  return input
}

function sanitizeMarkdown(input: string, violations: OutputViolation[]): string {
  const imgMatches = input.match(MARKDOWN_IMAGE_EXTERNAL)
  if (imgMatches) {
    violations.push({
      type: 'unsafe_markdown',
      severity: 'medium',
      description: `External markdown image detected (${imgMatches.length} found)`,
      action: 'flagged',
    })
  }
  return input
}

export function validateOutput(
  output: string,
  options: {
    maxLength?: number
    context?: 'financial_report' | 'chat' | 'analysis' | 'audit'
  } = {}
): OutputValidationResult {
  const startTime = Date.now()
  const violations: OutputViolation[] = []
  const maxLength = options.maxLength ?? 50000

  if (!output || typeof output !== 'string') {
    return {
      valid: false,
      sanitizedOutput: '',
      violations: [
        {
          type: 'excessive_length',
          severity: 'high',
          description: 'Output is empty or not a string',
          action: 'removed',
        },
      ],
      metadata: {
        originalLength: 0,
        sanitizedLength: 0,
        checkDurationMs: Date.now() - startTime,
      },
    }
  }

  let sanitized = output

  sanitized = removeScripts(sanitized, violations)
  sanitized = removeSqlInjection(sanitized, violations)
  sanitized = removePathTraversal(sanitized, violations)
  sanitized = redactPii(sanitized, violations)
  sanitized = sanitizeFinancialData(sanitized, violations)
  sanitized = sanitizeUrls(sanitized, violations)
  sanitized = sanitizeMarkdown(sanitized, violations)
  sanitized = checkLength(sanitized, violations, maxLength)

  const hasCriticalViolations = violations.some(
    (v) => v.severity === 'critical' || v.type === 'script_injection' || v.type === 'sql_injection'
  )

  return {
    valid: !hasCriticalViolations,
    sanitizedOutput: sanitized,
    violations,
    metadata: {
      originalLength: output.length,
      sanitizedLength: sanitized.length,
      checkDurationMs: Date.now() - startTime,
    },
  }
}

export { VERSION }
