import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'

const updateProviderSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  lastError: z.string().nullable().optional(),
})

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const parsed = updateProviderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await prisma.marketDataProvider.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.marketDataProvider.update({
      where: { id },
      data: {
        enabled: parsed.data.enabled ?? existing.enabled,
        priority: parsed.data.priority ?? existing.priority,
        lastError: parsed.data.lastError !== undefined ? parsed.data.lastError : existing.lastError,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        provider: updated.provider,
        enabled: updated.enabled,
        priority: updated.priority,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.marketDataProvider.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    await prisma.marketDataProvider.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
