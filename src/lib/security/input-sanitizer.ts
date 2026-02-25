import { z } from 'zod'

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:\s*text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
]

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
  /(--)|(\/\*)|(\*\/)/g,
  /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/gi,
  /'\s*(OR|AND)\s*'/gi,
]

const PATH_TRAVERSAL_PATTERNS = [/\.\./g, /%2e%2e/gi, /%252e/gi]

export interface SanitizationResult {
  isValid: boolean
  sanitized: string
  threats: string[]
}

export function sanitizeString(input: string): SanitizationResult {
  const threats: string[] = []
  let sanitized = input

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(sanitized)) {
      threats.push(`Potential XSS pattern detected: ${pattern.source}`)
      sanitized = sanitized.replace(pattern, '')
    }
  }

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      threats.push(`Potential SQL injection pattern detected: ${pattern.source}`)
    }
  }

  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(sanitized)) {
      threats.push(`Path traversal pattern detected: ${pattern.source}`)
      sanitized = sanitized.replace(pattern, '')
    }
  }

  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')

  return {
    isValid: threats.length === 0,
    sanitized,
    threats,
  }
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const { sanitized } = sanitizeString(value)
      result[key] = sanitized
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result as T
}

export function validateEmail(email: string): boolean {
  const emailSchema = z.string().email()
  const result = emailSchema.safeParse(email)
  return result.success
}

export function validateUUID(uuid: string): boolean {
  const uuidSchema = z.string().uuid()
  const result = uuidSchema.safeParse(uuid)
  return result.success
}

export function validateNumericString(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value)
}

export function validateDateString(date: string): boolean {
  const dateSchema = z.string().datetime()
  const result = dateSchema.safeParse(date)
  if (result.success) return true

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) return false

  const parsedDate = new Date(date)
  return !isNaN(parsedDate.getTime())
}

export function truncateString(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input
  return input.slice(0, maxLength)
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 255)
}

export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function createValidator<T>(schema: z.ZodSchema<T>) {
  return {
    validate: (data: unknown): { success: boolean; data?: T; errors?: string[] } => {
      const result = schema.safeParse(data)
      if (result.success) {
        return { success: true, data: result.data }
      }
      return {
        success: false,
        errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      }
    },
    parse: (data: unknown): T => schema.parse(data),
    safeParse: (data: unknown) => schema.safeParse(data),
  }
}

export const commonSchemas = {
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  uuid: z.string().uuid(),
  positiveNumber: z.number().positive(),
  nonNegativeNumber: z.number().nonnegative(),
  dateString: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyName: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  currencyCode: z.enum(['JPY', 'USD', 'EUR', 'GBP']),
}
