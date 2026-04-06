import { describe, it, expect } from 'vitest'
import {
  useAnalysis,
  useExport,
  type FiscalPeriod,
  type AnalysisState,
  type ExportFormat,
  type ExportOptions,
} from '@/app/(dashboard)/analysis/hooks'

describe('analysis hooks index', () => {
  it('should export useAnalysis', () => {
    expect(useAnalysis).toBeDefined()
    expect(typeof useAnalysis).toBe('function')
  })

  it('should export useExport', () => {
    expect(useExport).toBeDefined()
    expect(typeof useExport).toBe('function')
  })

  it('should export FiscalPeriod type', () => {
    const period: FiscalPeriod = { fiscalYear: 2024, month: 12 }
    expect(period.fiscalYear).toBe(2024)
    expect(period.month).toBe(12)
  })

  it('should export AnalysisState type', () => {
    const state: AnalysisState = {
      financialData: null,
      ratioData: null,
      benchmarkData: null,
      isLoading: false,
      error: null,
    }
    expect(state.isLoading).toBe(false)
  })

  it('should export ExportFormat type', () => {
    const formats: ExportFormat[] = ['pdf', 'excel', 'json']
    expect(formats).toHaveLength(3)
  })

  it('should export ExportOptions type', () => {
    const options: ExportOptions = { format: 'pdf', includeCharts: true }
    expect(options.format).toBe('pdf')
  })
})
