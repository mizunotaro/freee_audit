import type { GenerationContext } from '@/types/reports/business'

export type BusinessReportSectionType =
  | 'companyStatus.businessDescription'
  | 'companyStatus.businessPerformance'
  | 'companyStatus.productionOrders'
  | 'companyStatus.financialSummary'
  | 'companyStatus.riskManagement'
  | 'shares.totalShares'
  | 'shares.shareholdingStructure'
  | 'shares.majorShareholders'
  | 'stockOptions.stockAcquisitionRights'
  | 'officers.directors'
  | 'officers.auditors'
  | 'officers.compensation'
  | 'officers.boardMeetings'
  | 'auditor.info'
  | 'auditor.opinion'
  | 'internalControl.basicPolicy'
  | 'internalControl.organizationalStructure'
  | 'internalControl.compliance'
  | 'controlPolicy.policy'
  | 'subsidiary.info'
  | 'relatedPartyTransactions.info'
  | 'importantMatters.subsequentEvents'
  | 'importantMatters.litigation'

interface PromptTemplate {
  systemPrompt: string
  userPromptTemplate: string
  requiredFields: string[]
}

const BASE_SYSTEM_PROMPT = `あなたは日本の公認会計士であり、会社法施行規則及び会社計算規則に基づく事業報告書の作成に精通した専門家です。
経団連ひな型（2022年11月改訂版）に準拠した記載を行ってください。

【記載の基本原則】
1. 客観的かつ中立的な表現を使用すること
2. 事実に基づいた記載を心がけること
3. 法令用語を適切に使用すること
4. 数字は3桁区切りで表記すること
5. 重要な事項は優先的に記載すること`

export const KEIDANREN_PROMPT_TEMPLATES: Record<BusinessReportSectionType, PromptTemplate> = {
  'companyStatus.businessDescription': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「1. 株式会社の現況に関する事項」のうち「事業の内容」を記載してください。

【記載要件】
- 主たる事業の内容を具体的に記載
- セグメント別の事業内容がある場合は併記
- 最近の重要な変更事項があれば記載

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【財務データ】
{{financialDataSummary}}

【記載例（経団連ひな型より）】
当社は、〇〇事業を主たる事業とし、〇〇の製造・販売を営んでおります。なお、当社の事業は、報告セグメントである〇〇事業、△△事業及び××事業により構成されております。`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'companyStatus.businessPerformance': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「1. 株式会社の現況に関する事項」のうち「業績の概況」を記載してください。

【記載要件】
- 当期及び前期の2期間比較
- 売上高、営業利益、経常利益、当期純利益の推移
- 増減率及び主な変動要因
- セグメント別の業績（あれば）

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【財務データ】
{{financialDataSummary}}

【主要財務指標】
{{calculatedMetrics}}

【記載形式】
（{{fiscalYear}}年度の業績）
当社の{{fiscalYear}}年度における売上高は〇〇百万円（前期比△△％増／減）、営業利益は〇〇百万円（同△△％増／減）、経常利益は〇〇百万円（同△△％増／減）、当期純利益は〇〇百万円（同△△％増／減）となりました。

（業績変動の主な要因）
...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'companyStatus.productionOrders': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「1. 株式会社の現況に関する事項」のうち「生産・受注の状況」を記載してください。

【記載要件】
- 製造業等の場合は生産数量、受注状況を記載
- 設備稼働率（あれば）
- 受注残高の推移

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（生産の状況）
当社の{{fiscalYear}}年度における主要製品の生産実績は以下のとおりです。
...

（受注の状況）
...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'companyStatus.financialSummary': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「1. 株式会社の現況に関する事項」のうち「財務諸表の要約」を記載してください。

【記載要件】
- 貸借対照表の要約
- 損益計算書の要約
- キャッシュフロー計算書の要約
- 主要財務指標

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【財務データ】
{{financialDataSummary}}

【記載形式】
（貸借対照表の要約）
{{fiscalYear}}年度末における資産合計は〇〇百万円、負債合計は〇〇百万円、純資産合計は〇〇百万円となりました。

（損益計算書の要約）
...

（キャッシュフローの状況）
...`,
    requiredFields: ['companyName', 'fiscalYear', 'financialDataSummary'],
  },

  'companyStatus.riskManagement': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「1. 株式会社の現況に関する事項」のうち「リスク管理体制」を記載してください。

【記載要件】
- リスク管理体制の概要
- 主要なリスクとその対応
- 事業継続計画（BCP）の状況

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（リスク管理体制）
当社は、経営環境の変化に伴い生じうる各種リスクを適切に管理・対応するため、リスク管理規程を策定し、...

（主要なリスク）
1. 市場リスク
...
2. 技術リスク
...

（事業継続計画）
...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'shares.totalShares': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「2. 株式に関する事項」のうち「発行済株式総数」を記載してください。

【記載要件】
- 授権株式数
- 発行済株式総数
- 自己株式数
- 流通株式数

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【株主データ】
{{shareholderData}}

【記載形式】
（発行済株式総数）
当社の{{fiscalYear}}年度末における発行済株式総数は〇〇株であり、その内訳は以下のとおりです。
- 授権株式数: 〇〇株
- 発行済株式総数: 〇〇株
- 自己株式数: 〇〇株
- 流通株式数: 〇〇株`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'shares.shareholdingStructure': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「2. 株式に関する事項」のうち「株式の状況」を記載してください。

【記載要件】
- 株主別（金融機関、事業法人、個人、外国法人等）の内訳
- 株主数及び持株数
- 持株集中度

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【株主データ】
{{shareholderData}}

【記載形式】
（株式の状況）
{{fiscalYear}}年度末における株式の状況は以下のとおりです。

| 区分 | 株主数 | 持株数 | 比率 |
|------|--------|--------|------|
| 金融機関 | 〇〇 | 〇〇株 | △△% |
| ... | ... | ... | ... |`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'shares.majorShareholders': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「2. 株式に関する事項」のうち「大株主の状況」を記載してください。

【記載要件】
- 上位10名以内の大株主
- 氏名又は名称、住所
- 持株数及び発行済株式総数に対する割合

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【株主データ】
{{shareholderData}}

【記載形式】
（大株主の状況）
{{fiscalYear}}年度末における大株主の状況は以下のとおりです。

| 順位 | 氏名又は名称 | 住所 | 持株数 | 比率 |
|------|-------------|------|--------|------|
| 1 | 〇〇株式会社 | 東京都... | 〇〇株 | △△% |
| ... | ... | ... | ... | ... |`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'stockOptions.stockAcquisitionRights': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「3. 新株予約権等に関する事項」を記載してください。

【記載要件】
- 新株予約権の発行状況
- 付与対象者、目的、内容
- 行使状況

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（新株予約権の状況）
当社は、役員及び従業員のインセンティブ向上を目的として、エネルギー株式報酬型ストック・オプションとして新株予約権を発行しております。

1. 〇年〇月〇日発行の新株予約権
- 付与対象者: ...
- 目的: ...
- 内容: ...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'officers.directors': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「4. 会社役員に関する事項」のうち「取締役」を記載してください。

【記載要件】
- 取締役の氏名、生年月日、略歴
- 任期
- 社外取締役であるか否か

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【役員データ】
{{officerData}}

【記載形式】
（取締役）
| 氏名 | 生年月日 | 略歴 | 任期 | 社外 |
|------|----------|------|------|------|
| 〇〇 〇〇 | 〇年〇月〇日 | ... | 〇年 | 否 |`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'officers.auditors': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「4. 会社役員に関する事項」のうち「監査役」を記載してください。

【記載要件】
- 監査役の氏名、生年月日、略歴
- 任期
- 常勤・非常勤の別
- 社外監査役であるか否か

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【役員データ】
{{officerData}}

【記載形式】
（監査役）
| 氏名 | 生年月日 | 略歴 | 任期 | 常勤・非常勤 | 社外 |
|------|----------|------|------|-------------|------|
| 〇〇 〇〇 | 〇年〇月〇日 | ... | 〇年 | 常勤 | 否 |`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'officers.compensation': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「4. 会社役員に関する事項」のうち「役員報酬」を記載してください。

【記載要件】
- 取締役・監査役別の報酬等の総額
- 報酬等の種類別内訳（基本報酬、賞与、株式報酬等）
- 人数
- 報酬等の決定方針

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（役員報酬等）
1. 取締役
   - 報酬等の総額: 〇〇百万円
   - 種類別内訳: 基本報酬 〇〇百万円、賞与 〇〇百万円
   - 人数: 〇名

2. 監査役
   ...

（報酬等の決定方針）
当社の役員報酬等は、...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'officers.boardMeetings': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「4. 会社役員に関する事項」のうち「取締役会の状況」を記載してください。

【記載要件】
- 当事業年度における取締役会開催回数
- 各取締役・監査役の出席状況

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【取締役会データ】
{{boardMeetingData}}

【記載形式】
（取締役会の状況）
当事業年度における取締役会は〇〇回開催いたしました。各取締役及び監査役の出席状況は以下のとおりです。

| 氏名 | 開催回数 | 出席回数 | 出席率 |
|------|----------|----------|--------|
| 〇〇 〇〇 | 〇〇回 | 〇〇回 | △△% |`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'auditor.info': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「5. 会計監査人に関する事項」を記載してください。

【記載要件】
- 会計監査人の氏名又は名称
- 契約期間
- 監査報酬

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（会計監査人）
1. 氏名又は名称: 〇〇監査法人
2. 契約期間: 〇年〇月〇日から〇年〇月〇日まで
3. 監査報酬: 〇〇百万円（監査証明業務 〇〇百万円、その他業務 〇〇百万円）`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'auditor.opinion': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「5. 会計監査人に関する事項」のうち「監査意見」を記載してください。

【記載要件】
- 監査意見の種類（適正意見、除外事項付適正意見等）
- 監査報告書の作成日

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（監査意見の概要）
当社の{{fiscalYear}}年度の財務諸表について、〇〇監査法人は、〇年〇月〇日付の監査報告書において、適正意見を表明いたしました。`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'internalControl.basicPolicy': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「6. 業務の適正を確保するための体制等」を記載してください。

【記載要件】
- 内部統制システムの基本方針
- 取締役会による決議内容
- 各体制の概要

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（業務の適正を確保するための体制）
当社は、会社法第362条第4項第6号の規定に基づき、業務の適正を確保するために必要な体制として以下のとおり決定しております。

1. 役員及び従業員の職務の執行が法令及び定款に従うことを確保するための体制
...

2. 財務報告の信頼性を確保するための体制
...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'internalControl.organizationalStructure': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「6. 業務の適正を確保するための体制等」のうち「組織体制」を記載してください。

【記載要件】
- 取締役会の構成・役割
- 監査体制
- 指名委員会・報酬委員会等（あれば）

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（組織体制）
1. 取締役会
当社の取締役会は、取締役〇名（うち社外取締役〇名）で構成されており、...

2. 監査体制
当社は監査役会設置会社であり、監査役〇名（うち常勤監査役〇名、社外監査役〇名）で...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'internalControl.compliance': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「6. 業務の適正を確保するための体制等」のうち「コンプライアンス」を記載してください。

【記載要件】
- コンプライアンス方針
- コンプライアンス教育・研修
- 内部通報制度

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（コンプライアンス）
1. コンプライアンス方針
当社は、コンプライアンスを経営の最重要課題と位置づけ、...

2. コンプライアンス教育・研修
...

3. 内部通報制度
...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'controlPolicy.policy': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「7. 株式会社の支配に関する基本方針」を記載してください。

【記載要件】
- 支配基本方針の有無及び内容
- 買収防衛策の有無及び内容（あれば）
- 資本政策の基本方針

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（支配基本方針）
当社は、株主共同の利益を確保し、企業価値の向上を図るため、支配基本方針を策定しております／策定しておりません。

（買収防衛策）
当社は、買収防衛策を導入しております／おりません。
...

（資本政策の基本方針）
...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'subsidiary.info': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「8. 特定完全子会社に関する事項」を記載してください。

【記載要件】
- 特定完全子会社に該当するか否か
- 親会社がある場合はその氏名又は名称及び住所

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（特定完全子会社に関する事項）
当社は、特定完全子会社に該当し／該当せず、...

（親会社の状況）
親会社: 〇〇株式会社
住所: 〇〇県〇〇市...
関係: ...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'relatedPartyTransactions.info': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「9. 親会社等との間の取引」を記載してください。

【記載要件】
- 親会社等との間の取引の有無
- 取引がある場合はその内容及び金額

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【関連当事者データ】
{{relatedPartyData}}

【記載形式】
（親会社等との間の取引）
当社と親会社等との間における当事業年度の主な取引は以下のとおりです。

| 相手先 | 関係 | 取引内容 | 取引金額 |
|--------|------|----------|----------|
| 〇〇株式会社 | 親会社 | 営業取引 | 〇〇百万円 |`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'importantMatters.subsequentEvents': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「10. 株式会社の状況に関する重要な事項」のうち「後発事象」を記載してください。

【記載要件】
- 決算日後に発生した重要な事象
- 財務諸表に与える影響

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度
決算日: {{fiscalYear}}年12月期（例）

【記載形式】
（後発事象）
当事業年度の決算日（〇年〇月〇日）以降、決算日現在存在しなかった重要な事象は以下のとおりです。

1. 〇年〇月〇日
...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },

  'importantMatters.litigation': {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPromptTemplate: `以下の情報に基づき、「10. 株式会社の状況に関する重要な事項」のうち「訴訟等」を記載してください。

【記載要件】
- 未解決の訴訟等の有無
- 訴訟等の内容及び対応状況

【会社情報】
会社名: {{companyName}}
事業年度: {{fiscalYear}}年度

【記載形式】
（訴訟等）
当社に係る重要な未解決の訴訟等はありません／以下のとおりです。

1. 事件名: 〇〇訴訟
   提訴日: 〇年〇月〇日
   原告・被告: ...
   請求金額: 〇〇百万円
   現在の状況: ...`,
    requiredFields: ['companyName', 'fiscalYear'],
  },
}

export function buildSectionPrompt(
  sectionType: BusinessReportSectionType,
  context: GenerationContext
): { systemPrompt: string; userPrompt: string } {
  const template = KEIDANREN_PROMPT_TEMPLATES[sectionType]

  if (!template) {
    throw new Error(`Unknown section type: ${sectionType}`)
  }

  let userPrompt = template.userPromptTemplate

  userPrompt = userPrompt.replace(/\{\{companyName\}\}/g, context.companyName)
  userPrompt = userPrompt.replace(/\{\{fiscalYear\}\}/g, String(context.fiscalYear))

  if (context.financialData) {
    const summary = formatFinancialDataSummary(context.financialData)
    userPrompt = userPrompt.replace(/\{\{financialDataSummary\}\}/g, summary)
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
  }
}

function formatFinancialDataSummary(financialData: {
  currentYearTotals: Record<string, number>
  previousYearTotals: Record<string, number>
}): string {
  const lines: string[] = []
  const { currentYearTotals, previousYearTotals } = financialData

  const keyItems = [
    { name: '売上高', alt: '売上高計' },
    { name: '営業利益', alt: null },
    { name: '経常利益', alt: null },
    { name: '当期純利益', alt: null },
    { name: '資産合計', alt: '資産の部合計' },
    { name: '負債合計', alt: '負債の部合計' },
    { name: '純資産合計', alt: '純資産の部合計' },
  ]

  for (const item of keyItems) {
    const current = currentYearTotals[item.name] || currentYearTotals[item.alt || ''] || 0
    const previous = previousYearTotals[item.name] || previousYearTotals[item.alt || ''] || 0
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0

    lines.push(
      `${item.name}: ${formatNumber(current)}円（前期: ${formatNumber(previous)}円、増減率: ${change.toFixed(1)}%）`
    )
  }

  return lines.join('\n')
}

function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}十億`
  } else if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}百万`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}千`
  }
  return num.toLocaleString()
}

export function getSectionTitle(sectionType: BusinessReportSectionType): string {
  const sectionMap: Record<BusinessReportSectionType, string> = {
    'companyStatus.businessDescription': '1-1 事業の内容',
    'companyStatus.businessPerformance': '1-2 業績の概況',
    'companyStatus.productionOrders': '1-3 生産・受注の状況',
    'companyStatus.financialSummary': '1-4 財務諸表の要約',
    'companyStatus.riskManagement': '1-5 リスク管理体制',
    'shares.totalShares': '2-1 発行済株式総数',
    'shares.shareholdingStructure': '2-2 株式の状況',
    'shares.majorShareholders': '2-3 大株主の状況',
    'stockOptions.stockAcquisitionRights': '3-1 新株予約権等',
    'officers.directors': '4-1 取締役',
    'officers.auditors': '4-2 監査役',
    'officers.compensation': '4-3 役員報酬',
    'officers.boardMeetings': '4-4 取締役会の状況',
    'auditor.info': '5-1 会計監査人',
    'auditor.opinion': '5-2 監査意見',
    'internalControl.basicPolicy': '6-1 内部統制システム',
    'internalControl.organizationalStructure': '6-2 組織体制',
    'internalControl.compliance': '6-3 コンプライアンス',
    'controlPolicy.policy': '7-1 支配基本方針',
    'subsidiary.info': '8-1 特定完全子会社',
    'relatedPartyTransactions.info': '9-1 親会社等との取引',
    'importantMatters.subsequentEvents': '10-1 後発事象',
    'importantMatters.litigation': '10-2 訴訟等',
  }

  return sectionMap[sectionType] || sectionType
}
