import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { JournalReceiptMappingService } from '@/services/freee/journal-receipt-mapping-service'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { z } from 'zod'

const ParamsSchema = z.object({
  company_id: z.string().transform(Number).pipe(z.number().int().positive()),
})

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: journalId } = await params
    const searchParams = request.nextUrl.searchParams

    const queryResult = ParamsSchema.safeParse({
      company_id: searchParams.get('company_id'),
    })

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: queryResult.error.errors },
        { status: 400 }
      )
    }

    const { company_id } = queryResult.data
    const journalDate = searchParams.get('journal_date') || new Date().toISOString().split('T')[0]

    if (String(company_id) !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const client = new FreeeClient()
    const mappingService = new JournalReceiptMappingService(client)
    const result = await mappingService.getReceiptsByJournalId(company_id, journalId, journalDate)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: 400 }
      )
    }

    const receipts = await Promise.all(
      result.data.map(async (id: number) => {
        try {
          const receipt = await client.getReceiptDetails(company_id, id)
          return {
            id: receipt.id,
            status: receipt.status,
            description: receipt.description,
            mime_type: receipt.mime_type,
            deal_id: receipt.deal_id,
          }
        } catch {
          return { id, status: 'error', description: null, mime_type: null, deal_id: null }
        }
      })
    )

    return NextResponse.json({
      journalId,
      receipts,
      syncedAt: new Date(),
      mock_mode: process.env.FREEE_MOCK_MODE === 'true',
    })
  } catch (error) {
    console.error('Failed to get journal receipts:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        return NextResponse.json({ error: 'Receipts not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to get journal receipts' }, { status: 500 })
  }
}
