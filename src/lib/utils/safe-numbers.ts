import { z } from 'zod'
import {
  type AppError,
  type Result,
  ERROR_CODES,
  createAppError,
  failure,
  success,
} from '@/types/result'

const finiteNumberSchema = z
  .number()
  .refine((n) => Number.isFinite(n), { message: '有限の数値ではありません' })

export function parseSafeNumber(value: unknown): Result<number, AppError> {
  let coerced: unknown = value
  if (typeof value === 'string') {
    const normalized = value
      .replace(/[,，]/g, '')
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    coerced = parseFloat(normalized)
  }

  const parsed = finiteNumberSchema.safeParse(coerced)
  if (!parsed.success) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, '有限の数値に変換できません'))
  }
  return success(parsed.data)
}

export interface SafeDivideOptions {
  epsilon?: number
  percentage?: boolean
}

export function safeDivide(
  numerator: number,
  denominator: number,
  options: SafeDivideOptions = {}
): Result<number, AppError> {
  const { epsilon = 0, percentage = false } = options

  const nResult = finiteNumberSchema.safeParse(numerator)
  const dResult = finiteNumberSchema.safeParse(denominator)
  if (!nResult.success || !dResult.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, '分子または分母が有限の数値ではありません')
    )
  }

  const n = nResult.data
  const d = dResult.data

  if (Math.abs(d) <= epsilon) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'ゼロ除算または分母がイプシロン以下です')
    )
  }

  const quotient = n / d
  const qResult = finiteNumberSchema.safeParse(quotient)
  if (!qResult.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, '除算結果が有限の数値ではありません')
    )
  }

  return success(percentage ? qResult.data * 100 : qResult.data)
}

export function clampNumber(value: number, min: number, max: number): Result<number, AppError> {
  const vResult = finiteNumberSchema.safeParse(value)
  if (!vResult.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'クランプ対象の値が有限の数値ではありません')
    )
  }
  return success(Math.max(min, Math.min(max, vResult.data)))
}
