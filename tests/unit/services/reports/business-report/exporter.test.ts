import { describe, it, expect, beforeEach } from 'vitest'
import { BusinessReportExporter } from '@/services/reports/business-report/exporter'

describe('BusinessReportExporter', () => {
  let exporter: BusinessReportExporter

  beforeEach(() => {
    exporter = new BusinessReportExporter()
  })

  it('should export to HTML format', async () => {
    const report = {
      companyName: 'Test Corp',
      fiscalYear: 2024,
      sections: [{ title: 'Business Overview', content: '<p>Overview content</p>' }],
    } as any

    const result = await exporter.export(report, { format: 'html', language: 'ja' } as any)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.filename).toContain('Test')
    expect(result.filename).toContain('2024')
    expect(result.filename).toContain('.html')
  })

  it('should export to HTML with English language', async () => {
    const report = {
      companyName: 'Test Corp',
      fiscalYear: 2024,
    } as any

    const result = await exporter.export(report, { format: 'html', language: 'en' } as any)

    expect(result.success).toBe(true)
    const html = await result.data!.text()
    expect(html).toContain('lang="en"')
    expect(html).toContain('Business Report')
  })

  it('should return error for PDF format', async () => {
    const report = { companyName: 'Test', fiscalYear: 2024 } as any

    const result = await exporter.export(report, { format: 'pdf' } as any)

    expect(result.success).toBe(false)
    expect(result.error).toContain('PDF')
  })

  it('should return error for Word format', async () => {
    const report = { companyName: 'Test', fiscalYear: 2024 } as any

    const result = await exporter.export(report, { format: 'word' } as any)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Word')
  })

  it('should return error for XBRL format', async () => {
    const report = { companyName: 'Test', fiscalYear: 2024 } as any

    const result = await exporter.export(report, { format: 'xbrl' } as any)

    expect(result.success).toBe(false)
    expect(result.error).toContain('XBRL')
  })

  it('should escape HTML in content', async () => {
    const report = {
      companyName: '<script>alert("xss")</script>',
      fiscalYear: 2024,
    } as any

    const result = await exporter.export(report, { format: 'html', language: 'ja' } as any)

    expect(result.success).toBe(true)
    const html = await result.data!.text()
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('should handle reports with sections', async () => {
    const report = {
      companyName: 'Test Corp',
      fiscalYear: 2024,
      sections: [
        { title: 'Section 1', content: 'Content 1' },
        { title: 'Section 2', content: 'Content 2' },
      ],
    } as any

    const result = await exporter.export(report, { format: 'html', language: 'ja' } as any)

    expect(result.success).toBe(true)
    const html = await result.data!.text()
    expect(html).toContain('Section 1')
    expect(html).toContain('Section 2')
  })

  it('should handle missing company name', async () => {
    const report = { fiscalYear: 2024 } as any

    const result = await exporter.export(report, { format: 'html', language: 'ja' } as any)

    expect(result.success).toBe(true)
    expect(result.filename).toContain('company')
  })
})
