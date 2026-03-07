import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import {
  sanitizeSettings,
  validateApiKeyUpdate,
  SENSITIVE_FIELDS,
} from '@/lib/api/settings-sanitizer'
import { z } from 'zod'

const ENCRYPTED_FIELDS = [...SENSITIVE_FIELDS]

const DEFAULT_PROMPT = `freeeから取得したスタートアップ企業の財務データを公認会計士・税理士の観点から分析を行って下さい。経営指標についてはVC/CVCや銀行員の観点からも評価をおこなってください。

分析にあたっては以下の点に注意してください：
1. 収益性、安全性、効率性、成長性の観点から総合評価を行う
2. 特異な数値や異常値があれば指摘する
3. 改善すべき点があれば具体的なアクションプランを提示する
4. 業界標準との比較観点も含める`

const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  aiProvider: z.enum(['openai', 'gemini', 'claude']).optional(),
  secretSource: z
    .enum(['local', 'gcp_secret', 'aws_secrets', 'azure_keyvault', 'onepassword'])
    .optional(),
  azureEndpoint: z.string().url().optional().nullable(),
  awsAccessKeyId: z.string().optional().nullable(),
  awsRegion: z.string().optional().nullable(),
  gcpProjectId: z.string().optional().nullable(),
  freeeClientId: z.string().optional().nullable(),
  freeeCompanyId: z.string().optional().nullable(),
  analysisPrompt: z.string().max(5000).optional().nullable(),
  fiscalYearEndMonth: z.number().int().min(1).max(12).optional(),
  taxBusinessType: z.string().optional().nullable(),
  openaiApiKey: z.string().min(1).optional(),
  geminiApiKey: z.string().min(1).optional(),
  claudeApiKey: z.string().min(1).optional(),
  azureApiKey: z.string().min(1).optional(),
  awsSecretAccessKey: z.string().min(1).optional(),
  gcpApiKey: z.string().min(1).optional(),
  freeeClientSecret: z.string().min(1).optional(),
})

async function getHandler(req: AuthenticatedRequest) {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: req.user.id },
    })

    const safeSettings = sanitizeSettings(settings)

    if (!settings) {
      safeSettings.analysisPrompt = DEFAULT_PROMPT
    }

    return NextResponse.json(safeSettings)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

async function putHandler(req: AuthenticatedRequest) {
  try {
    const body = await req.json()

    const validatedBody = updateSettingsSchema.safeParse(body)
    if (!validatedBody.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validatedBody.error.flatten() },
        { status: 400 }
      )
    }

    const validation = validateApiKeyUpdate(req.user.role, validatedBody.data)
    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 403 })
    }

    const data: Record<string, unknown> = {
      theme: validatedBody.data.theme ?? 'system',
      aiProvider: validatedBody.data.aiProvider ?? 'openai',
      secretSource: validatedBody.data.secretSource ?? 'local',
      azureEndpoint: validatedBody.data.azureEndpoint,
      awsAccessKeyId: validatedBody.data.awsAccessKeyId,
      awsRegion: validatedBody.data.awsRegion,
      gcpProjectId: validatedBody.data.gcpProjectId,
      freeeClientId: validatedBody.data.freeeClientId,
      freeeCompanyId: validatedBody.data.freeeCompanyId,
      analysisPrompt: validatedBody.data.analysisPrompt,
      fiscalYearEndMonth: validatedBody.data.fiscalYearEndMonth ?? 12,
      taxBusinessType: validatedBody.data.taxBusinessType ?? 'general',
    }

    for (const field of ENCRYPTED_FIELDS) {
      const value = validatedBody.data[field as keyof typeof validatedBody.data]
      if (value && typeof value === 'string' && value.length > 0) {
        data[field] = encrypt(value)
      } else if (value === '' || value === null) {
        data[field] = null
      }
    }

    const settings = await prisma.settings.upsert({
      where: { userId: req.user.id },
      update: data,
      create: {
        userId: req.user.id,
        ...data,
      },
    })

    const safeSettings = sanitizeSettings(settings)

    return NextResponse.json({ success: true, settings: safeSettings })
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
export const PUT = withAuth(putHandler)
