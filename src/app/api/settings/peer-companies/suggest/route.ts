import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { createPeerSelectorAI } from '@/services/peer-companies'
import { getAIService } from '@/lib/integrations/ai'

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
    const {
      industry,
      subIndustry,
      revenue,
      employees,
      geography,
      market,
      growthStage,
      minPeers = 3,
      maxPeers = 10,
      seed,
      useAI = true,
    } = body

    if (!industry) {
      return NextResponse.json({ success: false, error: 'Industry is required' }, { status: 400 })
    }

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

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
