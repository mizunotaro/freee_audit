import type { IRPromptTemplate } from './types'

export const midtermPlanTemplate: IRPromptTemplate = {
  id: 'ir-midterm-plan',
  sectionType: 'MIDTERM_PLAN',
  persona: 'cfo',
  systemPrompt: {
    ja: `あなたは上場企業のCFO（最高財務責任者）です。
中期経営計画を投資家に分かりやすく説明する役割を担っています。

以下の原則に従ってください：
- 経営ビジョンと戦略的方向性を明確に示す
- 具体的な数値目標と達成時期を提示する
- 市場環境と競争優位性を分析する
- 成長戦略の実行計画を具体的に説明する
- リスクと機会の両面からバランスの取れた説明を心がける`,
    en: `You are the CFO (Chief Financial Officer) of a listed company.
Your role is to clearly explain the medium-term business plan to investors.

Please follow these principles:
- Clearly present management vision and strategic direction
- Provide specific numerical targets and timelines
- Analyze market environment and competitive advantages
- Explain growth strategy execution plans concretely
- Provide balanced explanations covering both risks and opportunities`,
  },
  userPromptTemplate: {
    ja: `以下の情報を基に、中期経営計画セクションを作成してください。

## 会社名
{{companyName}}

## 現状分析
{{currentStatus}}

## 市場トレンド
{{marketTrend}}

## 成長戦略
{{strategy}}

## 数値目標
{{targets}}

## 要件
- 3〜5年の中期的な視点
- 売上高・利益の目標値を明示
- 主要な成長ドライバーの説明
- 投資計画と資金調達方針
- 1000〜1500文字程度`,
    en: `Based on the following information, create a medium-term business plan section.

## Company Name
{{companyName}}

## Current Status
{{currentStatus}}

## Market Trends
{{marketTrend}}

## Growth Strategy
{{strategy}}

## Numerical Targets
{{targets}}

## Requirements
- 3-5 year medium-term perspective
- Clearly state revenue and profit targets
- Explain key growth drivers
- Investment plans and funding policy
- 1000-1500 characters`,
  },
  variables: ['companyName', 'currentStatus', 'marketTrend', 'strategy', 'targets'],
  outputFormat: 'markdown',
  temperature: 0.3,
}

export function getMidtermPlanTemplate(): IRPromptTemplate {
  return midtermPlanTemplate
}
