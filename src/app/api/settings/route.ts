import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

const ENCRYPTED_FIELDS = [
  'openaiApiKey',
  'geminiApiKey',
  'claudeApiKey',
  'azureApiKey',
  'awsSecretAccessKey',
  'gcpApiKey',
  'freeeClientSecret',
]

const DEFAULT_PROMPT = `freeeから取得したスタートアップ企業の財務データを公認会計士・税理士の観点から分析を行って下さい。経営指標についてはVC/CVCや銀行員の観点からも評価をおこなってください。

分析にあたっては以下の点に注意してください：
1. 収益性、安全性、効率性、成長性の観点から総合評価を行う
2. 特異な数値や異常値があれば指摘する
3. 改善すべき点があれば具体的なアクションプランを提示する
4. 業界標準との比較観点も含める`

async function getUserId(_request: NextRequest): Promise<string> {
  const users = await prisma.user.findMany({ take: 1 })
  if (users.length > 0) {
    return users[0].id
  }
  const user = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin',
      passwordHash: 'dummy',
      role: 'ADMIN',
    },
  })
  return user.id
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)

    const settings = await prisma.settings.findUnique({
      where: { userId },
    })

    if (!settings) {
      return NextResponse.json({
        theme: 'system',
        aiProvider: 'openai',
        secretSource: 'local',
        openaiApiKey: '',
        geminiApiKey: '',
        claudeApiKey: '',
        azureApiKey: '',
        azureEndpoint: '',
        awsAccessKeyId: '',
        awsSecretAccessKey: '',
        awsRegion: 'ap-northeast-1',
        gcpApiKey: '',
        gcpProjectId: '',
        freeeClientId: '',
        freeeClientSecret: '',
        freeeCompanyId: '',
        analysisPrompt: DEFAULT_PROMPT,
        fiscalYearEndMonth: 12,
        taxBusinessType: 'general',
      })
    }

    const decryptedSettings: Record<string, unknown> = {
      theme: settings.theme,
      aiProvider: settings.aiProvider,
      secretSource: settings.secretSource,
      azureEndpoint: settings.azureEndpoint,
      awsAccessKeyId: settings.awsAccessKeyId,
      awsRegion: settings.awsRegion,
      gcpProjectId: settings.gcpProjectId,
      freeeClientId: settings.freeeClientId,
      freeeCompanyId: settings.freeeCompanyId,
      analysisPrompt: settings.analysisPrompt || DEFAULT_PROMPT,
      fiscalYearEndMonth: settings.fiscalYearEndMonth || 12,
      taxBusinessType: settings.taxBusinessType || 'general',
    }

    for (const field of ENCRYPTED_FIELDS) {
      const encryptedValue = settings[field as keyof typeof settings] as string | null
      if (encryptedValue) {
        try {
          decryptedSettings[field] = decrypt(encryptedValue)
        } catch {
          decryptedSettings[field] = ''
        }
      } else {
        decryptedSettings[field] = ''
      }
    }

    return NextResponse.json(decryptedSettings)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    const body = await request.json()

    const data: Record<string, unknown> = {
      theme: body.theme || 'system',
      aiProvider: body.aiProvider || 'openai',
      secretSource: body.secretSource || 'local',
      azureEndpoint: body.azureEndpoint,
      awsAccessKeyId: body.awsAccessKeyId,
      awsRegion: body.awsRegion,
      gcpProjectId: body.gcpProjectId,
      freeeClientId: body.freeeClientId,
      freeeCompanyId: body.freeeCompanyId,
      analysisPrompt: body.analysisPrompt,
      fiscalYearEndMonth: body.fiscalYearEndMonth || 12,
      taxBusinessType: body.taxBusinessType || 'general',
    }

    for (const field of ENCRYPTED_FIELDS) {
      const value = body[field]
      if (value && typeof value === 'string' && value.length > 0) {
        data[field] = encrypt(value)
      } else {
        data[field] = null
      }
    }

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    })

    return NextResponse.json({ success: true, settings: { id: settings.id } })
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
