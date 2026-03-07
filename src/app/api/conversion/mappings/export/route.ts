import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { accountMappingService } from '@/services/conversion/account-mapping-service'
import { z } from 'zod'

const querySchema = z.object({
  targetCoaId: z.string(),
  format: z.enum(['csv', 'excel']).default('csv'),
  includeUnmapped: z.coerce.boolean().default(false),
})

async function getHandler(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url)
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams))

  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { targetCoaId, format } = parseResult.data

  const companyId = req.user.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  try {
    const buffer = await accountMappingService.export(companyId, format)

    const mimeType =
      format === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    const extension = format === 'csv' ? 'csv' : 'xlsx'
    const fileName = `mappings_${targetCoaId}.${extension}`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Export failed:', error)
    return NextResponse.json({ error: 'Export failed', code: 'EXPORT_ERROR' }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
