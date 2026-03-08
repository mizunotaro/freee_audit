import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { validateCompanyId } from '@/lib/api/auth-helpers'
import {
  parseJournalCsv,
  importJournals,
  generateJournalTemplate,
} from '@/services/import/journal-import'

async function handler(req: AuthenticatedRequest) {
  const searchParams = new URL(req.url).searchParams
  const action = searchParams.get('action')

  if (action === 'template') {
    const template = generateJournalTemplate()
    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="journal_import_template.csv"',
      },
    })
  }

  const companyId = await validateCompanyId(req.user, searchParams.get('companyId'))

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const skipDuplicates = formData.get('skipDuplicates') !== 'false'
  const updateExisting = formData.get('updateExisting') === 'true'

  if (!file) {
    return NextResponse.json(
      { success: false, error: 'ファイルがアップロードされていません' },
      { status: 400 }
    )
  }

  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.csv')) {
    return NextResponse.json(
      { success: false, error: 'CSVファイルのみ対応しています' },
      { status: 400 }
    )
  }

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json(
      { success: false, error: 'ファイルサイズは10MB以下にしてください' },
      { status: 400 }
    )
  }

  try {
    const content = await file.text()

    if (!content.trim()) {
      return NextResponse.json({ success: false, error: 'ファイルが空です' }, { status: 400 })
    }

    const rows = parseJournalCsv(content)

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'インポート可能なデータがありません' },
        { status: 400 }
      )
    }

    const maxRows = 10000
    if (rows.length > maxRows) {
      return NextResponse.json(
        { success: false, error: `最大${maxRows}行までインポート可能です` },
        { status: 400 }
      )
    }

    const result = await importJournals(rows, companyId, {
      skipDuplicates,
      updateExisting,
    })

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors.slice(0, 100),
      totalRows: rows.length,
    })
  } catch (error) {
    console.error('[API] Journal import error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'インポート中にエラーが発生しました',
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handler, { requireCompany: true })

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams
  if (searchParams.get('action') === 'template') {
    const template = generateJournalTemplate()
    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="journal_import_template.csv"',
      },
    })
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
