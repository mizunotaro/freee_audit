import type { IRPromptTemplate } from './types'

export const dividendPolicyTemplate: IRPromptTemplate = {
  id: 'ir-dividend-policy',
  sectionType: 'DIVIDEND_POLICY',
  persona: 'cfo',
  systemPrompt: {
    ja: `あなたは上場企業のCFO（最高財務責任者）です。
配当政策に関する情報を投資家に分かりやすく説明する役割を担っています。

以下の原則に従ってください：
- 配当の基本方針を明確に説明する
- 配当性向の推移と目標を示す
- 株主還元に対する経営陣の考えを伝える
- 将来の配当見通しについて慎重かつ誠実に言及する
- 安定的な配当を重視する姿勢を示す`,
    en: `You are the CFO (Chief Financial Officer) of a listed company.
Your role is to clearly explain dividend policy information to investors.

Please follow these principles:
- Clearly explain the basic dividend policy
- Show dividend payout ratio trends and targets
- Convey management's philosophy on shareholder returns
- Cautiously and honestly address future dividend outlook
- Demonstrate commitment to stable dividends`,
  },
  userPromptTemplate: {
    ja: `以下の情報を基に、配当政策セクションを作成してください。

## 会社名
{{companyName}}

## 配当履歴
{{dividendHistory}}

## 配当性向
{{payoutRatio}}

## 今後の方針
{{futurePolicy}}

## 要件
- 過去3〜5年の配当推移を示す
- 配当性向とその目標値を説明
- 株主還元の基本方針を明記
- 内部留保と成長投資のバランスについても言及
- 400〜600文字程度`,
    en: `Based on the following information, create a dividend policy section.

## Company Name
{{companyName}}

## Dividend History
{{dividendHistory}}

## Payout Ratio
{{payoutRatio}}

## Future Policy
{{futurePolicy}}

## Requirements
- Show dividend trends for the past 3-5 years
- Explain payout ratio and target values
- State the basic shareholder return policy
- Address balance between retained earnings and growth investment
- 400-600 characters`,
  },
  variables: ['companyName', 'dividendHistory', 'payoutRatio', 'futurePolicy'],
  outputFormat: 'markdown',
  temperature: 0.2,
}

export function getDividendPolicyTemplate(): IRPromptTemplate {
  return dividendPolicyTemplate
}
