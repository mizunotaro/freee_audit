import type { ValidationResult } from '../utils/boundary-check'
import { createError } from '../types/app-error'
import type { z } from 'zod'

export function validateWithSchema<T>(input: unknown, schema: z.ZodSchema<T>): ValidationResult<T> {
  const result = schema.safeParse(input)

  if (!result.success) {
    return {
      success: false,
      error: createError('VALIDATION_ERROR', 'Request validation failed', {
        details: {
          errors: result.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        },
      }),
    }
  }

  return { success: true, data: result.data }
}

export function parseJsonSafely(input: string): ValidationResult<unknown> {
  try {
    const data = JSON.parse(input)
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: createError('VALIDATION_ERROR', 'Invalid JSON format', {
        details: {
          error: error instanceof Error ? error.message : 'Unknown parsing error',
        },
      }),
    }
  }
}
