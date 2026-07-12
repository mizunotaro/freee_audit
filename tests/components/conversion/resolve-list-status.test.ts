import { describe, it, expect } from 'vitest'
import {
  resolveListStatus,
  resolveListStatusInputSchema,
  LIST_RESOLUTIONS,
  type ListResolution,
  type ResolveListStatusInput,
} from '@/components/conversion/resolve-list-status'
import { ERROR_CODES } from '@/types/result'

function expectResolved(input: unknown): ListResolution {
  const result = resolveListStatus(input)
  if (!result.success) {
    throw new Error(`expected success but got failure: ${result.error.code}`)
  }
  return result.data
}

function expectFailureDetails(input: unknown) {
  const result = resolveListStatus(input)
  expect(result.success).toBe(false)
  if (!result.success) {
    return result.error
  }
  throw new Error('expected failure but got success')
}

describe('LIST_RESOLUTIONS', () => {
  it('exposes the four status values in precedence order', () => {
    expect(LIST_RESOLUTIONS).toEqual(['loading', 'error', 'empty', 'ready'])
  })

  it('is a readonly tuple of unique values', () => {
    expect(new Set(LIST_RESOLUTIONS).size).toBe(LIST_RESOLUTIONS.length)
    expect(LIST_RESOLUTIONS.length).toBe(4)
  })
})

describe('resolveListStatusInputSchema', () => {
  it('applies defaults for every omitted field', () => {
    const parsed = resolveListStatusInputSchema.safeParse({})
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ loading: false, error: null, dataLength: 0 })
    }
  })

  it('preserves explicitly provided values', () => {
    const parsed = resolveListStatusInputSchema.safeParse({
      loading: true,
      error: 'boom',
      dataLength: 7,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ loading: true, error: 'boom', dataLength: 7 })
    }
  })

  it('accepts a nullable error (null and string)', () => {
    expect(resolveListStatusInputSchema.safeParse({ error: null }).success).toBe(true)
    expect(resolveListStatusInputSchema.safeParse({ error: 'oops' }).success).toBe(true)
  })

  it('strips unknown fields rather than rejecting them', () => {
    const parsed = resolveListStatusInputSchema.safeParse({
      loading: false,
      extra: 'ignored',
      nested: { a: 1 },
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).toEqual({ loading: false, error: null, dataLength: 0 })
    }
  })

  it('rejects negative dataLength', () => {
    expect(resolveListStatusInputSchema.safeParse({ dataLength: -1 }).success).toBe(false)
  })

  it('rejects non-integer dataLength', () => {
    expect(resolveListStatusInputSchema.safeParse({ dataLength: 1.5 }).success).toBe(false)
  })
})

describe('resolveListStatus — happy paths', () => {
  it('resolves to ready when data is present and nothing is wrong', () => {
    expect(expectResolved({ loading: false, error: null, dataLength: 1 })).toBe('ready')
  })

  it('resolves to empty when there is no data and nothing is wrong', () => {
    expect(expectResolved({ loading: false, error: null, dataLength: 0 })).toBe('empty')
  })

  it('resolves to error when not loading but error is a non-empty string', () => {
    expect(expectResolved({ loading: false, error: 'boom', dataLength: 5 })).toBe('error')
  })

  it('resolves to loading when loading is true', () => {
    expect(expectResolved({ loading: true, error: null, dataLength: 0 })).toBe('loading')
  })

  it('defaults an empty object to empty (all schema defaults)', () => {
    expect(expectResolved({})).toBe('empty')
  })
})

describe('resolveListStatus — precedence (loading > error > empty > ready)', () => {
  it('loading wins over error and empty', () => {
    expect(expectResolved({ loading: true, error: 'boom', dataLength: 0 })).toBe('loading')
    expect(expectResolved({ loading: true, error: 'boom', dataLength: 9 })).toBe('loading')
  })

  it('error wins over empty', () => {
    expect(expectResolved({ loading: false, error: 'boom', dataLength: 0 })).toBe('error')
  })

  it('error wins over ready (error takes priority even with data)', () => {
    expect(expectResolved({ loading: false, error: 'boom', dataLength: 9 })).toBe('error')
  })

  it('empty wins over ready at the dataLength boundary', () => {
    expect(expectResolved({ loading: false, error: null, dataLength: 0 })).toBe('empty')
    expect(expectResolved({ loading: false, error: null, dataLength: 1 })).toBe('ready')
  })
})

describe('resolveListStatus — edge cases', () => {
  it('treats a null error as "no error"', () => {
    expect(expectResolved({ error: null, dataLength: 0 })).toBe('empty')
    expect(expectResolved({ error: null, dataLength: 2 })).toBe('ready')
  })

  it('treats an empty-string error as "no error" (fail-safe: falsy error ignored)', () => {
    expect(expectResolved({ error: '', dataLength: 0 })).toBe('empty')
    expect(expectResolved({ error: '', dataLength: 2 })).toBe('ready')
  })

  it('handles very large dataLength as ready', () => {
    expect(expectResolved({ dataLength: Number.MAX_SAFE_INTEGER })).toBe('ready')
  })

  it('handles a long error string as error', () => {
    expect(expectResolved({ error: 'x'.repeat(10_000), dataLength: 0 })).toBe('error')
  })

  it('resolves to loading when only loading is provided', () => {
    expect(expectResolved({ loading: true })).toBe('loading')
  })

  it('resolves to empty when only a zero dataLength is provided', () => {
    expect(expectResolved({ dataLength: 0 })).toBe('empty')
  })
})

describe('resolveListStatus — validation / error paths', () => {
  it('returns a failure Result with VALIDATION_ERROR for negative dataLength', () => {
    const error = expectFailureDetails({ dataLength: -1 })
    expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('returns a failure Result for non-integer dataLength', () => {
    expect(resolveListStatus({ dataLength: 2.5 }).success).toBe(false)
  })

  it('returns a failure Result for non-numeric dataLength', () => {
    expect(resolveListStatus({ dataLength: '5' }).success).toBe(false)
  })

  it('returns a failure Result for NaN dataLength (fails int check)', () => {
    expect(resolveListStatus({ dataLength: NaN }).success).toBe(false)
  })

  it('returns a failure Result for Infinity dataLength (fails int check)', () => {
    expect(resolveListStatus({ dataLength: Infinity }).success).toBe(false)
  })

  it('returns a failure Result for a non-boolean loading', () => {
    expect(resolveListStatus({ loading: 'yes' }).success).toBe(false)
    expect(resolveListStatus({ loading: 1 }).success).toBe(false)
  })

  it('returns a failure Result for a non-string, non-null error', () => {
    expect(resolveListStatus({ error: 123 }).success).toBe(false)
    expect(resolveListStatus({ error: { msg: 'x' } }).success).toBe(false)
    expect(resolveListStatus({ error: [] }).success).toBe(false)
  })

  it('returns a failure Result for null input', () => {
    expect(resolveListStatus(null).success).toBe(false)
  })

  it('returns a failure Result for undefined input', () => {
    expect(resolveListStatus(undefined).success).toBe(false)
  })

  it('returns a failure Result for primitive (non-object) input', () => {
    expect(resolveListStatus('loading').success).toBe(false)
    expect(resolveListStatus(42).success).toBe(false)
    expect(resolveListStatus(true).success).toBe(false)
  })

  it('returns a failure Result for array input', () => {
    expect(resolveListStatus([true, null, 0]).success).toBe(false)
  })
})

describe('resolveListStatus — failure Result shape', () => {
  it('uses the localized message', () => {
    const error = expectFailureDetails({ dataLength: -1 })
    expect(error.message).toBe('リスト状態の解決に失敗しました')
  })

  it('attaches the zod issues under details.issues', () => {
    const error = expectFailureDetails({ dataLength: -1 })
    expect(error.details).toBeDefined()
    expect(Array.isArray(error.details?.issues)).toBe(true)
    expect(error.details?.issues).toHaveLength(1)
  })

  it('reports the offending path in the zod issue', () => {
    const error = expectFailureDetails({ dataLength: -1 })
    const issues = error.details?.issues as Array<{ path: PropertyKey[] }>
    expect(issues[0].path).toContain('dataLength')
  })

  it('stamps the error with a timestamp', () => {
    const error = expectFailureDetails({ dataLength: -1 })
    expect(error.timestamp).toBeInstanceOf(Date)
  })
})

describe('resolveListStatus — fail-safe behavior', () => {
  it('never throws on invalid input (always returns a Result)', () => {
    const invalidInputs: unknown[] = [
      null,
      undefined,
      NaN,
      Infinity,
      -Infinity,
      '',
      'string',
      42,
      true,
      [],
      { dataLength: -1 },
      { loading: 'yes' },
      { error: 123 },
      Symbol('x'),
    ]
    for (const input of invalidInputs) {
      expect(() => resolveListStatus(input)).not.toThrow()
    }
  })

  it('degrades every fault mode to a structured failure, not a thrown exception', () => {
    const result = resolveListStatus({ dataLength: -999 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
      expect(typeof result.error.code).toBe('string')
    }
  })
})

describe('ResolveListStatusInput type ergonomics', () => {
  it('accepts a fully-formed input object without coercion', () => {
    const input: ResolveListStatusInput = { loading: false, error: null, dataLength: 0 }
    expect(expectResolved(input)).toBe('empty')
  })
})
