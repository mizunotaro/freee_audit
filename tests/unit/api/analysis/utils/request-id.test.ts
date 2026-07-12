import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest'
import crypto from 'crypto'
import {
  generateRequestId,
  generateTraceId,
  generateSpanId,
} from '@/app/api/analysis/utils/request-id'

const FIXED_DATE = new Date('2024-01-15T12:00:00Z')
const expectedTimestamp = FIXED_DATE.getTime().toString(36)

let mockedRandomBytes: MockedFunction<(size: number) => Buffer>

describe('request-id utility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
    mockedRandomBytes = vi.spyOn(crypto, 'randomBytes') as unknown as typeof mockedRandomBytes
    mockedRandomBytes.mockImplementation((size: number) => Buffer.alloc(size, 0xab))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('generateRequestId', () => {
    it('uses the default "req" prefix and encodes timestamp + 4 random bytes', () => {
      expect(generateRequestId()).toBe(`req-${expectedTimestamp}-abababab`)
    })

    it('honours a custom prefix', () => {
      expect(generateRequestId('audit')).toBe(`audit-${expectedTimestamp}-abababab`)
    })

    it('produces a valid id for an empty-string prefix (default param not triggered)', () => {
      expect(generateRequestId('')).toBe(`-${expectedTimestamp}-abababab`)
    })

    it('falls back to the default prefix when the argument is undefined', () => {
      expect(generateRequestId(undefined as unknown as string)).toBe(
        `req-${expectedTimestamp}-abababab`
      )
    })

    it('accepts unicode / special-character prefixes verbatim', () => {
      expect(generateRequestId('請求_001')).toBe(`請求_001-${expectedTimestamp}-abababab`)
    })

    it('requests exactly 4 random bytes per call', () => {
      generateRequestId()

      expect(mockedRandomBytes).toHaveBeenCalledWith(4)
      expect(mockedRandomBytes).toHaveBeenCalledTimes(1)
    })

    it('faithfully embeds the random bytes as 8 lowercase hex chars', () => {
      mockedRandomBytes.mockReturnValueOnce(Buffer.from('deadbeef', 'hex'))

      const id = generateRequestId()

      expect(id).toBe(`req-${expectedTimestamp}-deadbeef`)
      expect(id.split('-').pop()).toBe('deadbeef')
    })

    it('embeds Date.now() as a base36 timestamp segment', () => {
      const segments = generateRequestId().split('-')

      expect(segments[1]).toBe(expectedTimestamp)
      expect(segments[1]).toMatch(/^[0-9a-z]+$/)
    })

    it('matches the canonical request-id format', () => {
      expect(generateRequestId()).toMatch(/^req-[0-9a-z]+-[0-9a-f]{8}$/)
    })

    it('yields distinct ids when the random bytes differ', () => {
      mockedRandomBytes
        .mockReturnValueOnce(Buffer.from('11111111', 'hex'))
        .mockReturnValueOnce(Buffer.from('22222222', 'hex'))

      const a = generateRequestId()
      const b = generateRequestId()

      expect(a).not.toBe(b)
      expect(a.endsWith('-11111111')).toBe(true)
      expect(b.endsWith('-22222222')).toBe(true)
    })
  })

  describe('generateTraceId', () => {
    it('uses the "trace" prefix and encodes timestamp + 8 random bytes', () => {
      expect(generateTraceId()).toBe(`trace-${expectedTimestamp}-abababababababab`)
    })

    it('requests exactly 8 random bytes per call', () => {
      generateTraceId()

      expect(mockedRandomBytes).toHaveBeenCalledWith(8)
      expect(mockedRandomBytes).toHaveBeenCalledTimes(1)
    })

    it('faithfully embeds the random bytes as 16 lowercase hex chars', () => {
      mockedRandomBytes.mockReturnValueOnce(Buffer.from('0011223344556677', 'hex'))

      expect(generateTraceId()).toBe(`trace-${expectedTimestamp}-0011223344556677`)
    })

    it('matches the canonical trace-id format', () => {
      expect(generateTraceId()).toMatch(/^trace-[0-9a-z]+-[0-9a-f]{16}$/)
    })

    it('yields distinct trace ids when the random bytes differ', () => {
      mockedRandomBytes
        .mockReturnValueOnce(Buffer.from('aaaaaaaaaaaaaaaa', 'hex'))
        .mockReturnValueOnce(Buffer.from('bbbbbbbbbbbbbbbb', 'hex'))

      expect(generateTraceId()).not.toBe(generateTraceId())
    })
  })

  describe('generateSpanId', () => {
    it('uses the "span" prefix and encodes 4 random bytes with NO timestamp', () => {
      expect(generateSpanId()).toBe('span-abababab')
    })

    it('requests exactly 4 random bytes per call', () => {
      generateSpanId()

      expect(mockedRandomBytes).toHaveBeenCalledWith(4)
      expect(mockedRandomBytes).toHaveBeenCalledTimes(1)
    })

    it('does not embed a timestamp segment (single hyphen only)', () => {
      const span = generateSpanId()

      expect(span.split('-')).toHaveLength(2)
      expect(span).not.toContain(expectedTimestamp)
    })

    it('faithfully embeds the random bytes as 8 lowercase hex chars', () => {
      mockedRandomBytes.mockReturnValueOnce(Buffer.from('cafef00d', 'hex'))

      expect(generateSpanId()).toBe('span-cafef00d')
    })

    it('matches the canonical span-id format', () => {
      expect(generateSpanId()).toMatch(/^span-[0-9a-f]{8}$/)
    })

    it('yields distinct span ids when the random bytes differ', () => {
      mockedRandomBytes
        .mockReturnValueOnce(Buffer.from('11111111', 'hex'))
        .mockReturnValueOnce(Buffer.from('22222222', 'hex'))

      expect(generateSpanId()).not.toBe(generateSpanId())
    })
  })

  describe('fail-safe behavior', () => {
    it('never throws and always returns a non-empty string for each generator', () => {
      expect(() => generateRequestId()).not.toThrow()
      expect(() => generateTraceId()).not.toThrow()
      expect(() => generateSpanId()).not.toThrow()

      const ids = [generateRequestId(), generateTraceId(), generateSpanId()]

      for (const id of ids) {
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
      }
    })

    it('propagates randomBytes failures instead of silently returning a weak id', () => {
      mockedRandomBytes.mockImplementationOnce(() => {
        throw new Error('entropy depleted')
      })

      expect(() => generateRequestId()).toThrow('entropy depleted')
    })
  })
})
