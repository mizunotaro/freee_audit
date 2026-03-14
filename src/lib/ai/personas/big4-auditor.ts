import { BasePersona } from './base-persona'
import type { PersonaConfig, PersonaBuildContext, CompiledPrompt, PersonaResult } from './types'

const BIG4_AUDITOR_CONFIG: PersonaConfig = {
  type: 'big4_auditor',
  name: 'Big4 Auditor',
  nameJa: 'Big4監査法人パートナー',
  version: '1.0.0',
  systemPrompt: `You are a Senior Partner at a Big4 audit firm with 20+ years of experience in financial statement audits, due diligence, and IPO readiness assessments. You bring the highest standards of audit quality, professional skepticism, and regulatory compliance.

## Professional Background
- Big4 audit partner specializing in IPO and M&A due diligence
- Expert in JGAAP, IFRS, and US GAAP convergence issues
- Deep experience with J-SOX internal control requirements
- Regulatory inspection experience (FSA, PCAOB)
- Industry expertise in manufacturing, technology, and financial services

## Audit Philosophy
- Professional skepticism in all judgments
- Evidence-based conclusions with clear audit trails
- Risk-based approach to materiality and scope
- Independence and objectivity in all assessments
- Focus on financial reporting risks and controls

## DD Expertise Areas
1. Revenue Recognition (ASBJ No.29, IFRS 15, ASC 606)
2. Asset Valuation (inventory, receivables, investments)
3. Allowance Adequacy (bad debts, warranties, restructuring)
4. Related Party Transactions (ASBJ No.11, IAS 24)
5. Tax Positions and Uncertainties (IAS 12)
6. Contingencies and Commitments (ASBJ No.15, IAS 37)
7. Subsequent Events (ASBJ No.24, IAS 10)
8. Internal Control Deficiencies (J-SOX, SOX 404)

## Quality Standards
- PCAB/Quality Management standards compliance
- Documentation standards for audit evidence
- Peer review and inspection readiness
- Independence and ethics compliance`,
  systemPromptJa: `あなたはBig4監査法人のシニアパートナーであり、財務諸表監査、デューデリジェンス、IPO準備評価において20年以上の経験を持っています。監査の品質、プロフェッショナル・スクептиシズム、規制対応の最高基準を提供します。

## 専門的背景
- IPO・M&Aデューデリジェンス専門のBig4監査法人パートナー
- JGAAP、IFRS、US GAAPのコンバージェンス問題の専門家
- J-SOX内部統制要件の深い経験
- 金融庁・PCAOB検査対応経験
- 製造業、テクノロジー、金融サービス業界専門

## 監査哲学
- すべての判断におけるプロフェッショナル・スクプティシズム
- 明確な監査証跡を伴う証拠に基づく結論
- 重要性と範囲のリスクベースアプローチ
- すべての評価における独立性と客観性
- 財務報告リスクと統制への注力

## DD専門領域
1. 収益認識（ASBJ第29号、IFRS 15、ASC 606）
2. 資産評価（棚卸資産、売掛金、投資）
3. 引当金の適正性（貸倒、製品保証、構造改革）
4. 関連当事者取引（ASBJ第11号、IAS 24）
5. 税務ポジションと不確実性（IAS 12）
6. 偶発事象とコミットメント（ASBJ第15号、IAS 37）
7. 後発事象（ASBJ第24号、IAS 10）
8. 内部統制の不備（J-SOX、SOX 404）

## 品質基準
- PCAB/品質管理基準準拠
- 監査証拠の文書化基準
- ピアレビュー・検査対応準備
- 独立性・倫理規定遵守`,
  expertise: [
    'Financial statement audit',
    'IPO due diligence',
    'M&A financial DD',
    'JGAAP/IFRS/US GAAP',
    'J-SOX internal controls',
    'Revenue recognition',
    'Asset valuation',
    'Tax provision review',
    'Related party transactions',
    'Contingent liabilities',
    'Subsequent events',
    'Audit quality management',
  ],
  analysisFocus: [
    {
      category: 'audit_risk',
      weight: 0.3,
      metrics: ['material_misstatement_risk', 'control_risk', 'detection_risk', 'inherent_risk'],
    },
    {
      category: 'compliance',
      weight: 0.25,
      metrics: [
        'gaap_compliance',
        'disclosure_completeness',
        'internal_control_effectiveness',
        'regulatory_requirements',
      ],
    },
    {
      category: 'valuation',
      weight: 0.2,
      metrics: [
        'asset_recoverability',
        'allowance_adequacy',
        'fair_value_measurement',
        'impairment_indicators',
      ],
    },
    {
      category: 'governance',
      weight: 0.15,
      metrics: [
        'related_party_disclosure',
        'governance_structure',
        'audit_committee_oversight',
        'whistleblower_system',
      ],
    },
    {
      category: 'documentation',
      weight: 0.1,
      metrics: [
        'audit_trail_completeness',
        'evidence_quality',
        'working_paper_standards',
        'review_notes_resolution',
      ],
    },
  ],
  outputStyle: 'formal',
  defaultModelComplexity: 'detailed_analysis',
  temperatureRange: {
    min: 0.0,
    max: 0.15,
    recommended: 0.05,
  },
}

export interface DDCheckAnalysis {
  itemCode: string
  category: string
  status: 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'N_A' | 'PENDING'
  findings: DDFindingOutput[]
  evidence: EvidenceOutput[]
  conclusion: string
  riskRating: 'low' | 'medium' | 'high' | 'critical'
  recommendedActions: string[]
  standardsReferenced: string[]
  confidence: number
}

export interface DDFindingOutput {
  id: string
  title: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  impact: string
  recommendation: string
  relatedStandard?: string
}

export interface EvidenceOutput {
  type: 'JOURNAL' | 'DOCUMENT' | 'CALCULATION' | 'EXTERNAL' | 'AI_ANALYSIS'
  reference: string
  summary: string
  reliability: 'high' | 'medium' | 'low'
}

export class Big4AuditorPersona extends BasePersona {
  constructor() {
    super(BIG4_AUDITOR_CONFIG)
  }

  buildPrompt(context: PersonaBuildContext): PersonaResult<CompiledPrompt> {
    if (!context.query || typeof context.query !== 'string') {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Query is required and must be a string',
        },
      }
    }

    try {
      const sanitizedQuery = this.sanitizeString(context.query, 20000)
      const language = context.language || 'ja'

      const systemPrompt =
        language === 'ja' ? BIG4_AUDITOR_CONFIG.systemPromptJa : BIG4_AUDITOR_CONFIG.systemPrompt

      const outputFormat = this.getOutputFormat(language)

      const fullSystemPrompt = `${systemPrompt}

${outputFormat}`

      const userPrompt = sanitizedQuery

      const estimatedTokens = this.estimateTokens(fullSystemPrompt + userPrompt)

      return {
        success: true,
        data: {
          systemPrompt: fullSystemPrompt,
          userPrompt,
          estimatedTokens,
          personaType: this.config.type,
          personaVersion: this.config.version,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'compilation_error',
          message: error instanceof Error ? error.message : 'Unknown compilation error',
        },
      }
    }
  }

  buildDDCheckPrompt(params: {
    itemCode: string
    category: string
    description: string
    aiCheckPrompt: string
    dataContext: string
    fiscalYear: number
    language?: 'ja' | 'en'
  }): PersonaResult<CompiledPrompt> {
    const language = params.language || 'ja'

    const systemPrompt =
      language === 'ja' ? BIG4_AUDITOR_CONFIG.systemPromptJa : BIG4_AUDITOR_CONFIG.systemPrompt

    const outputFormat = this.getOutputFormat(language)

    const userPrompt =
      language === 'ja'
        ? `## DD項目分析依頼

**項目コード**: ${params.itemCode}
**カテゴリ**: ${params.category}
**対象年度**: ${params.fiscalYear}年度

### 項目説明
${params.description}

### 分析要件
${params.aiCheckPrompt}

### データコンテキスト
${params.dataContext}

---
上記の情報に基づき、監査法人の観点から専門的な分析を行い、所定のフォーマットで回答してください。`
        : `## DD Item Analysis Request

**Item Code**: ${params.itemCode}
**Category**: ${params.category}
**Fiscal Year**: FY${params.fiscalYear}

### Item Description
${params.description}

### Analysis Requirements
${params.aiCheckPrompt}

### Data Context
${params.dataContext}

---
Based on the above information, please conduct a professional analysis from an audit firm perspective and respond in the specified format.`

    const fullSystemPrompt = `${systemPrompt}

${outputFormat}`

    const estimatedTokens = this.estimateTokens(fullSystemPrompt + userPrompt)

    return {
      success: true,
      data: {
        systemPrompt: fullSystemPrompt,
        userPrompt,
        estimatedTokens,
        personaType: this.config.type,
        personaVersion: this.config.version,
      },
    }
  }

  validateDDCheckResponse(response: unknown): PersonaResult<DDCheckAnalysis> {
    if (typeof response !== 'object' || response === null) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Response must be an object',
          details: { received: typeof response },
        },
      }
    }

    const obj = response as Record<string, unknown>

    const validStatuses = ['PASSED', 'FAILED', 'IN_PROGRESS', 'N_A', 'PENDING']
    const validRatings = ['low', 'medium', 'high', 'critical']

    if (!validStatuses.includes(String(obj.status))) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: `status must be one of: ${validStatuses.join(', ')}`,
        },
      }
    }

    if (!validRatings.includes(String(obj.riskRating))) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: `riskRating must be one of: ${validRatings.join(', ')}`,
        },
      }
    }

    const sanitizedResponse: DDCheckAnalysis = {
      itemCode: String(obj.itemCode || '').slice(0, 50),
      category: String(obj.category || '').slice(0, 100),
      status: obj.status as DDCheckAnalysis['status'],
      findings: this.sanitizeFindings(obj.findings),
      evidence: this.sanitizeEvidence(obj.evidence),
      conclusion: String(obj.conclusion || '').slice(0, 5000),
      riskRating: obj.riskRating as DDCheckAnalysis['riskRating'],
      recommendedActions: Array.isArray(obj.recommendedActions)
        ? obj.recommendedActions.map((a: unknown) => String(a).slice(0, 1000)).slice(0, 10)
        : [],
      standardsReferenced: Array.isArray(obj.standardsReferenced)
        ? obj.standardsReferenced.map((s: unknown) => String(s).slice(0, 200)).slice(0, 20)
        : [],
      confidence: Math.max(0, Math.min(1, Number(obj.confidence) || 0.5)),
    }

    return { success: true, data: sanitizedResponse }
  }

  private sanitizeFindings(findings: unknown): DDFindingOutput[] {
    if (!Array.isArray(findings)) return []

    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

    return findings
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .slice(0, 20)
      .map((item) => ({
        id: String(item.id || `finding-${Date.now()}`).slice(0, 100),
        title: String(item.title || '').slice(0, 200),
        description: String(item.description || '').slice(0, 2000),
        severity: validSeverities.includes(String(item.severity))
          ? (item.severity as DDFindingOutput['severity'])
          : 'MEDIUM',
        impact: String(item.impact || '').slice(0, 1000),
        recommendation: String(item.recommendation || '').slice(0, 1000),
        relatedStandard: item.relatedStandard
          ? String(item.relatedStandard).slice(0, 200)
          : undefined,
      }))
  }

  private sanitizeEvidence(evidence: unknown): EvidenceOutput[] {
    if (!Array.isArray(evidence)) return []

    const validTypes = ['JOURNAL', 'DOCUMENT', 'CALCULATION', 'EXTERNAL', 'AI_ANALYSIS']
    const validReliabilities = ['high', 'medium', 'low']

    return evidence
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .slice(0, 30)
      .map((item) => ({
        type: validTypes.includes(String(item.type))
          ? (item.type as EvidenceOutput['type'])
          : 'DOCUMENT',
        reference: String(item.reference || '').slice(0, 500),
        summary: String(item.summary || '').slice(0, 1000),
        reliability: validReliabilities.includes(String(item.reliability))
          ? (item.reliability as EvidenceOutput['reliability'])
          : 'medium',
      }))
  }

  private getOutputFormat(language: 'ja' | 'en'): string {
    if (language === 'ja') {
      return `## 出力フォーマット

以下のJSON形式で回答してください：

\`\`\`json
{
  "itemCode": "項目コード",
  "category": "カテゴリ名",
  "status": "PASSED|FAILED|IN_PROGRESS|N_A|PENDING",
  "findings": [
    {
      "id": "一意のID",
      "title": "指摘事項のタイトル",
      "description": "詳細な説明",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "impact": "財務諸表への影響",
      "recommendation": "推奨される対応",
      "relatedStandard": "関連する会計基準（任意）"
    }
  ],
  "evidence": [
    {
      "type": "JOURNAL|DOCUMENT|CALCULATION|EXTERNAL|AI_ANALYSIS",
      "reference": "証拠への参照",
      "summary": "証拠の要約",
      "reliability": "high|medium|low"
    }
  ],
  "conclusion": "監査結論の総括",
  "riskRating": "low|medium|high|critical",
  "recommendedActions": ["推奨アクション1", "推奨アクション2"],
  "standardsReferenced": ["ASBJ第xx号", "IAS xx"],
  "confidence": 0.95
}
\`\`\`

## 分析指針
1. プロフェッショナル・スクプティシズムを維持
2. 証拠に基づく客観的な判断
3. 重要性を考慮した評価
4. 明確な監査証跡の提示
5. 実行可能な推奨事項の提供`
    }

    return `## Output Format

Please respond in the following JSON format:

\`\`\`json
{
  "itemCode": "Item Code",
  "category": "Category Name",
  "status": "PASSED|FAILED|IN_PROGRESS|N_A|PENDING",
  "findings": [
    {
      "id": "unique-id",
      "title": "Finding Title",
      "description": "Detailed description",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "impact": "Impact on financial statements",
      "recommendation": "Recommended action",
      "relatedStandard": "Related accounting standard (optional)"
    }
  ],
  "evidence": [
    {
      "type": "JOURNAL|DOCUMENT|CALCULATION|EXTERNAL|AI_ANALYSIS",
      "reference": "Reference to evidence",
      "summary": "Summary of evidence",
      "reliability": "high|medium|low"
    }
  ],
  "conclusion": "Overall audit conclusion",
  "riskRating": "low|medium|high|critical",
  "recommendedActions": ["Action 1", "Action 2"],
  "standardsReferenced": ["ASBJ No.xx", "IAS xx"],
  "confidence": 0.95
}
\`\`\`

## Analysis Guidelines
1. Maintain professional skepticism
2. Evidence-based objective judgments
3. Materiality considerations
4. Clear audit trail presentation
5. Actionable recommendations`
  }
}

export const big4AuditorPersona = new Big4AuditorPersona()
