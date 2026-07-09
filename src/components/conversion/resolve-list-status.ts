import { z } from 'zod'
import { createAppError, ERROR_CODES, success, failure, type Result } from '@/types/result'

export const LIST_RESOLUTIONS = ['loading', 'error', 'empty', 'ready'] as const
export type ListResolution = (typeof LIST_RESOLUTIONS)[number]

export const resolveListStatusInputSchema = z.object({
  loading: z.boolean().default(false),
  error: z.string().nullable().default(null),
  dataLength: z.number().int().nonnegative().default(0),
})

export type ResolveListStatusInput = z.infer<typeof resolveListStatusInputSchema>

export function resolveListStatus(input: unknown): Result<ListResolution> {
  const parsed = resolveListStatusInputSchema.safeParse(input)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'リスト状態の解決に失敗しました', {
        details: { issues: parsed.error.issues },
      })
    )
  }

  const { loading, error, dataLength } = parsed.data
  if (loading) return success('loading')
  if (error) return success('error')
  if (dataLength === 0) return success('empty')
  return success('ready')
}
