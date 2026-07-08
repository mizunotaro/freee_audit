import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EXPORT_OPTIONS,
  MIME_TYPES,
  FILE_EXTENSIONS,
  type ExportFormat,
} from '@/services/export/types'

describe('DEFAULT_EXPORT_OPTIONS', () => {
  it('provides sensible defaults for a Japanese PDF export', () => {
    expect(DEFAULT_EXPORT_OPTIONS).toEqual({
      format: 'pdf',
      language: 'ja',
      currency: 'JPY',
      includeCharts: true,
      paperSize: 'A4',
      orientation: 'landscape',
    })
  })

  it('does not pin an exchange rate by default', () => {
    expect(DEFAULT_EXPORT_OPTIONS.exchangeRate).toBeUndefined()
  })

  it('uses a valid ExportFormat value', () => {
    const formats: ExportFormat[] = ['pdf', 'pptx', 'excel', 'csv']
    expect(formats).toContain(DEFAULT_EXPORT_OPTIONS.format)
  })
})

describe('MIME_TYPES', () => {
  it('maps every export format to its MIME string', () => {
    expect(MIME_TYPES.pdf).toBe('application/pdf')
    expect(MIME_TYPES.pptx).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
    expect(MIME_TYPES.excel).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(MIME_TYPES.csv).toBe('text/csv')
  })
})

describe('FILE_EXTENSIONS', () => {
  it('maps every export format to its file extension', () => {
    expect(FILE_EXTENSIONS.pdf).toBe('.pdf')
    expect(FILE_EXTENSIONS.pptx).toBe('.pptx')
    expect(FILE_EXTENSIONS.excel).toBe('.xlsx')
    expect(FILE_EXTENSIONS.csv).toBe('.csv')
  })
})

describe('export format lookup consistency', () => {
  const formats: ExportFormat[] = ['pdf', 'pptx', 'excel', 'csv']

  it('MIME_TYPES and FILE_EXTENSIONS cover every ExportFormat', () => {
    for (const format of formats) {
      expect(MIME_TYPES[format]).toBeTruthy()
      expect(FILE_EXTENSIONS[format]).toBeTruthy()
    }
  })

  it('MIME_TYPES and FILE_EXTENSIONS expose the same set of formats', () => {
    expect(Object.keys(MIME_TYPES).sort()).toEqual(Object.keys(FILE_EXTENSIONS).sort())
  })
})
