import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { z } from 'zod'

const DownloadParamsSchema = z.object({
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

    const { id: documentId } = await params
    const searchParams = request.nextUrl.searchParams

    const parseResult = DownloadParamsSchema.safeParse({
      company_id: searchParams.get('company_id'),
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { company_id } = parseResult.data

    if (String(company_id) !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const documentIdNum = parseInt(documentId, 10)
    if (isNaN(documentIdNum) || documentIdNum <= 0) {
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 })
    }

    const client = new FreeeClient()
    const { buffer, contentType } = await client.downloadDocument(company_id, documentIdNum)

    const contentDisposition =
      searchParams.get('inline') === 'true'
        ? `inline; filename="document-${documentId}"`
        : `attachment; filename="document-${documentId}"`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Failed to download document:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('404')) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}
