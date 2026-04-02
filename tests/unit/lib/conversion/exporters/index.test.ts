import { describe, it, expect } from 'vitest'
import {
  EXPORT_MIME_TYPES,
  EXPORT_EXTENSIONS,
  PDFExporter,
  ExcelExporter,
  CSVExporter,
  JSONExporter,
  WordExporter,
} from '@/lib/conversion/exporters'

describe('exporters index', function () {
  it('should re-export EXPORT_MIME_TYPES', function () {
    expect(EXPORT_MIME_TYPES).toBeDefined()
    expect(EXPORT_MIME_TYPES.pdf).toBe('application/pdf')
  })

  it('should re-export EXPORT_EXTENSIONS', function () {
    expect(EXPORT_EXTENSIONS).toBeDefined()
    expect(EXPORT_EXTENSIONS.pdf).toBe('.pdf')
  })

  it('should re-export PDFExporter', function () {
    expect(PDFExporter).toBeDefined()
  })

  it('should re-export ExcelExporter', function () {
    expect(ExcelExporter).toBeDefined()
  })

  it('should re-export CSVExporter', function () {
    expect(CSVExporter).toBeDefined()
  })

  it('should re-export JSONExporter', function () {
    expect(JSONExporter).toBeDefined()
  })

  it('should re-export WordExporter', function () {
    expect(WordExporter).toBeDefined()
  })
})
