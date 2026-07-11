import { describe, it, expect } from 'vitest'
import {
  resolveDisplayState,
  type DisplayState,
} from '@/components/valuation/resolve-display-state'

function expectResolved(input: unknown): DisplayState {
  const result = resolveDisplayState(input)
  if (!result.success) {
    throw new Error(`expected success but got failure: ${result.error.code}`)
  }
  return result.data
}

describe('resolveDisplayState', () => {
  it('resolves to loading when loading is true, regardless of error or data', () => {
    expect(expectResolved({ loading: true, error: 'boom', hasData: true })).toBe('loading')
    expect(expectResolved({ loading: true })).toBe('loading')
  })

  it('resolves to error when not loading but error is a non-empty string', () => {
    expect(expectResolved({ loading: false, error: 'boom', hasData: true })).toBe('error')
  })

  it('treats a null/empty error as no error', () => {
    expect(expectResolved({ error: null, hasData: false })).toBe('empty')
    expect(expectResolved({ error: '', hasData: false })).toBe('empty')
  })

  it('resolves to empty when not loading, no error, and no data', () => {
    expect(expectResolved({ loading: false, error: null, hasData: false })).toBe('empty')
  })

  it('resolves to ready when data is present', () => {
    expect(expectResolved({ hasData: true })).toBe('ready')
  })

  it('applies loading > error > empty precedence in order', () => {
    expect(expectResolved({ loading: true, error: 'boom', hasData: false })).toBe('loading')
    expect(expectResolved({ loading: false, error: 'boom', hasData: false })).toBe('error')
  })

  it('returns a failure Result for invalid input', () => {
    const result = resolveDisplayState({ hasData: 'yes' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('applies schema defaults for omitted optional fields', () => {
    expect(expectResolved({})).toBe('empty')
  })
})
