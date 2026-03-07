import { NextResponse } from 'next/server'
import { withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'
import { z } from 'zod'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_CSV_TYPES = ['text/csv', 'application/vnd.ms-excel', 'text/plain']
const ALLOWED_EXCEL_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]

const querySchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv'),
  standardId: z.enum(['JGAAP', 'USGAAP', 'IFRS']),
})

async function postHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  if (!context?.params) {
    return NextResponse.json(
      { error: 'Missing parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const companyId = req.user.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(req.url)
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams))

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { format, standardId } = parseResult.data

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'File is required', code: 'FILE_REQUIRED' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size exceeds limit',
          code: 'FILE_TOO_LARGE',
          maxSize: MAX_FILE_SIZE,
          actualSize: file.size,
        },
        { status: 400 }
      )
    }

    const allowedTypes = format === 'csv' ? ALLOWED_CSV_TYPES : ALLOWED_EXCEL_TYPES
    if (!allowedTypes.includes(file.type) && file.name) {
      const extension = file.name.split('.').pop()?.toLowerCase()
      const validExtension =
        format === 'csv' ? extension === 'csv' : ['xlsx', 'xls'].includes(extension || '')

      if (!validExtension) {
        return NextResponse.json(
          {
            error: `Invalid file type for ${format} format`,
            code: 'INVALID_FILE_TYPE',
            actualType: file.type,
          },
          { status: 400 }
        )
      }
    }

    const standardMap: Record<string, string> = {
      JGAAP: 'jgaap',
      USGAAP: 'usgaap',
      IFRS: 'ifrs',
    }

    const result =
      format === 'csv'
        ? await chartOfAccountService.importFromCSV(companyId, standardMap[standardId], file)
        : await chartOfAccountService.importFromExcel(companyId, standardMap[standardId], file)

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Import failed:', error)

    return NextResponse.json({ error: 'Import failed', code: 'IMPORT_ERROR' }, { status: 500 })
  }
}

export const POST = withAccountantAuth(postHandler)
