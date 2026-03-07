import { NextResponse } from 'next/server'
import { withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import { aiConversionAdvisor } from '@/services/conversion/ai-conversion-advisor'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'
import { applyDefaultMappings } from '@/lib/conversion/default-mappings'
import { z } from 'zod'
import type { MappingSuggestion } from '@/types/conversion'

const REQUEST_TIMEOUT = 60000

const suggestSchema = z.object({
  sourceCoaId: z.string(),
  targetCoaId: z.string(),
  targetStandard: z.enum(['USGAAP', 'IFRS']),
  sourceAccountCodes: z.array(z.string()).optional(),
  useAI: z.boolean().default(true),
})

async function postHandler(req: AuthenticatedRequest) {
  const companyId = req.user.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parseResult = suggestSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    )
  }

  const validated = parseResult.data

  try {
    const [sourceCoa, targetCoa] = await Promise.all([
      chartOfAccountService.getById(validated.sourceCoaId),
      chartOfAccountService.getById(validated.targetCoaId),
    ])

    if (!sourceCoa || !targetCoa) {
      return NextResponse.json({ error: 'COA not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    if (
      (sourceCoa.companyId !== companyId || targetCoa.companyId !== companyId) &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    let sourceAccounts = sourceCoa.items || []
    if (validated.sourceAccountCodes && validated.sourceAccountCodes.length > 0) {
      sourceAccounts = sourceAccounts.filter((item) =>
        validated.sourceAccountCodes!.includes(item.code)
      )
    }

    let suggestions: MappingSuggestion[]
    let method: 'ai' | 'rule-based'

    if (validated.useAI && process.env.AI_MOCK_MODE !== 'true') {
      try {
        suggestions = await Promise.race([
          aiConversionAdvisor.suggestMappings(sourceAccounts, targetCoa, validated.targetStandard),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), REQUEST_TIMEOUT)
          ),
        ])
        method = 'ai'
      } catch (error) {
        console.warn('AI suggestion failed, falling back to rule-based:', error)
        suggestions = generateRuleBasedSuggestions(
          sourceAccounts,
          targetCoa.items || [],
          validated.targetStandard
        )
        method = 'rule-based'
      }
    } else {
      suggestions = generateRuleBasedSuggestions(
        sourceAccounts,
        targetCoa.items || [],
        validated.targetStandard
      )
      method = 'rule-based'
    }

    return NextResponse.json({
      data: suggestions,
      meta: {
        sourceCount: sourceAccounts.length,
        targetStandard: validated.targetStandard,
        generatedAt: new Date().toISOString(),
        method,
      },
    })
  } catch (error) {
    console.error('Failed to generate suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions', code: 'SUGGESTION_ERROR' },
      { status: 500 }
    )
  }
}

function generateRuleBasedSuggestions(
  sourceItems: Array<{ id: string; code: string; name: string; category: string }>,
  targetItems: Array<{ id: string; code: string; name: string }>,
  targetStandard: 'USGAAP' | 'IFRS'
): MappingSuggestion[] {
  const defaultMappings = applyDefaultMappings(
    sourceItems.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category as
        | 'current_asset'
        | 'fixed_asset'
        | 'deferred_asset'
        | 'current_liability'
        | 'fixed_liability'
        | 'deferred_liability'
        | 'equity'
        | 'revenue'
        | 'cogs'
        | 'sga_expense'
        | 'non_operating_income'
        | 'non_operating_expense'
        | 'extraordinary_income'
        | 'extraordinary_loss',
    })),
    targetStandard
  )

  const targetItemMap = new Map(targetItems.map((item) => [item.code, item]))

  return defaultMappings.map((mapping) => {
    const targetItem = targetItemMap.get(mapping.targetCode)
    const sourceItem = sourceItems.find((item) => item.id === mapping.sourceItemId)

    return {
      sourceAccountCode: mapping.sourceCode,
      sourceAccountName: sourceItem?.name || mapping.sourceCode,
      suggestedTargetCode: mapping.targetCode,
      suggestedTargetName: targetItem?.name || mapping.targetName,
      confidence: mapping.confidence,
      reasoning: `Rule-based mapping: ${mapping.mappingType} with ${Math.round(mapping.confidence * 100)}% confidence`,
      alternatives: [],
    }
  })
}

export const POST = withAccountantAuth(postHandler)
