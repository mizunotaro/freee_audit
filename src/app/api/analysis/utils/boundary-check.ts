import { API_LIMITS } from '../config/constants'
import type { AppError } from '../types/app-error'
import { createError } from '../types/app-error'

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: AppError }

/**
 * データ構造の深さをチェック
 */
export function checkNestingDepth(
  obj: unknown,
  maxDepth: number = API_LIMITS.maxNestingDepth
): number {
  if (typeof obj !== 'object' || obj === null) {
    return 0
  }

  const values = Array.isArray(obj) ? obj : Object.values(obj)
  if (values.length === 0) {
    return 1
  }

  const childDepths = values.map((v) => checkNestingDepth(v, maxDepth))
  return 1 + Math.max(...childDepths)
}

/**
 * 配列の長さをチェック
 */
export function checkArrayLength(
  arr: unknown,
  maxLength: number = API_LIMITS.maxArrayLength
): ValidationResult<void> {
  if (!Array.isArray(arr)) {
    return { success: true, data: undefined }
  }

  if (arr.length > maxLength) {
    return {
      success: false,
      error: createError(
        'VALIDATION_ERROR',
        `Array length ${arr.length} exceeds maximum ${maxLength}`,
        {
          details: { actualLength: arr.length, maxLength },
        }
      ),
    }
  }

  return { success: true, data: undefined }
}

/**
 * 文字列の長さをチェック
 */
export function checkStringLength(
  str: unknown,
  maxLength: number = API_LIMITS.maxStringLength
): ValidationResult<void> {
  if (typeof str !== 'string') {
    return { success: true, data: undefined }
  }

  if (str.length > maxLength) {
    return {
      success: false,
      error: createError(
        'VALIDATION_ERROR',
        `String length ${str.length} exceeds maximum ${maxLength}`,
        {
          details: { actualLength: str.length, maxLength },
        }
      ),
    }
  }

  return { success: true, data: undefined }
}

/**
 * 数値の範囲をチェック
 */
export function checkNumberRange(
  num: unknown,
  min: number = API_LIMITS.minAmount,
  max: number = API_LIMITS.maxAmount
): ValidationResult<void> {
  if (typeof num !== 'number') {
    return { success: true, data: undefined }
  }

  if (!Number.isFinite(num)) {
    return {
      success: false,
      error: createError('VALIDATION_ERROR', 'Number is not finite', {
        details: { value: num },
      }),
    }
  }

  if (num < min || num > max) {
    return {
      success: false,
      error: createError('VALIDATION_ERROR', `Number ${num} is out of range [${min}, ${max}]`, {
        details: { value: num, min, max },
      }),
    }
  }

  return { success: true, data: undefined }
}

/**
 * オブジェクトの総バイトサイズを推定
 */
export function estimateObjectSize(obj: unknown): number {
  const json = JSON.stringify(obj)
  return new Blob([json]).size
}

/**
 * 入力サイズの総合チェック
 */
export function checkInputSize(
  obj: unknown,
  maxSize: number = API_LIMITS.maxInputSize
): ValidationResult<void> {
  const size = estimateObjectSize(obj)

  if (size > maxSize) {
    return {
      success: false,
      error: createError(
        'VALIDATION_ERROR',
        `Input size ${size} bytes exceeds maximum ${maxSize} bytes`,
        {
          details: { actualSize: size, maxSize },
        }
      ),
    }
  }

  return { success: true, data: undefined }
}

/**
 * 再帰的にオブジェクトの境界値をチェック
 */
export function checkBoundaryLimits(obj: unknown, depth: number = 0): ValidationResult<void> {
  if (depth > API_LIMITS.maxNestingDepth) {
    return {
      success: false,
      error: createError(
        'VALIDATION_ERROR',
        `Nesting depth ${depth} exceeds maximum ${API_LIMITS.maxNestingDepth}`,
        {
          details: { depth, maxDepth: API_LIMITS.maxNestingDepth },
        }
      ),
    }
  }

  if (typeof obj === 'string') {
    const result = checkStringLength(obj)
    if (!result.success) return result
  } else if (typeof obj === 'number') {
    const result = checkNumberRange(obj)
    if (!result.success) return result
  } else if (Array.isArray(obj)) {
    const result = checkArrayLength(obj)
    if (!result.success) return result

    for (const item of obj) {
      const result = checkBoundaryLimits(item, depth + 1)
      if (!result.success) return result
    }
  } else if (typeof obj === 'object' && obj !== null) {
    const values = Object.values(obj)
    for (const value of values) {
      const result = checkBoundaryLimits(value, depth + 1)
      if (!result.success) return result
    }
  }

  return { success: true, data: undefined }
}
