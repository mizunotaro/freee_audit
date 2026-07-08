import { describe, it, expect } from 'vitest'
import {
  MemoryCache,
  ConversionCache,
  conversionCache,
  exchangeRateCache,
  kpiCache,
} from '@/lib/cache'

describe('src/lib/cache public API', () => {
  it('re-exports the MemoryCache class', () => {
    expect(MemoryCache).toBeTypeOf('function')
    expect(new MemoryCache<string>(1000)).toBeInstanceOf(MemoryCache)
  })

  it('re-exports the ConversionCache class and its singleton', () => {
    expect(ConversionCache).toBeTypeOf('function')
    expect(conversionCache).toBeInstanceOf(ConversionCache)
  })

  it('re-exports the shared exchange-rate and KPI cache singletons', () => {
    expect(exchangeRateCache).toBeInstanceOf(MemoryCache)
    expect(kpiCache).toBeInstanceOf(MemoryCache)
  })
})
