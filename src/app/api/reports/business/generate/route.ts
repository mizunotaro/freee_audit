import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { section, companyName, fiscalYear } = body

    const templateContent = generateTemplateContent(section, companyName, fiscalYear)

    return NextResponse.json({ content: templateContent })
  } catch (error) {
    console.error('Error generating content:', error)
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 })
  }
}

function generateTemplateContent(section: string, companyName: string, fiscalYear: number): string {
  const templates: Record<string, string> = {
    businessOverview: `${companyName}は、${fiscalYear}年度において[主な事業内容]に注力し、市場での地位を強化いたしました。

【主要製品・サービス】
- 製品・サービスA: [説明]
- 製品・サービスB: [説明]

【市場ポジション】
当社は[業界]において[市場シェアや立ち位置]を占めており、[競合優位性]を有しております。

【顧客基盤】
[顧客セグメント]を中心に、[顧客数]の基盤を構築しております。`,

    businessEnvironment: `【業界動向】
${fiscalYear}年度の[業界]は、[市場動向]の影響を受け、[成長率や市場規模]となりました。

【競合状況】
主要競合他社として[競合企業名]が挙げられ、当社は[差別化要因]により競争優位性を維持しております。

【法規制】
[関連法規制]の変更により、[影響内容]が見込まれます。

【経済情勢】
[マクロ経済要因]が事業に与える影響として、[具体的な影響]がございます。`,

    managementPolicy: `【経営理念】
当社は「[経営理念]」を理念に掲げ、[目的や社会的意義]の実現に向けて事業を展開しております。

【中長期戦略】
- 短期（1-2年）: [施策]
- 中期（3-5年）: [施策]
- 長期（5年以上）: [施策]

【成長目標】
- 売上高目標: [数値]
- 利益目標: [数値]
- その他重要指標: [内容]`,

    issuesAndRisks: `【直面している課題】
1. [課題1]: [詳細と対策]
2. [課題2]: [詳細と対策]
3. [課題3]: [詳細と対策]

【潜在的リスク】
- 市場リスク: [内容と対策]
- 技術リスク: [内容と対策]
- 人材リスク: [内容と対策]
- 財務リスク: [内容と対策]

【BCP（事業継続計画）】
[災害や緊急時の対応計画]`,

    financialHighlights: `【業績ハイライト】（${fiscalYear}年度）

売上高: [金額]（前年比[増減率]%）
営業利益: [金額]（前年比[増減率]%）
経常利益: [金額]（前年比[増減率]%）
当期純利益: [金額]（前年比[増減率]%）

【キャッシュフロー】
営業CF: [金額]
投資CF: [金額]
財務CF: [金額]

【主要財務指標】
自己資本比率: [%]
流動比率: [%]
ROE: [%]
ROA: [%]`,

    researchAndDevelopment: `【R&D投資】
${fiscalYear}年度の研究開発費は[金額]（売上高比[%]）であり、前年度比[増減率]%となりました。

【主要開発プロジェクト】
1. [プロジェクト名]: [概要と進捗]
2. [プロジェクト名]: [概要と進捗]

【技術的優位性】
[独自技術や特許]を有し、[競合に対する優位性]を確立しております。

【知的財産戦略】
特許出願件数: [件数]
商標登録件数: [件数]`,

    corporateGovernance: `【組織体制】
- 取締役会: [構成と役割]
- 監査役会: [構成と役割]
- 社外取締役: [有無と人数]

【内部統制】
内部統制システムとして、[内容]を整備・運用しております。

【リスク管理体制】
リスク管理委員会を設置し、[内容]を実施しております。

【コンプライアンス】
[コンプライアンス体制や取り組み]

【情報開示】
[開示方針やIR活動]`,
  }

  return templates[section] || '[内容を入力してください]'
}
