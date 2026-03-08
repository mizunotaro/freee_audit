export const JSON_OUTPUT_FORMAT = `
## 出力フォーマット（JSON）

必ず以下のJSON形式で回答すること。他のテキストを含めないこと。

\`\`\`json
{
  "conclusion": "結論（1-2文、200文字以内）",
  "confidence": 0.0-1.0,
  "reasoning": [
    {
      "point": "論点",
      "analysis": "分析内容",
      "evidence": "根拠（数値・データ）",
      "confidence": 0.0-1.0
    }
  ],
  "alternatives": [
    {
      "option": "選択肢の名称",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"],
      "riskLevel": "low|medium|high"
    }
  ],
  "risks": [
    {
      "category": "リスクカテゴリ",
      "description": "リスクの説明",
      "severity": "low|medium|high|critical",
      "probability": 0.0-1.0,
      "mitigation": "軽減策（任意）"
    }
  ],
  "recommendedAction": "推奨アクション（任意）"
}
\`\`\`

### フィールド制約
- conclusion: 必須、200文字以内
- confidence: 必須、0.0-1.0の数値
- reasoning: 必須、1-10要素の配列
- alternatives: 任意、最大5要素
- risks: 必須、1-10要素の配列
- recommendedAction: 任意、1000文字以内
` as const

export const OUTPUT_FORMAT_EN = `
## Output Format (JSON)

Always respond in the following JSON format. Do not include other text.

\`\`\`json
{
  "conclusion": "Conclusion (1-2 sentences, max 200 chars)",
  "confidence": 0.0-1.0,
  "reasoning": [
    {
      "point": "Point",
      "analysis": "Analysis",
      "evidence": "Evidence (numbers/data)",
      "confidence": 0.0-1.0
    }
  ],
  "alternatives": [
    {
      "option": "Option name",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1"],
      "riskLevel": "low|medium|high"
    }
  ],
  "risks": [
    {
      "category": "Risk category",
      "description": "Risk description",
      "severity": "low|medium|high|critical",
      "probability": 0.0-1.0,
      "mitigation": "Mitigation (optional)"
    }
  ],
  "recommendedAction": "Recommended action (optional)"
}
\`\`\`

### Field Constraints
- conclusion: Required, max 200 characters
- confidence: Required, 0.0-1.0 numeric value
- reasoning: Required, 1-10 elements array
- alternatives: Optional, max 5 elements
- risks: Required, 1-10 elements array
- recommendedAction: Optional, max 1000 characters
` as const

export function getOutputFormat(language: 'ja' | 'en'): string {
  return language === 'ja' ? JSON_OUTPUT_FORMAT : OUTPUT_FORMAT_EN
}
