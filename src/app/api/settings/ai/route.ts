import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto/encryption'
import { logRouteAudit } from '@/lib/route-audit'

const saveAiConfigSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'claude']),
  apiKey: z.string().min(1),
  model: z.string().optional(),
})

async function getHandler(req: AuthenticatedRequest) {
  try {
    const companyId = req.user.companyId

    if (!companyId) {
      return NextResponse.json({ config: {} })
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        companyId,
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

async function postHandler(req: AuthenticatedRequest) {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return NextResponse.json({ error: 'Only admins can configure API keys' }, { status: 403 })
    }

    const companyId = req.user.companyId

    if (!companyId) {
      return NextResponse.json({ error: 'User is not associated with a company' }, { status: 400 })
    }

    const parsed = saveAiConfigSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { provider, apiKey, model } = parsed.data

    const providerMap: Record<string, string> = {
      openai: 'OPENAI',
      gemini: 'GEMINI',
      claude: 'CLAUDE',
    }

    const dbProvider = providerMap[provider]
    if (!dbProvider) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    const encryptedKey = encrypt(apiKey)

    await prisma.apiKey.upsert({
      where: {
        companyId_provider: {
          companyId,
          provider: dbProvider as 'OPENAI' | 'GEMINI' | 'CLAUDE',
        },
      },
      create: {
        companyId,
        provider: dbProvider as 'OPENAI' | 'GEMINI' | 'CLAUDE',
        encryptedKey,
        metadata: JSON.stringify({ model }),
      },
      update: {
        encryptedKey,
        metadata: JSON.stringify({ model }),
      },
    })

    await logRouteAudit({
      request: req,
      userId: req.user.id,
      action: 'AI_CONFIG_SAVE',
      resource: 'ai_config',
      details: { provider },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    await logRouteAudit({
      request: req,
      userId: req.user.id,
      action: 'AI_CONFIG_SAVE',
      resource: 'ai_config',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    console.error('Failed to save AI config:', error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }
}

export const GET = withAuth(getHandler, { requireCompany: true })
export const POST = withAuth(postHandler, { requireCompany: true })
