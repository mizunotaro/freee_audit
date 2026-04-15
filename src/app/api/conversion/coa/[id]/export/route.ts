import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'
import ExcelJS from 'exceljs'
import { z } from 'zod'

const querySchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv'),
  language: z.enum(['ja', 'en', 'both']).default('ja'),
})

async function getHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  if (!context?.params) {
    return NextResponse.json(
      { error: 'Missing parameters', code: 'missing_parameters' },
      { status: 400 }
    )
  }

  const resolvedParams = context.params instanceof Promise ? await context.params : context.params
  const { id } = resolvedParams

  const { searchParams } = new URL(req.url)
  const parseResult = querySchema.safeParse({
    format: searchParams.get('format') || 'csv',
    language: searchParams.get('language') || 'ja',
  })

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parseResult.error, code: 'invalid_parameters' },
      { status: 400 }
    )
  }

  const { format, language } = parseResult.data

  try {
    const coa = await chartOfAccountService.getById(id)
    if (!coa) {
      return NextResponse.json(
        { error: 'Chart of Accounts not found', code: 'not_found' },
        { status: 404 }
      )
    }

    const accounts = coa.items

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = '管理部門支援システム'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet('勘定科目')

      const headers =
        language === 'both'
          ? [
              'コード',
              '科目名',
              'Name (EN)',
              'カテゴリ',
              'サブカテゴリ',
              '借方/貸方',
              '親コード',
              '変換可能',
            ]
          : language === 'en'
            ? [
                'Code',
                'Name',
                'Name (EN)',
                'Category',
                'Subcategory',
                'Normal Balance',
                'Parent Code',
                'Convertible',
              ]
            : ['コード', '科目名', 'カテゴリ', 'サブカテゴリ', '借方/貸方', '親コード', '変換可能']

      worksheet.addRow(headers)

      for (const account of accounts) {
        const row =
          language === 'both'
            ? [
                account.code,
                account.name,
                account.nameEn,
                account.category,
                account.subcategory || '',
                account.normalBalance,
                account.parentId || '',
                account.isConvertible ? 'Yes' : 'No',
              ]
            : language === 'en'
              ? [
                  account.code,
                  account.name,
                  account.nameEn,
                  account.category,
                  account.subcategory || '',
                  account.normalBalance,
                  account.parentId || '',
                  account.isConvertible ? 'Yes' : 'No',
                ]
              : [
                  account.code,
                  account.name,
                  account.category,
                  account.subcategory || '',
                  account.normalBalance,
                  account.parentId || '',
                  account.isConvertible ? 'はい' : 'いいえ',
                ]

        worksheet.addRow(row)
      }

      worksheet.columns.forEach((column, _index) => {
        let maxLength = 0
        column?.eachCell?.((cell) => {
          const cellLength = cell.value ? String(cell.value).length : 0
          if (cellLength > maxLength) {
            maxLength = cellLength
          }
        })
        column.width = Math.min(maxLength + 2, 50)
      })

      const buffer = await workbook.xlsx.writeBuffer()

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${coa.name}_${coa.standard}.xlsx"`,
        },
      })
    } else {
      const csvLines: string[] = []
      const headers =
        language === 'both'
          ? [
              'コード',
              '科目名',
              'Name (EN)',
              'カテゴリ',
              'サブカテゴリ',
              '借方/貸方',
              '親コード',
              '変換可能',
            ]
          : language === 'en'
            ? [
                'Code',
                'Name',
                'Name (EN)',
                'Category',
                'Subcategory',
                'Normal Balance',
                'Parent Code',
                'Convertible',
              ]
            : ['コード', '科目名', 'カテゴリ', 'サブカテゴリ', '借方/貸方', '親コード', '変換可能']

      csvLines.push(headers.map((h) => `"${h}"`).join(','))

      for (const account of accounts) {
        const row =
          language === 'both'
            ? [
                account.code,
                account.name,
                account.nameEn,
                account.category,
                account.subcategory || '',
                account.normalBalance,
                account.parentId || '',
                account.isConvertible ? 'Yes' : 'No',
              ]
            : language === 'en'
              ? [
                  account.code,
                  account.name,
                  account.nameEn,
                  account.category,
                  account.subcategory || '',
                  account.normalBalance,
                  account.parentId || '',
                  account.isConvertible ? 'Yes' : 'No',
                ]
              : [
                  account.code,
                  account.name,
                  account.category,
                  account.subcategory || '',
                  account.normalBalance,
                  account.parentId || '',
                  account.isConvertible ? 'はい' : 'いいえ',
                ]

        csvLines.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      }

      const csvContent = csvLines.join('\n')
      const fileName = `${coa.name}_${coa.standard}.csv`

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed', code: 'export_error' }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
