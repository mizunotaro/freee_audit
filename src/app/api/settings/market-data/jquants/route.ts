import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { logRouteAudit } from '@/lib/route-audit'

const saveJquantsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = saveJquantsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const encryptedEmail = encrypt(email)
    const encryptedPassword = encrypt(password)

    const existing = await prisma.marketDataProvider.findUnique({
      where: {
        companyId_provider: {
          companyId: user.companyId,
          provider: 'jquants',
        },
      },
    })

    let provider
    if (existing) {
      provider = await prisma.marketDataProvider.update({
        where: { id: existing.id },
        data: {
          encryptedEmail,
          encryptedPassword,
          lastError: null,
        },
      })
    } else {
      provider = await prisma.marketDataProvider.create({
        data: {
          companyId: user.companyId,
          provider: 'jquants',
          encryptedEmail,
          encryptedPassword,
          enabled: true,
          priority: 10,
        },
      })
    }

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'JQUANTS_CREDENTIALS_SAVE',
      resource: 'market_data_provider',
      resourceId: provider.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        id: provider.id,
        provider: provider.provider,
        enabled: provider.enabled,
      },
    })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'JQUANTS_CREDENTIALS_SAVE',
      resource: 'market_data_provider',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
