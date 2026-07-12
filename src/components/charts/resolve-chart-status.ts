import { z } from 'zod'
import { createAppError, ERROR_CODES, success, failure, type Result } from '@/types/result'

export const CHART_RESOLUTIONS = ['loading', 'error', 'empty', 'ready'] as const
export type ChartResolution = (typeof CHART_RESOLUTIONS)[number]

export const resolveChartStatusInputSchema = z.object({
  loading: z.boolean().default(false),
  error: z.string().nullable().default(null),
  dataLength: z.number().int().nonnegative().default(0),
})

export function resolveChartStatus(input: unknown): Result<ChartResolution> {
  const parsed = resolveChartStatusInputSchema.safeParse(input)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'チャート状態の解決に失敗しました', {
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
