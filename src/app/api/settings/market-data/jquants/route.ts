import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'

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

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

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

    return NextResponse.json({
      success: true,
      data: {
        id: provider.id,
        provider: provider.provider,
        enabled: provider.enabled,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
