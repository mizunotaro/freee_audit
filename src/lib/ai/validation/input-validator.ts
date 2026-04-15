export interface ValidationConstraints {
  maxStringLength: number
  maxArrayLength: number
  maxObjectDepth: number
  maxObjectKeys: number
  prohibitedKeys: readonly string[]
}

export const DEFAULT_CONSTRAINTS: ValidationConstraints = {
  maxStringLength: 100000,
  maxArrayLength: 10000,
  maxObjectDepth: 10,
  maxObjectKeys: 1000,
  prohibitedKeys: ['__proto__', 'constructor', 'prototype'],
}

export interface ValidationError {
  code: string
  message: string
  path?: string
}

export type ValidationResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: ValidationError }

export function validateString(
  input: unknown,
  maxLength: number = DEFAULT_CONSTRAINTS.maxStringLength
): ValidationResult<string> {
  if (typeof input !== 'string') {
    return {
      success: false,
      error: { code: 'INVALID_TYPE', message: 'Expected string' },
    }
  }

  if (input.length > maxLength) {
    return {
      success: false,
      error: {
        code: 'STRING_TOO_LONG',
        message: `String exceeds max length: ${input.length} > ${maxLength}`,
      },
    }
  }

  const sanitized = input
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')

  if (sanitized.trim().length === 0) {
    return {
      success: false,
      error: { code: 'EMPTY_STRING', message: 'String is empty or whitespace only' },
    }
  }

  return { success: true, data: sanitized }
}

export function validateNumber(
  input: unknown,
  options?: { min?: number; max?: number; precision?: number }
): ValidationResult<number> {
  if (typeof input !== 'number' || isNaN(input)) {
    return {
      success: false,
      error: { code: 'INVALID_NUMBER', message: 'Expected valid number' },
    }
  }

  if (!isFinite(input)) {
    return {
      success: false,
      error: { code: 'INVALID_NUMBER', message: 'Number must be finite' },
    }
  }

  const { min, max, precision = 2 } = options ?? {}

  if (min !== undefined && input < min) {
    return {
      success: false,
      error: { code: 'NUMBER_TOO_SMALL', message: `Number ${input} < ${min}` },
    }
  }

  if (max !== undefined && input > max) {
    return {
      success: false,
      error: { code: 'NUMBER_TOO_LARGE', message: `Number ${input} > ${max}` },
    }
  }

  const factor = Math.pow(10, precision)
  const rounded = Math.round(input * factor) / factor
  return { success: true, data: rounded }
}

export function validateDate(
  input: unknown,
  options?: { minDate?: Date; maxDate?: Date }
): ValidationResult<string> {
  if (typeof input !== 'string' && !(input instanceof Date)) {
    return {
      success: false,
      error: { code: 'INVALID_DATE', message: 'Expected date string or Date object' },
    }
  }

  const date = new Date(input as string | Date)
  if (isNaN(date.getTime())) {
    return {
      success: false,
      error: { code: 'INVALID_DATE_FORMAT', message: 'Invalid date format' },
    }
  }

  const min = options?.minDate ?? new Date('1900-01-01')
  const max = options?.maxDate ?? new Date('2100-12-31')

  if (date < min || date > max) {
    return {
      success: false,
      error: {
        code: 'DATE_OUT_OF_RANGE',
        message: `Date ${date.toISOString()} out of range`,
      },
    }
  }

  const isoDate = date.toISOString().split('T')[0]
  return { success: true, data: isoDate ?? date.toISOString().slice(0, 10) }
}

export function validateJsonObject(
  input: unknown,
  constraints: ValidationConstraints = DEFAULT_CONSTRAINTS,
  depth: number = 0
): ValidationResult<Record<string, unknown>> {
  if (depth > constraints.maxObjectDepth) {
    return {
      success: false,
      error: {
        code: 'MAX_DEPTH_EXCEEDED',
        message: `Object depth ${depth} > ${constraints.maxObjectDepth}`,
      },
    }
  }

  if (typeof input !== 'object' || input === null) {
    return {
      success: false,
      error: { code: 'INVALID_OBJECT', message: 'Expected object' },
    }
  }

  if (Array.isArray(input)) {
    return {
      success: false,
      error: { code: 'INVALID_OBJECT', message: 'Expected object, got array' },
    }
  }

  const keys = Object.keys(input)
  if (keys.length > constraints.maxObjectKeys) {
    return {
      success: false,
      error: {
        code: 'TOO_MANY_KEYS',
        message: `Object has ${keys.length} keys, max ${constraints.maxObjectKeys}`,
      },
    }
  }

  for (const key of keys) {
    if (constraints.prohibitedKeys.includes(key)) {
      return {
        success: false,
        error: { code: 'PROHIBITED_KEY', message: `Prohibited key: ${key}` },
      }
    }
  }

  return { success: true, data: input as Record<string, unknown> }
}

export function validateArray(
  input: unknown,
  maxLength: number = DEFAULT_CONSTRAINTS.maxArrayLength
): ValidationResult<unknown[]> {
  if (!Array.isArray(input)) {
    return {
      success: false,
      error: { code: 'INVALID_TYPE', message: 'Expected array' },
    }
  }

  if (input.length > maxLength) {
    return {
      success: false,
      error: {
        code: 'ARRAY_TOO_LONG',
        message: `Array length ${input.length} > ${maxLength}`,
      },
    }
  }

  return { success: true, data: input }
}

export function sanitizeInput(input: string, maxLength: number = 10000): string {
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      .slice(0, maxLength)
      .trim()
  )
}
