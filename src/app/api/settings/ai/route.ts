import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto/encryption'

export async function GET() {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        provider: { in: ['OPENAI', 'GEMINI', 'CLAUDE'] },
      },
    })

    const config = apiKeys.reduce(
      (acc, key) => {
        const provider = key.provider.toLowerCase()
        return {
          ...acc,
          [provider]: {
            configured: true,
            expiresAt: key.expiresAt,
          },
        }
      },
      {} as Record<string, { configured: boolean; expiresAt: Date | null }>
    )

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Failed to get AI config:', error)
    return NextResponse.json({ config: {} })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, apiKey, model } = body

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'provider and apiKey are required' }, { status: 400 })
    }

    const providerMap: Record<string, string> = {
      openai: 'OPENAI',
      gemini: 'GEMINI',
      claude: 'CLAUDE',
    }

    const dbProvider = providerMap[provider.toLowerCase()]
    if (!dbProvider) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    let company = await prisma.company.findFirst()
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Default Company',
          fiscalYearStart: 1,
        },
      })
    }

    const encryptedKey = encrypt(apiKey)

    await prisma.apiKey.upsert({
      where: {
        companyId_provider: {
          companyId: company.id,
          provider: dbProvider as 'OPENAI' | 'GEMINI' | 'CLAUDE',
        },
      },
      create: {
        companyId: company.id,
        provider: dbProvider as 'OPENAI' | 'GEMINI' | 'CLAUDE',
        encryptedKey,
        metadata: JSON.stringify({ model }),
      },
      update: {
        encryptedKey,
        metadata: JSON.stringify({ model }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save AI config:', error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }
}
