import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest, validateCompanyId } from '@/lib/api'
import { monthlyBalanceImporter } from '@/services/import/monthly-balance-importer'
import { IMPORT_LIMITS, type ImportErrorCode } from '@/services/import/types'

const IMPORT_TIMEOUT_MS = 60000

interface ImportErrorResponse {
  row: number
  code: ImportErrorCode
  message: string
  field?: string
  value?: unknown
  severity: 'error' | 'warning'
}

async function handler(req: AuthenticatedRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS)

  try {
    const searchParams = new URL(req.url).searchParams
    const action = searchParams.get('action')
    const language = (searchParams.get('language') as 'ja' | 'en') || 'ja'

    if (action === 'template') {
      const template = monthlyBalanceImporter.generateTemplate(language)
      return new NextResponse(template, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="monthly_balance_template_${language}.csv"`,
        },
      })
    }

    const companyId = await validateCompanyId(req.user, searchParams.get('companyId'))

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const mode = formData.get('mode') as string | null
    const skipDuplicates = formData.get('skipDuplicates') !== 'false'
    const updateExisting = formData.get('updateExisting') === 'true'
    const dryRun = formData.get('dryRun') === 'true'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ファイルがアップロードされていません' },
        { status: 400 }
      )
    }

    const maxFileSize = Math.max(IMPORT_LIMITS.MAX_FILE_SIZE_CSV, IMPORT_LIMITS.MAX_FILE_SIZE_EXCEL)
    if (file.size > maxFileSize) {
      return NextResponse.json(
        {
          success: false,
          error: `ファイルサイズは${maxFileSize / 1024 / 1024}MB以下にしてください`,
        },
        { status: 400 }
      )
    }

    const extension = file.name.toLowerCase().split('.').pop()
    if (!['csv', 'xlsx', 'xls', 'xlsm'].includes(extension ?? '')) {
      return NextResponse.json(
        { success: false, error: 'CSVまたはExcelファイル(.xlsx, .xls)のみ対応しています' },
        { status: 400 }
      )
    }

    if (mode === 'preview') {
      const result = await monthlyBalanceImporter.preview(file)

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        preview: result.data,
      })
    }

    const result = await monthlyBalanceImporter.import(
      file,
      { companyId },
      {
        skipDuplicates,
        updateExisting,
        dryRun,
      }
    )

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    const importResult = result.data

    return NextResponse.json({
      success: importResult.success,
      imported: importResult.imported,
      skipped: importResult.skipped,
      failed: importResult.failed,
      errors: (importResult.errors as ImportErrorResponse[]).slice(
        0,
        IMPORT_LIMITS.MAX_ERRORS_DISPLAY
      ),
      warnings: importResult.warnings,
      totalRows: importResult.totalRows,
      validRows: importResult.validRows,
    })
  } catch (error) {
    console.error('[API] Monthly balance import error:', error)
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: 'インポートがタイムアウトしました' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'インポート中にエラーが発生しました',
      },
      { status: 500 }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export const POST = withAuth(handler, { requireCompany: true })

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams
  const action = searchParams.get('action')
  const language = (searchParams.get('language') as 'ja' | 'en') || 'ja'

  if (action === 'template') {
    const template = monthlyBalanceImporter.generateTemplate(language)
    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="monthly_balance_template_${language}.csv"`,
      },
    })
  }

  return NextResponse.json(
    { error: 'Invalid action. Use action=template to download template.' },
    { status: 400 }
  )
}
