import { z } from 'zod'
import { createAppError, ERROR_CODES, success, failure, type Result } from '@/types/result'

export const DISPLAY_STATES = ['loading', 'error', 'empty', 'ready'] as const
export type DisplayState = (typeof DISPLAY_STATES)[number]

export const resolveDisplayStateInputSchema = z.object({
  loading: z.boolean().default(false),
  error: z.string().nullable().default(null),
  hasData: z.boolean().default(false),
})

export function resolveDisplayState(input: unknown): Result<DisplayState> {
  const parsed = resolveDisplayStateInputSchema.safeParse(input)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'バリュエーション表示状態の解決に失敗しました', {
        details: { issues: parsed.error.issues },
      })
    )
  }

  const { loading, error, hasData } = parsed.data
  if (loading) return success('loading')
  if (error) return success('error')
  if (!hasData) return success('empty')
  return success('ready')
}
