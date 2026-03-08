# AI分析制約定義

このドキュメントは、AI機能における**LLMプロンプト・入力・出力**に関する制約を定義します。
全てのLLM呼び出しで以下の制約を遵守すること。

---

## 目次

1. [分析の基本原則](#1-分析の基本原則)
2. [出力フォーマット制約](#2-出力フォーマット制約)
3. [ペルソナ別制約](#3-ペルソナ別制約)
4. [入力バリデーション制約](#4-入力バリデーション制約)
5. [出力バリデーション制約](#5-出力バリデーション制約)
6. [プロンプト構造制約](#6-プロンプト構造制約)
7. [エラー応答制約](#7-エラー応答制約)
8. [実装パターン](#8-実装パターン)

---

## 1. 分析の基本原則

### 日本語版

```
## 分析の基本原則（必須遵守事項）

### 1. 中立性
利害関係者に偏らない客観的評価を行う。特定の利害関係者の利益を優先する表現を避ける。

### 2. 根拠明示
全ての判断に数値的・論理的根拠を付記する。「〜と思われる」等の根拠不明な表現を避ける。

### 3. 不確実性の開示
確実でない事項はその旨を明記し、確信度（0-1）を示す。推測と事実を明確に区別する。

### 4. 代替案提示
単一の結論ではなく複数の選択肢を提示する。各選択肢のメリット・デメリットを明示する。

### 5. リスク開示
判断に伴う潜在的リスクを明示する。リスクの発生確率と影響度を評価する。

### 6. 専門用語の定義
専門用語使用時は簡潔な説明を付ける。初出の用語には括弧書きで説明を加える。

### 7. 前提条件の明示
分析の前提となる条件を明記する。前提が変更された場合の影響について言及する。

### 8. データソースの明示
使用したデータの出典を明記する。データの鮮度と信頼性について言及する。
```

### 英語版

```
## Fundamental Analysis Principles (Mandatory Compliance)

### 1. Neutrality
Provide objective evaluation without bias toward any stakeholder. Avoid expressions that prioritize specific interests.

### 2. Evidence-Based
All judgments must include numerical or logical grounds. Avoid unsubstantiated expressions like "it seems."

### 3. Uncertainty Disclosure
Clearly state when matters are uncertain and provide confidence scores (0-1). Distinguish between speculation and facts.

### 4. Alternative Options
Present multiple options rather than single conclusions. Clearly state pros and cons of each option.

### 5. Risk Disclosure
Disclose potential risks associated with judgments. Evaluate probability and impact of risks.

### 6. Technical Terms
Provide brief explanations for technical terms. Include parenthetical explanations for first occurrences.

### 7. Assumptions
State conditions that form the basis of analysis. Discuss impact if assumptions change.

### 8. Data Sources
Cite sources of data used. Comment on data freshness and reliability.
```

### 実装パターン

```typescript
// src/lib/ai/personas/prompts/constraints.ts

export function getConstraints(language: 'ja' | 'en' = 'ja'): string {
  return language === 'ja' ? CONSTRAINTS_JA : CONSTRAINTS_EN
}

export const CONSTRAINTS_JA = `
## 分析の基本原則（必須遵守事項）

### 1. 中立性
利害関係者に偏らない客観的評価を行う。特定の利害関係者の利益を優先する表現を避ける。

### 2. 根拠明示
全ての判断に数値的・論理的根拠を付記する。「〜と思われる」等の根拠不明な表現を避ける。

### 3. 不確実性の開示
確実でない事項はその旨を明記し、確信度（0-1）を示す。推測と事実を明確に区別する。

### 4. 代替案提示
単一の結論ではなく複数の選択肢を提示する。各選択肢のメリット・デメリットを明示する。

### 5. リスク開示
判断に伴う潜在的リスクを明示する。リスクの発生確率と影響度を評価する。

### 6. 専門用語の定義
専門用語使用時は簡潔な説明を付ける。初出の用語には括弧書きで説明を加える。

### 7. 前提条件の明示
分析の前提となる条件を明記する。前提が変更された場合の影響について言及する。

### 8. データソースの明示
使用したデータの出典を明記する。データの鮮度と信頼性について言及する。
` as const

export const CONSTRAINTS_EN = `
## Fundamental Analysis Principles (Mandatory Compliance)

### 1. Neutrality
Provide objective evaluation without bias toward any stakeholder.

### 2. Evidence-Based
All judgments must include numerical or logical grounds.

### 3. Uncertainty Disclosure
Clearly state when matters are uncertain and provide confidence scores (0-1).

### 4. Alternative Options
Present multiple options rather than single conclusions.

### 5. Risk Disclosure
Disclose potential risks associated with judgments.

### 6. Technical Terms
Provide brief explanations for technical terms.

### 7. Assumptions
State conditions that form the basis of analysis.

### 8. Data Sources
Cite sources of data used.
` as const
```

---

## 2. 出力フォーマット制約

### JSON出力フォーマット

```json
{
  "conclusion": "結論（1-2文、200文字以内）",
  "confidence": 0.85,
  "reasoning": [
    {
      "point": "論点",
      "analysis": "分析内容",
      "evidence": "根拠（数値・データ）",
      "confidence": 0.9
    }
  ],
  "alternatives": [
    {
      "option": "選択肢の名称",
      "pros": ["メリット1", "メリット2"],
      "cons": ["デメリット1"],
      "riskLevel": "medium"
    }
  ],
  "risks": [
    {
      "category": "リスクカテゴリ",
      "description": "リスクの説明",
      "severity": "high",
      "probability": 0.3,
      "mitigation": "軽減策"
    }
  ],
  "recommendedAction": "推奨アクション"
}
```

### フィールド制約

| フィールド | 必須 | 型 | 制約 | 説明 |
|-----------|------|-----|------|------|
| conclusion | ✅ | string | 1-200文字 | 分析の結論 |
| confidence | ✅ | number | 0.0-1.0 | 結論の確信度 |
| reasoning | ✅ | array | 1-10要素 | 論拠の配列 |
| reasoning[].point | ✅ | string | 1-200文字 | 論点 |
| reasoning[].analysis | ✅ | string | 1-1000文字 | 分析内容 |
| reasoning[].evidence | ✅ | string | 1-500文字 | 根拠 |
| reasoning[].confidence | ✅ | number | 0.0-1.0 | この論点の確信度 |
| alternatives | 任意 | array | 最大5要素 | 代替案の配列 |
| risks | ✅ | array | 1-10要素 | リスクの配列 |
| risks[].severity | ✅ | enum | low/medium/high/critical | 深刻度 |
| risks[].probability | ✅ | number | 0.0-1.0 | 発生確率 |
| recommendedAction | 任意 | string | 1-1000文字 | 推奨アクション |

---

## 3. ペルソナ別制約

### ペルソナ制約一覧

| ペルソナ | temperature | 禁止表現 | 必須表現 |
|---------|-------------|---------|---------|
| CPA (公認会計士) | 0.1-0.3 | 間違いなく、絶対に | 監査人の視点から |
| Tax Accountant (税理士) | 0.1-0.2 | 絶対に認められる | 税務上の取扱いとして |
| CFO | 0.2-0.4 | 詳細は担当者に確認 | 経営陣の視点から |
| Financial Analyst | 0.2-0.4 | 買い推奨、売り推奨 | 投資判断の材料として |

### 実装パターン

```typescript
// src/lib/ai/personas/prompts/persona-constraints.ts

export interface PersonaConstraints {
  name: string
  nameEn: string
  focus: readonly string[]
  prohibitedExpressions: readonly string[]
  requiredExpressions: readonly string[]
  temperatureRange: {
    readonly min: number
    readonly max: number
    readonly recommended: number
  }
}

export const CPA_CONSTRAINTS: PersonaConstraints = {
  name: '公認会計士',
  nameEn: 'Certified Public Accountant',
  focus: [
    '監査基準に基づく評価',
    'JGAAP/IFRSへの準拠性',
    '開示事項の完全性',
    '重要性の判断',
    '継続企業の前提'
  ],
  prohibitedExpressions: [
    '間違いなく',
    '絶対に',
    '100%確実'
  ],
  requiredExpressions: [
    '監査人の視点から',
    '開示すべき事項として',
    '重要性の観点から'
  ],
  temperatureRange: { min: 0.1, max: 0.3, recommended: 0.2 }
}

export const TAX_ACCOUNTANT_CONSTRAINTS: PersonaConstraints = {
  name: '税理士',
  nameEn: 'Tax Accountant',
  focus: [
    '法人税法への準拠',
    '消費税法への準拠',
    '租税特別措置法の適用',
    '税務リスクの評価',
    '税務調査対応の観点'
  ],
  prohibitedExpressions: [
    '絶対に認められる',
    '脱税の可能性'
  ],
  requiredExpressions: [
    '税務上の取扱いとして',
    '別表の記載について',
    '税務リスクの観点から'
  ],
  temperatureRange: { min: 0.1, max: 0.2, recommended: 0.15 }
}

export const CFO_CONSTRAINTS: PersonaConstraints = {
  name: 'CFO',
  nameEn: 'Chief Financial Officer',
  focus: [
    'キャッシュフロー管理',
    '資金調達戦略',
    '投資判断',
    'リスク管理',
    'ステークホルダーとのコミュニケーション'
  ],
  prohibitedExpressions: [
    '詳細は担当者に確認',
    '技術的な説明は省略'
  ],
  requiredExpressions: [
    '経営陣の視点から',
    '投資家への説明として',
    'キャッシュへの影響'
  ],
  temperatureRange: { min: 0.2, max: 0.4, recommended: 0.3 }
}

export const FINANCIAL_ANALYST_CONSTRAINTS: PersonaConstraints = {
  name: '財務アナリスト',
  nameEn: 'Financial Analyst',
  focus: [
    '企業評価',
    '業界ベンチマーク',
    '投資判断材料の提供',
    'バリュエーション',
    '成長性分析'
  ],
  prohibitedExpressions: [
    '買い推奨',
    '売り推奨',
    '投資アドバイス'
  ],
  requiredExpressions: [
    '投資判断の材料として',
    '業界平均との比較',
    'バリュエーションの観点から'
  ],
  temperatureRange: { min: 0.2, max: 0.4, recommended: 0.3 }
}

export const PERSONA_CONSTRAINTS_MAP: Record<string, PersonaConstraints> = {
  cpa: CPA_CONSTRAINTS,
  tax_accountant: TAX_ACCOUNTANT_CONSTRAINTS,
  cfo: CFO_CONSTRAINTS,
  financial_analyst: FINANCIAL_ANALYST_CONSTRAINTS
}
```

---

## 4. 入力バリデーション制約

### 文字列入力

| 項目 | 制約 | 理由 |
|------|------|------|
| 最大長 | 100,000文字 | DoS防止 |
| 制御文字 | 除去 | インジェクション防止 |
| 空白のみ | 無効 | 意味のある入力必須 |
| Unicode正規化 | NFC | 一貫した処理 |

### 数値入力

| 項目 | 制約 | 理由 |
|------|------|------|
| 金額 | -999,999,999,999 〜 999,999,999,999 | 実務的範囲 |
| 比率 | -9999.99 〜 9999.99 | パーセント表示対応 |
| 日付 | 1900-01-01 〜 2100-12-31 | 妥当な範囲 |
| 精度 | 小数点以下2桁 | 金額計算 |

### JSON入力

| 項目 | 制約 | 理由 |
|------|------|------|
| ネスト深度 | 最大10 | スタックオーバーフロー防止 |
| キー数 | 最大1000 | メモリ保護 |
| 文字列長 | 最大100,000 | DoS防止 |
| 配列長 | 最大10,000 | メモリ保護 |

### 実装パターン

```typescript
// src/lib/ai/validation/input-validator.ts

export interface ValidationConstraints {
  maxStringLength: number
  maxArrayLength: number
  maxObjectDepth: number
  maxObjectKeys: number
  prohibitedKeys: readonly string[]
}

export const DEFAULT_CONSTRAINTS: ValidationConstraints = {
  maxStringLength: 100000,
  maxArrayLength: 10000,
  maxObjectDepth: 10,
  maxObjectKeys: 1000,
  prohibitedKeys: ['__proto__', 'constructor', 'prototype']
}

export type ValidationResult = 
  | { success: true; data: unknown }
  | { success: false; error: ValidationError }

export interface ValidationError {
  code: string
  message: string
  path?: string
}

export function validateString(
  input: unknown,
  maxLength: number = DEFAULT_CONSTRAINTS.maxStringLength
): ValidationResult {
  if (typeof input !== 'string') {
    return { success: false, error: { code: 'INVALID_TYPE', message: 'Expected string' } }
  }
  
  if (input.length > maxLength) {
    return { 
      success: false, 
      error: { 
        code: 'STRING_TOO_LONG', 
        message: `String exceeds max length: ${input.length} > ${maxLength}` 
      } 
    }
  }
  
  const sanitized = input
    .normalize('NFC')
    .replace(/[\x00-\x1F\x7F]/g, '')
  
  if (sanitized.trim().length === 0) {
    return { success: false, error: { code: 'EMPTY_STRING', message: 'String is empty or whitespace only' } }
  }
  
  return { success: true, data: sanitized }
}

export function validateNumber(
  input: unknown,
  min?: number,
  max?: number,
  precision: number = 2
): ValidationResult {
  if (typeof input !== 'number' || isNaN(input)) {
    return { success: false, error: { code: 'INVALID_NUMBER', message: 'Expected valid number' } }
  }
  
  if (min !== undefined && input < min) {
    return { success: false, error: { code: 'NUMBER_TOO_SMALL', message: `Number ${input} < ${min}` } }
  }
  
  if (max !== undefined && input > max) {
    return { success: false, error: { code: 'NUMBER_TOO_LARGE', message: `Number ${input} > ${max}` } }
  }
  
  const rounded = Math.round(input * Math.pow(10, precision)) / Math.pow(10, precision)
  return { success: true, data: rounded }
}

export function validateDate(
  input: unknown,
  minDate?: Date,
  maxDate?: Date
): ValidationResult {
  if (typeof input !== 'string' && !(input instanceof Date)) {
    return { success: false, error: { code: 'INVALID_DATE', message: 'Expected date string or Date object' } }
  }
  
  const date = new Date(input)
  if (isNaN(date.getTime())) {
    return { success: false, error: { code: 'INVALID_DATE_FORMAT', message: 'Invalid date format' } }
  }
  
  const min = minDate || new Date('1900-01-01')
  const max = maxDate || new Date('2100-12-31')
  
  if (date < min || date > max) {
    return { 
      success: false, 
      error: { 
        code: 'DATE_OUT_OF_RANGE', 
        message: `Date ${date.toISOString()} out of range` 
      } 
    }
  }
  
  return { success: true, data: date.toISOString().split('T')[0] }
}

export function validateJsonObject(
  input: unknown,
  constraints: ValidationConstraints = DEFAULT_CONSTRAINTS,
  depth: number = 0
): ValidationResult {
  if (depth > constraints.maxObjectDepth) {
    return { 
      success: false, 
      error: { code: 'MAX_DEPTH_EXCEEDED', message: `Object depth ${depth} > ${constraints.maxObjectDepth}` } 
    }
  }
  
  if (typeof input !== 'object' || input === null) {
    return { success: false, error: { code: 'INVALID_OBJECT', message: 'Expected object' } }
  }
  
  const keys = Object.keys(input)
  if (keys.length > constraints.maxObjectKeys) {
    return { 
      success: false, 
      error: { code: 'TOO_MANY_KEYS', message: `Object has ${keys.length} keys, max ${constraints.maxObjectKeys}` } 
    }
  }
  
  for (const key of keys) {
    if (constraints.prohibitedKeys.includes(key)) {
      return { 
        success: false, 
        error: { code: 'PROHIBITED_KEY', message: `Prohibited key: ${key}` } 
      }
    }
  }
  
  return { success: true, data: input }
}
```

---

## 5. 出力バリデーション制約

### 実装パターン

```typescript
// src/lib/ai/validation/output-validator.ts

import { z } from 'zod'

export const ReasoningItemSchema = z.object({
  point: z.string().min(1).max(200),
  analysis: z.string().min(1).max(1000),
  evidence: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1)
})

export const AlternativeOptionSchema = z.object({
  option: z.string().min(1).max(200),
  pros: z.array(z.string().max(200)).max(5),
  cons: z.array(z.string().max(200)).max(5),
  riskLevel: z.enum(['low', 'medium', 'high'])
})

export const RiskItemSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  probability: z.number().min(0).max(1),
  mitigation: z.string().max(500).optional()
})

export const PersonaResponseSchema = z.object({
  conclusion: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(ReasoningItemSchema).min(1).max(10),
  alternatives: z.array(AlternativeOptionSchema).max(5).optional(),
  risks: z.array(RiskItemSchema).min(1).max(10),
  recommendedAction: z.string().max(1000).optional()
})

export type PersonaResponse = z.infer<typeof PersonaResponseSchema>

export function validatePersonaResponse(input: unknown): ValidationResult {
  const result = PersonaResponseSchema.safeParse(input)
  
  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Output validation failed',
        details: result.error.errors
      }
    }
  }
  
  return { success: true, data: result.data }
}

export function sanitizeResponse(input: unknown): PersonaResponse {
  const defaultResponse: PersonaResponse = {
    conclusion: 'Analysis could not be completed',
    confidence: 0.5,
    reasoning: [{
      point: 'Validation Error',
      analysis: 'The response could not be properly validated',
      evidence: 'N/A',
      confidence: 0.5
    }],
    risks: [{
      category: 'General',
      description: 'Unable to complete analysis',
      severity: 'medium',
      probability: 0.5
    }]
  }
  
  if (typeof input !== 'object' || input === null) {
    return defaultResponse
  }
  
  const result = validatePersonaResponse(input)
  if (result.success) {
    return result.data as PersonaResponse
  }
  
  const obj = input as Record<string, unknown>
  
  return {
    conclusion: typeof obj.conclusion === 'string' 
      ? obj.conclusion.slice(0, 200) 
      : defaultResponse.conclusion,
    confidence: typeof obj.confidence === 'number' 
      ? Math.max(0, Math.min(1, obj.confidence)) 
      : defaultResponse.confidence,
    reasoning: Array.isArray(obj.reasoning) 
      ? obj.reasoning.slice(0, 10).map((r: unknown) => ({
          point: typeof r === 'object' && r !== null && 'point' in r ? String(r.point).slice(0, 200) : 'Unknown',
          analysis: typeof r === 'object' && r !== null && 'analysis' in r ? String(r.analysis).slice(0, 1000) : 'N/A',
          evidence: typeof r === 'object' && r !== null && 'evidence' in r ? String(r.evidence).slice(0, 500) : 'N/A',
          confidence: typeof r === 'object' && r !== null && 'confidence' in r ? Math.max(0, Math.min(1, Number(r.confidence))) : 0.5
        }))
      : defaultResponse.reasoning,
    risks: Array.isArray(obj.risks)
      ? obj.risks.slice(0, 10).map((r: unknown) => ({
          category: typeof r === 'object' && r !== null && 'category' in r ? String(r.category).slice(0, 100) : 'General',
          description: typeof r === 'object' && r !== null && 'description' in r ? String(r.description).slice(0, 500) : 'N/A',
          severity: ['low', 'medium', 'high', 'critical'].includes(String((r as { severity?: string })?.severity)) 
            ? (r as { severity: 'low' | 'medium' | 'high' | 'critical' }).severity 
            : 'medium',
          probability: typeof r === 'object' && r !== null && 'probability' in r ? Math.max(0, Math.min(1, Number(r.probability))) : 0.5,
          mitigation: typeof r === 'object' && r !== null && 'mitigation' in r ? String(r.mitigation).slice(0, 500) : undefined
        }))
      : defaultResponse.risks,
    alternatives: undefined,
    recommendedAction: typeof obj.recommendedAction === 'string' 
      ? obj.recommendedAction.slice(0, 1000) 
      : undefined
  }
}
```

---

## 6. プロンプト構造制約

### システムプロンプト構成

```
1. ペルソナ定義（誰であるか）
2. 専門分野（何を専門とするか）
3. 基本原則（どう振る舞うか）
4. 出力フォーマット（どう回答するか）
5. 禁止事項（何を避けるか）
```

### ユーザープロンプト構成

```
1. コンテキスト（背景情報）
2. 入力データ（分析対象）
3. 質問/指示（何を求めるか）
4. 制約条件（制限事項）
```

### トークン制約

| コンポーネント | 最大トークン | 目標トークン |
|---------------|-------------|-------------|
| システムプロンプト | 2,000 | 1,000 |
| コンテキスト | 50,000 | 可変 |
| ユーザー入力 | 10,000 | 可変 |
| 出力 | 4,000 | 2,000 |

---

## 7. エラー応答制約

### エラーコード一覧

| コード | HTTP Status | 説明 | ユーザー向けメッセージ |
|--------|-------------|------|----------------------|
| INVALID_INPUT | 400 | 入力データが無効 | 入力データを確認してください |
| TOKEN_LIMIT_EXCEEDED | 400 | トークン制限超過 | データを絞り込んでください |
| UNAUTHORIZED | 401 | 認証エラー | ログインしてください |
| FORBIDDEN | 403 | 権限不足 | アクセス権限がありません |
| NOT_FOUND | 404 | リソース不明 | データが見つかりません |
| MODEL_UNAVAILABLE | 503 | モデルが利用不可 | しばらく待ってから再試行してください |
| ANALYSIS_FAILED | 500 | 分析処理失敗 | エラーが発生しました。再試行してください |
| TIMEOUT | 504 | タイムアウト | 処理がタイムアウトしました |

### 実装パターン

```typescript
// src/lib/ai/errors/index.ts

export interface AIError {
  code: string
  message: string
  details?: unknown
  recoverable: boolean
  retryAfter?: number
}

export const ERROR_CODES = {
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    message: '入力データが無効です',
    recoverable: false
  },
  TOKEN_LIMIT_EXCEEDED: {
    code: 'TOKEN_LIMIT_EXCEEDED',
    message: 'トークン制限を超過しました',
    recoverable: true
  },
  MODEL_UNAVAILABLE: {
    code: 'MODEL_UNAVAILABLE',
    message: 'モデルが一時的に利用できません',
    recoverable: true,
    retryAfter: 5000
  },
  ANALYSIS_FAILED: {
    code: 'ANALYSIS_FAILED',
    message: '分析処理に失敗しました',
    recoverable: true
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    message: '処理がタイムアウトしました',
    recoverable: true
  }
} as const

export function createError(code: keyof typeof ERROR_CODES, details?: unknown): AIError {
  const baseError = ERROR_CODES[code]
  return {
    ...baseError,
    details
  }
}
```

---

## 8. 実装パターン

### ファイル構成

```
src/lib/ai/
├── personas/
│   └── prompts/
│       ├── constraints.ts           # 基本原則
│       ├── output-formats.ts        # 出力フォーマット
│       ├── persona-constraints.ts   # ペルソナ別制約
│       └── templates/
│           ├── base.ts
│           └── personas/
├── validation/
│   ├── input-validator.ts           # 入力バリデーション
│   ├── output-validator.ts          # 出力バリデーション
│   └── schemas.ts                   # Zodスキーマ
└── errors/
    └── index.ts                     # エラー定義
```

### 使用例

```typescript
import { validateString, validateJsonObject } from '@/lib/ai/validation/input-validator'
import { validatePersonaResponse, sanitizeResponse } from '@/lib/ai/validation/output-validator'
import { getConstraints } from '@/lib/ai/personas/prompts/constraints'
import { CPA_CONSTRAINTS } from '@/lib/ai/personas/prompts/persona-constraints'

async function analyzeWithCPA(input: unknown): Promise<Result<PersonaResponse, AIError>> {
  // 1. 入力バリデーション
  const inputValidation = validateJsonObject(input)
  if (!inputValidation.success) {
    return { success: false, error: createError('INVALID_INPUT', inputValidation.error) }
  }
  
  // 2. プロンプト構築
  const constraints = getConstraints('ja')
  const personaConstraints = CPA_CONSTRAINTS
  const temperature = personaConstraints.temperatureRange.recommended
  
  // 3. LLM呼び出し
  const response = await callLLM({
    systemPrompt: buildSystemPrompt(constraints, personaConstraints),
    userPrompt: buildUserPrompt(inputValidation.data),
    temperature
  })
  
  // 4. 出力バリデーション
  const outputValidation = validatePersonaResponse(response)
  if (!outputValidation.success) {
    // サニタイズして返す
    return { success: true, data: sanitizeResponse(response) }
  }
  
  return { success: true, data: outputValidation.data }
}
```

---

## 参照

- [品質基準チェックリスト](./QUALITY_STANDARDS.md) - 10品質基準の詳細
- [タスク分割](./TASKS.md) - 実装タスクの詳細
- [AI機能概要](./README.md) - アーキテクチャ・コンポーネント
