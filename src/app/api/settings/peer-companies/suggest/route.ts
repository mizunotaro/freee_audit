import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSession } from '@/lib/auth'
import { createPeerSelectorAI } from '@/services/peer-companies'
import { getAIService } from '@/lib/integrations/ai'
import { logRouteAudit } from '@/lib/route-audit'

const suggestPeersSchema = z.object({
  industry: z.string().min(1),
  subIndustry: z.string().optional(),
  revenue: z.number().optional(),
  employees: z.number().int().optional(),
  geography: z.string().optional(),
  market: z.enum(['JPX', 'NASDAQ', 'NYSE', 'GLOBAL']).optional(),
  growthStage: z.enum(['seed', 'early', 'growth', 'mature']).optional(),
  minPeers: z.number().int().min(1).default(3),
  maxPeers: z.number().int().min(1).default(10),
  seed: z.union([z.string(), z.number()]).optional(),
  useAI: z.boolean().default(true),
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

    const parsed = suggestPeersSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      industry,
      subIndustry,
      revenue,
      employees,
      geography,
      market,
      growthStage,
      minPeers,
      maxPeers,
      seed,
      useAI,
    } = parsed.data

    const aiService = getAIService()
    const aiProvider = await aiService.getProvider(undefined, {
      userId: user.id,
      companyId: user.companyId,
    })

    const selector = createPeerSelectorAI(aiProvider ?? undefined)

    const result = await selector.suggestPeers(
      {
        industry,
        subIndustry,
        revenue,
        employees,
        geography,
      },
      {
        industry,
        subIndustry,
        revenue: revenue ? { min: revenue * 0.5, max: revenue * 2 } : undefined,
        market,
        growthStage,
        minPeers,
        maxPeers,
      },
      {
        seed: seed ? Number(seed) : undefined,
        useAI,
      }
    )

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'PEER_COMPANY_SUGGEST',
      resource: 'peer_company',
    })

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'PEER_COMPANY_SUGGEST',
      resource: 'peer_company',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
