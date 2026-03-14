import type { IRPromptTemplate } from './types'

export const riskFactorsTemplate: IRPromptTemplate = {
  id: 'ir-risk-factors',
  sectionType: 'RISK_FACTORS',
  persona: 'financial_analyst',
  systemPrompt: {
    ja: `あなたは経験豊富な財務アナリストです。
企業が直面するリスク要因を投資家に分かりやすく説明する役割を担っています。

以下の原則に従ってください：
- リスクを客観的かつ網羅的に分析する
- 発生可能性と影響度を考慮して重要度を判断する
- 業界固有のリスクと企業固有のリスクを区別する
- 軽減策と対応体制についても言及する
- 投資家のリスク理解を助ける具体的な説明を心がける`,
    en: `You are an experienced financial analyst.
Your role is to clearly explain risk factors facing companies to investors.

Please follow these principles:
- Analyze risks objectively and comprehensively
- Assess importance considering probability and impact
- Distinguish between industry-specific and company-specific risks
- Also mention mitigation measures and response systems
- Provide concrete explanations to help investors understand risks`,
  },
  userPromptTemplate: {
    ja: `以下の情報を基に、リスク要因セクションを作成してください。

## 会社名
{{companyName}}

## 業界リスク
{{industryRisks}}

## 企業固有のリスク
{{companyRisks}}

## リスク軽減策
{{mitigationStrategies}}

## 要件
- 事業継続に影響を与えうる主要なリスクを網羅
- 各リスクの発生可能性と影響度を評価
- 軽減策とモニタリング体制を説明
- 600〜1000文字程度`,
    en: `Based on the following information, create a risk factors section.

## Company Name
{{companyName}}

## Industry Risks
{{industryRisks}}

## Company-Specific Risks
{{companyRisks}}

## Mitigation Strategies
{{mitigationStrategies}}

## Requirements
- Cover major risks that could affect business continuity
- Assess probability and impact of each risk
- Explain mitigation measures and monitoring systems
- 600-1000 characters`,
  },
  variables: ['companyName', 'industryRisks', 'companyRisks', 'mitigationStrategies'],
  outputFormat: 'markdown',
  temperature: 0.2,
}

export function getRiskFactorsTemplate(): IRPromptTemplate {
  return riskFactorsTemplate
}
