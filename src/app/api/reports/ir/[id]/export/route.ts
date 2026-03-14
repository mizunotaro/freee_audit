import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { getIRReport } from '@/services/reports/ir-report-service'
import { exportIRReportToPDF, type PDFExportOptions } from '@/services/reports/ir-pdf-exporter'
import { exportIRReportToPPTX, type PPTXExportOptions } from '@/services/reports/ir-pptx-exporter'
import { sanitizePlainText } from '@/lib/utils/html-sanitize'

const EXPORT_TIMEOUT_MS = 60000

interface ExportRequestBody {
  format: 'pdf' | 'pptx'
  language: 'ja' | 'en'
  companyName?: string
  includeCoverPage?: boolean
  includeTOC?: boolean
}

function sanitizeFilename(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100)
  )
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.length)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < buffer.length; i++) {
    view[i] = buffer[i]
  }
  return arrayBuffer
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    let body: ExportRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { format, language, companyName, includeCoverPage, includeTOC } = body

    if (!format || !['pdf', 'pptx'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "pdf" or "pptx"' },
        { status: 400 }
      )
    }

    if (!language || !['ja', 'en'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language. Must be "ja" or "en"' }, { status: 400 })
    }

    const reportResult = await getIRReport(id)
    if (!reportResult.success) {
      if (reportResult.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'Failed to fetch report', details: reportResult.error.message },
        { status: 500 }
      )
    }

    const report = reportResult.data
    const safeCompanyName = sanitizePlainText(companyName ?? 'Company')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS)

    try {
      if (format === 'pdf') {
        const options: PDFExportOptions = {
          language,
          companyName: safeCompanyName,
          includeCoverPage: includeCoverPage ?? true,
          includeTOC: includeTOC ?? false,
        }

        const result = await exportIRReportToPDF(report, options)

        if (!result.success) {
          return NextResponse.json(
            { error: 'PDF export failed', details: result.error.message },
            { status: 500 }
          )
        }

        const sanitizedTitle = sanitizeFilename(report.title)
        const filename = `ir_report_${report.fiscalYear}_${sanitizedTitle}.pdf`

        clearTimeout(timeoutId)

        return new NextResponse(bufferToArrayBuffer(result.data.buffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Cache-Control': 'no-cache',
          },
        })
      } else {
        const options: PPTXExportOptions = {
          language,
          companyName: safeCompanyName,
          includeTitleSlide: includeCoverPage ?? true,
        }

        const result = await exportIRReportToPPTX(report, options)

        if (!result.success) {
          return NextResponse.json(
            { error: 'PPTX export failed', details: result.error.message },
            { status: 500 }
          )
        }

        const sanitizedTitle = sanitizeFilename(report.title)
        const filename = `ir_report_${report.fiscalYear}_${sanitizedTitle}.pptx`

        clearTimeout(timeoutId)

        return new NextResponse(bufferToArrayBuffer(result.data.buffer), {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            'Cache-Control': 'no-cache',
          },
        })
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'Export timeout exceeded' }, { status: 504 })
      }

      throw error
    }
  } catch (error) {
    console.error('Export API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Export failed', details: message }, { status: 500 })
  }
}
