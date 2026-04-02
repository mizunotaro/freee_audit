import { describe, it, expect } from 'vitest'
import { EXPORT_MIME_TYPES, EXPORT_EXTENSIONS } from '@/lib/conversion/exporters/types'

describe('EXPORT_MIME_TYPES', function () {
  it('should have pdf mime type', function () {
    expect(EXPORT_MIME_TYPES.pdf).toBe('application/pdf')
  })

  it('should have excel mime type', function () {
    expect(EXPORT_MIME_TYPES.excel).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('should have csv mime type', function () {
    expect(EXPORT_MIME_TYPES.csv).toBe('text/csv')
  })

  it('should have json mime type', function () {
    expect(EXPORT_MIME_TYPES.json).toBe('application/json')
  })

  it('should have exactly 4 entries', function () {
    expect(Object.keys(EXPORT_MIME_TYPES).length).toBe(4)
  })
})

describe('EXPORT_EXTENSIONS', function () {
  it('should have pdf extension', function () {
    expect(EXPORT_EXTENSIONS.pdf).toBe('.pdf')
  })

  it('should have excel extension', function () {
    expect(EXPORT_EXTENSIONS.excel).toBe('.xlsx')
  })

  it('should have csv extension', function () {
    expect(EXPORT_EXTENSIONS.csv).toBe('.csv')
  })

  it('should have json extension', function () {
    expect(EXPORT_EXTENSIONS.json).toBe('.json')
  })

  it('should have exactly 4 entries', function () {
    expect(Object.keys(EXPORT_EXTENSIONS).length).toBe(4)
  })
})
