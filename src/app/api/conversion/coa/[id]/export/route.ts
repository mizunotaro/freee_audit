import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'
import * as XLSX from 'xlsx'
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
      { error: 'Missing parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const params = await Promise.resolve(context.params)
  const id = params.id

  const { searchParams } = new URL(req.url)
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams))

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { format, language } = parseResult.data

  try {
    const coa = await chartOfAccountService.getById(id)

    if (!coa) {
      return NextResponse.json(
        { error: 'Chart of Accounts not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (
      coa.companyId !== req.user.companyId &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    const headers = [
      'code',
      'name',
      'name_en',
      'category',
      'subcategory',
      'normal_balance',
      'parent_code',
      'is_convertible',
    ]
    const rows = coa.items.map((item) => {
      const row: (string | number | boolean)[] = [
        item.code,
        language === 'en' ? item.nameEn : item.name,
        item.nameEn,
        item.category,
        item.subcategory || '',
        item.normalBalance,
        item.parentId || '',
        item.isConvertible,
      ]
      return row
    })

    if (format === 'csv') {
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row
            .map((cell) => {
              if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                return `"${cell.replace(/"/g, '""')}"`
              }
              return String(cell)
            })
            .join(',')
        ),
      ].join('\n')

      const buffer = Buffer.from(csvContent, 'utf-8')
      const fileName = `${coa.name}_${coa.standard}.csv`

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Content-Length': buffer.length.toString(),
        },
      })
    } else {
      const worksheetData = [headers, ...rows]
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Chart of Accounts')

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      const fileName = `${coa.name}_${coa.standard}.xlsx`

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Content-Length': buffer.length.toString(),
        },
      })
    }
  } catch (error) {
    console.error('Export failed:', error)
    return NextResponse.json({ error: 'Export failed', code: 'EXPORT_ERROR' }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
