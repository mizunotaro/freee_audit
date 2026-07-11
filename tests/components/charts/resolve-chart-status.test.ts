import { describe, it, expect, vi } from 'vitest'
import {
  resolveChartStatus,
  resolveChartStatusInputSchema,
  CHART_RESOLUTIONS,
  type ChartResolution,
} from '@/components/charts/resolve-chart-status'

function resolveOrThrow(input: unknown): ChartResolution {
  const result = resolveChartStatus(input)
  if (!result.success) {
    throw new Error(`expected success Result but got failure (code=${result.error.code})`)
  }
  return result.data
}

describe('CHART_RESOLUTIONS', () => {
  it('lists the four resolutions in priority order', () => {
    expect(CHART_RESOLUTIONS).toEqual(['loading', 'error', 'empty', 'ready'])
  })
})

describe('resolveChartStatusInputSchema', () => {
  it('applies defaults for all omitted fields', () => {
    const parsed = resolveChartStatusInputSchema.safeParse({})
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ loading: false, error: null, dataLength: 0 })
    }
  })

  it('preserves provided values', () => {
    const parsed = resolveChartStatusInputSchema.safeParse({
      loading: true,
      error: 'boom',
      dataLength: 7,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ loading: true, error: 'boom', dataLength: 7 })
    }
  })

  it('accepts null for error', () => {
    expect(resolveChartStatusInputSchema.safeParse({ error: null }).success).toBe(true)
  })

  it('rejects a negative dataLength', () => {
    expect(resolveChartStatusInputSchema.safeParse({ dataLength: -1 }).success).toBe(false)
  })

  it('rejects a non-integer dataLength', () => {
    expect(resolveChartStatusInputSchema.safeParse({ dataLength: 1.5 }).success).toBe(false)
  })

  it('rejects a non-boolean loading', () => {
    expect(resolveChartStatusInputSchema.safeParse({ loading: 'yes' }).success).toBe(false)
  })

  it('rejects a non-string, non-null error', () => {
    expect(resolveChartStatusInputSchema.safeParse({ error: 123 }).success).toBe(false)
  })

  it('strips unknown keys (lenient object parsing)', () => {
    const parsed = resolveChartStatusInputSchema.safeParse({ loading: true, extra: 'ignored' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty('extra')
    }
  })
})

describe('resolveChartStatus', () => {
  describe('happy paths', () => {
    it('resolves to ready when data is present and not loading/error', () => {
      expect(resolveOrThrow({ dataLength: 3 })).toBe('ready')
    })

    it('resolves to empty when no data, not loading, and no error', () => {
      expect(resolveOrThrow({ loading: false, error: null, dataLength: 0 })).toBe('empty')
    })

    it('resolves to error when not loading but error is a non-empty string', () => {
      expect(resolveOrThrow({ loading: false, error: '通信エラー', dataLength: 5 })).toBe('error')
    })

    it('resolves to loading when loading is true', () => {
      expect(resolveOrThrow({ loading: true })).toBe('loading')
    })
  })

  describe('precedence (loading > error > empty > ready)', () => {
    it('loading wins over error and data', () => {
      expect(resolveOrThrow({ loading: true, error: 'boom', dataLength: 9 })).toBe('loading')
    })

    it('error wins over empty (dataLength 0)', () => {
      expect(resolveOrThrow({ loading: false, error: 'boom', dataLength: 0 })).toBe('error')
    })

    it('error wins over ready (data present)', () => {
      expect(resolveOrThrow({ loading: false, error: 'boom', dataLength: 9 })).toBe('error')
    })

    it('empty applies only when no loading, no error, and dataLength 0', () => {
      expect(resolveOrThrow({ loading: false, error: null, dataLength: 0 })).toBe('empty')
    })
  })

  describe('defaults', () => {
    it('resolves an empty object to empty via schema defaults', () => {
      expect(resolveOrThrow({})).toBe('empty')
    })
  })

  describe('edge cases', () => {
    it('treats an empty-string error as no error', () => {
      expect(resolveOrThrow({ error: '', dataLength: 0 })).toBe('empty')
      expect(resolveOrThrow({ error: '', dataLength: 4 })).toBe('ready')
    })

    it('treats a null error as no error', () => {
      expect(resolveOrThrow({ error: null, dataLength: 0 })).toBe('empty')
    })

    it('treats a whitespace-only error string as an error (truthy string)', () => {
      expect(resolveOrThrow({ error: '   ', dataLength: 0 })).toBe('error')
    })

    it('boundary: dataLength 0 -> empty, 1 -> ready', () => {
      expect(resolveOrThrow({ dataLength: 0 })).toBe('empty')
      expect(resolveOrThrow({ dataLength: 1 })).toBe('ready')
    })

    it('a very large dataLength resolves to ready', () => {
      expect(resolveOrThrow({ dataLength: Number.MAX_SAFE_INTEGER })).toBe('ready')
    })

    it('every resolution it returns is listed in CHART_RESOLUTIONS', () => {
      const inputs: unknown[] = [
        { loading: true },
        { error: 'boom' },
        { dataLength: 0 },
        { dataLength: 5 },
      ]
      for (const input of inputs) {
        expect(CHART_RESOLUTIONS).toContain(resolveOrThrow(input))
      }
    })
  })

  describe('error paths and fail-safe behavior', () => {
    it('returns a failure Result for a negative dataLength', () => {
      const result = resolveChartStatus({ dataLength: -1 })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('returns a failure Result for a non-integer dataLength', () => {
      expect(resolveChartStatus({ dataLength: 2.5 }).success).toBe(false)
    })

    it('returns a failure Result for a string dataLength', () => {
      expect(resolveChartStatus({ dataLength: '5' }).success).toBe(false)
    })

    it('returns a failure Result for a non-boolean loading', () => {
      expect(resolveChartStatus({ loading: 'yes' }).success).toBe(false)
    })

    it('returns a failure Result for a numeric error', () => {
      expect(resolveChartStatus({ error: 123 }).success).toBe(false)
    })

    it('returns a failure Result for null input', () => {
      expect(resolveChartStatus(null).success).toBe(false)
    })

    it('returns a failure Result for undefined input', () => {
      expect(resolveChartStatus(undefined).success).toBe(false)
    })

    it('returns a failure Result for array input', () => {
      expect(resolveChartStatus([1, 2, 3]).success).toBe(false)
    })

    it('returns a failure Result for primitive (string/number/boolean) input', () => {
      expect(resolveChartStatus('loading').success).toBe(false)
      expect(resolveChartStatus(42).success).toBe(false)
      expect(resolveChartStatus(true).success).toBe(false)
    })

    it('never throws — degrades to a failure Result for any bad input', () => {
      const badInputs: unknown[] = [
        null,
        undefined,
        'x',
        42,
        true,
        [1, 2],
        { dataLength: -1 },
        { loading: 'x' },
        { error: 1 },
      ]
      for (const bad of badInputs) {
        expect(() => resolveChartStatus(bad)).not.toThrow()
      }
    })

    it('shapes the failure as a VALIDATION_ERROR AppError carrying the Zod issues', () => {
      const fixedNow = new Date('2026-01-01T00:00:00.000Z')
      vi.useFakeTimers({ now: fixedNow.getTime() })
      try {
        const result = resolveChartStatus({ dataLength: -1 })
        expect(result.success).toBe(false)
        if (!result.success) {
          const err = result.error
          expect(err.code).toBe('VALIDATION_ERROR')
          expect(err.message).toBe('チャート状態の解決に失敗しました')
          expect(err.timestamp).toEqual(fixedNow)
          expect(Array.isArray(err.details?.issues)).toBe(true)
          expect((err.details?.issues as unknown[]).length).toBeGreaterThan(0)
        }
      } finally {
        vi.useRealTimers()
      }
    })

    it('every failure path carries a non-empty VALIDATION_ERROR message', () => {
      const badInputs: unknown[] = [
        null,
        undefined,
        { dataLength: -1 },
        { loading: 'x' },
        { error: 1 },
      ]
      for (const bad of badInputs) {
        const result = resolveChartStatus(bad)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.code).toBe('VALIDATION_ERROR')
          expect(result.error.message.length).toBeGreaterThan(0)
        }
      }
    })
  })
})
