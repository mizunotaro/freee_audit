import { describe, it, expect } from 'vitest'
import { createExportService } from '@/services/export'
import type { ExportFormat } from '@/services/export'

describe('createExportService', () => {
  it('returns a PDF service for the pdf format', () => {
    const service = createExportService('pdf')

    expect(typeof service.export).toBe('function')
    expect(service.getSupportedFormats()).toEqual(['pdf'])
  })

  it('returns a PPTX service for the pptx format', () => {
    const service = createExportService('pptx')

    expect(service.getSupportedFormats()).toEqual(['pptx'])
  })

  it('returns an Excel service for the excel format', () => {
    const service = createExportService('excel')

    expect(service.getSupportedFormats()).toEqual(['excel', 'csv'])
  })

  it('routes csv to the Excel service', () => {
    const service = createExportService('csv')

    expect(service.getSupportedFormats()).toEqual(['excel', 'csv'])
  })

  it('exposes an export function on every supported service', () => {
    const formats: ExportFormat[] = ['pdf', 'pptx', 'excel', 'csv']

    for (const format of formats) {
      expect(typeof createExportService(format).export).toBe('function')
    }
  })

  it('throws for an unsupported format', () => {
    expect(() => createExportService('docx' as ExportFormat)).toThrow(/Unsupported export format/)
  })
})
