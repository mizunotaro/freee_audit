import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { buildSectionPrompt } from '@/lib/prompts/business-report/keidanren-prompts'
import { sanitizeHtml, sanitizePlainText } from '@/lib/utils/html-sanitize'
import type { ReportTemplateType } from '@/types/reports/business'

const TIMEOUT_MS = 60000

export async function POST(request: NextRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const user = await getAuthUser(request)
    if (!user) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { section, companyName, fiscalYear, templateType } = body as {
      section: string
      companyName: string
      fiscalYear: number
      templateType?: ReportTemplateType
    }

    if (!section || !companyName || !fiscalYear) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const safeCompanyName = sanitizePlainText(companyName)

    let result: { content: string; sources: string[]; confidence: number; warnings: string[] }

    if (templateType === 'keidanren') {
      result = await generateKeidanrenSection(
        section,
        safeCompanyName,
        fiscalYear,
        controller.signal
      )
    } else {
      result = generateSimpleSection(section, safeCompanyName, fiscalYear)
    }

    result.content = sanitizeHtml(result.content)

    clearTimeout(timeoutId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error generating content:', error)
    clearTimeout(timeoutId)
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 })
  }
}

async function generateKeidanrenSection(
  section: string,
  companyName: string,
  fiscalYear: number,
  signal: AbortSignal
): Promise<{ content: string; sources: string[]; confidence: number; warnings: string[] }> {
  const context = {
    sectionType: section,
    companyName,
    fiscalYear,
  }

  const { systemPrompt, userPrompt } = buildSectionPrompt(section as any, context)

  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    return {
      content: generateTemplateContent(section, companyName, fiscalYear),
      sources: [],
      confidence: 0.5,
      warnings: ['API key not configured'],
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    return {
      content,
      sources: [section],
      confidence: 0.8,
      warnings: [],
    }
  } catch (error) {
    console.error('AI generation error:', error)
    return {
      content: generateTemplateContent(section, companyName, fiscalYear),
      sources: [],
      confidence: 0.3,
      warnings: ['Fallback to template'],
    }
  }
}

function generateSimpleSection(
  section: string,
  companyName: string,
  fiscalYear: number
): { content: string; sources: string[]; confidence: number; warnings: string[] } {
  const content = generateTemplateContent(section, companyName, fiscalYear)
  return {
    content,
    sources: [],
    confidence: 0.5,
    warnings: [],
  }
}

function generateTemplateContent(section: string, companyName: string, fiscalYear: number): string {
  const templates: Record<string, string> = {
    businessOverview: `${companyName}は、${fiscalYear}年度において[主な事業内容]に注力し、市場での地位を強化いたしました。主要製品・サービスとして[内容]を提供しております。`,

    businessEnvironment: `${fiscalYear}年度の業界動向として、[市場動向]の影響を受けました。競合状況として[内容]が挙げられます。`,

    managementPolicy: `経営理念として「[理念]」を掲げ、中長期戦略として[施策]を進めております。`,

    issuesAndRisks: `直面している課題として[課題]があり、対策として[内容]を実施しております。`,

    financialHighlights: `${fiscalYear}年度の業績: 売上高[金額]、営業利益[金額]、当期純利益[金額]。`,

    researchAndDevelopment: `研究開発費は[金額]（売上高比[%]）で、主要プロジェクトとして[内容]がございます。`,

    corporateGovernance: `組織体制として取締役会、監査役会を設置し、内部統制システムを整備しております。`,

    companyStatus_businessDescription: `${companyName}は、${fiscalYear}年度において[主な事業内容]に注力いたしました。`,

    companyStatus_businessPerformance: `${fiscalYear}年度の業績は、売上高[金額]、営業利益[金額]となりました。`,

    shares_totalShares: `発行済株式総数は[株数]株です。`,

    shares_shareholdingStructure: `金融機関[%]、事業法人[%]、個人[%]等の構成です。`,

    officers_directors: `取締役は[人数]名で構成されております。`,

    officers_auditors: `監査役は[人数]名で構成されております。`,

    internalControl_basicPolicy: `内部統制システムとして、業務適正確保のための体制を整備しております。`,
  }

  return templates[section] || `[${section}の内容を入力してください]`
}
