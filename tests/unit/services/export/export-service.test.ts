import { describe, it, expect } from 'vitest'
import { createExportService } from '@/services/export'
import type { ExportFormat } from '@/services/export'

describe('createExportService', () => {
  it('returns a PDF service for the pdf format', () => {
    const result = createExportService('pdf')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(typeof result.data.export).toBe('function')
    expect(result.data.getSupportedFormats()).toEqual(['pdf'])
  })

  it('returns a PPTX service for the pptx format', () => {
    const result = createExportService('pptx')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.getSupportedFormats()).toEqual(['pptx'])
  })

  it('returns an Excel service for the excel format', () => {
    const result = createExportService('excel')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.getSupportedFormats()).toEqual(['excel', 'csv'])
  })

  it('routes csv to the Excel service', () => {
    const result = createExportService('csv')
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.getSupportedFormats()).toEqual(['excel', 'csv'])
  })

  it('exposes an export function on every supported service', () => {
    const formats: ExportFormat[] = ['pdf', 'pptx', 'excel', 'csv']

    for (const format of formats) {
      const result = createExportService(format)
      expect(result.success).toBe(true)
      if (!result.success) continue
      expect(typeof result.data.export).toBe('function')
    }
  })

  it('returns failure for an unsupported format', () => {
    const result = createExportService('docx' as ExportFormat)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.message).toMatch(/Unsupported export format/)
  })
})
