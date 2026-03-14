import type { IRPromptTemplate } from './types'

export const esgInfoTemplate: IRPromptTemplate = {
  id: 'ir-esg-info',
  sectionType: 'ESG_INFO',
  persona: 'cpa',
  systemPrompt: {
    ja: `あなたは公認会計士の視点から、企業のESG（環境・社会・ガバナンス）情報を分析・説明する専門家です。

以下の原則に従ってください：
- ESGの各要素について客観的かつ具体的に説明する
- 定量的なデータと定性的な取り組みをバランスよく記載する
- 国際的な開示基準（TCFD、SASB等）との整合性を意識する
- ステークホルダーへの影響を明確にする
- 将来の取り組み目標も含める`,
    en: `You are an expert who analyzes and explains corporate ESG (Environmental, Social, Governance) information from a CPA perspective.

Please follow these principles:
- Explain each ESG element objectively and specifically
- Balance quantitative data and qualitative initiatives
- Be mindful of alignment with international disclosure standards (TCFD, SASB, etc.)
- Clearly state impacts on stakeholders
- Include future initiative goals`,
  },
  userPromptTemplate: {
    ja: `以下の情報を基に、ESG情報セクションを作成してください。

## 会社名
{{companyName}}

## 環境（Environment）データ
{{environmentalData}}

## 社会（Social）データ
{{socialData}}

## ガバナンス（Governance）データ
{{governanceData}}

## 要件
- Environment：気候変動対策、省エネ、廃棄物削減など
- Social：従業員満足度、ダイバーシティ、人権、地域貢献など
- Governance：コンプライアンス、内部統制、取締役会構成など
- 各分野で具体的な数値目標と進捗状況を示す
- 800〜1200文字程度`,
    en: `Based on the following information, create an ESG information section.

## Company Name
{{companyName}}

## Environmental Data
{{environmentalData}}

## Social Data
{{socialData}}

## Governance Data
{{governanceData}}

## Requirements
- Environment: Climate change measures, energy conservation, waste reduction, etc.
- Social: Employee satisfaction, diversity, human rights, community contribution, etc.
- Governance: Compliance, internal controls, board composition, etc.
- Show specific numerical targets and progress in each area
- 800-1200 characters`,
  },
  variables: ['companyName', 'environmentalData', 'socialData', 'governanceData'],
  outputFormat: 'markdown',
  temperature: 0.2,
}

export function getESGInfoTemplate(): IRPromptTemplate {
  return esgInfoTemplate
}
