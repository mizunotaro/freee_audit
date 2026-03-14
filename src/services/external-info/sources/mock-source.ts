import { BaseInfoSource } from './base-source'
import type {
  ExternalInfoQuery,
  ExternalInfoResult,
  ExternalInfoItem,
  InfoSourceId,
} from '../types'

const MOCK_DATA: ExternalInfoItem[] = [
  {
    id: 'mock-tax-001',
    source: 'mock',
    category: 'tax_law',
    title: '2024年度税制改正の要点',
    summary: '法人税の課税標準の特例措置の延長等、2024年度税制改正の主な内容を解説します。',
    content: `## 2024年度税制改正の概要

### 1. 法人税関係
- 中小企業等経営強化税制の延長
- 研究開発税制の拡充
- デジタル投資促進税制の創設

### 2. 消費税関係
- インボイス制度の経過措置継続
- 免税事業者の選択に関する特例

### 3. その他
- 給与所得控除の見直し
- 配偶者控除の拡充`,
    publishedAt: new Date('2024-01-01'),
    effectiveFrom: new Date('2024-04-01'),
    tags: ['法人税', '税制改正', '2024年度'],
    relevanceScore: 0.95,
    fetchedAt: new Date(),
  },
  {
    id: 'mock-social-001',
    source: 'mock',
    category: 'social_insurance',
    title: '社会保険料率の改定について',
    summary: '2024年度の健康保険、厚生年金の保険料率改定内容について。',
    content: `## 2024年度 社会保険料率改定

### 健康保険
- 協会けんぽ: 10.0% → 10.2%（一部都道府県）
- 組合健保: 組合ごとに設定

### 厚生年金
- 保険料率: 18.3%（変更なし）
- 標準報酬月額の上限: 650,000円

### 雇用保険
- 一般事業: 0.95%
- 建設事業: 1.05%`,
    publishedAt: new Date('2024-03-01'),
    effectiveFrom: new Date('2024-04-01'),
    tags: ['社会保険', '健康保険', '厚生年金', '料率改定'],
    relevanceScore: 0.9,
    fetchedAt: new Date(),
  },
  {
    id: 'mock-accounting-001',
    source: 'mock',
    category: 'accounting_standard',
    title: '収益認識に関する会計基準の適用',
    summary: '収益認識会計基準（ASBJNo.29）の適用期間と実務対応のポイント。',
    content: `## 収益認識会計基準の適用

### 適用期間
- 上場企業: 2021年4月1日以降開始の事業年度
- 非上場企業: 2022年4月1日以降開始の事業年度

### 主な変更点
1. 5ステップモデルの適用
2. 契約資産・契約負債の計上
3. 売上高の認識タイミングの変更

### 実務対応のポイント
- 契約の識別と履行義務の特定
- 独立販売価格の見積り
- 継続的な見直し手続き`,
    publishedAt: new Date('2023-06-01'),
    tags: ['会計基準', '収益認識', 'ASBJ'],
    relevanceScore: 0.85,
    fetchedAt: new Date(),
  },
  {
    id: 'mock-notification-001',
    source: 'mock',
    category: 'notification',
    title: '確定申告期限のお知らせ',
    summary: '2024年分の確定申告期限と特例措置について。',
    content: `## 確定申告期限

### 通常期限
- e-Tax: 2025年4月16日
- 書面: 2025年4月15日

### 還付申告
- 5年間申告可能

### 特例措置
- 災害被害者: 申告期限の延長
- 海外駐在員: 申告特例`,
    publishedAt: new Date('2025-01-15'),
    tags: ['確定申告', '期限', 'お知らせ'],
    relevanceScore: 0.8,
    fetchedAt: new Date(),
  },
]

export class MockInfoSource extends BaseInfoSource {
  readonly sourceId: InfoSourceId = 'mock'
  readonly displayName = 'Mock Data Source'

  private simulateDelay: boolean
  private delayMs: number

  constructor(config?: Partial<import('../types').InfoSourceConfig>) {
    super({
      id: 'mock',
      name: 'Mock Source',
      description: 'Development mock data source',
      enabled: true,
      priority: 100,
      timeoutMs: 5000,
      maxRetries: 0,
      retryDelayMs: 0,
      cacheTtlMs: 60000,
      ...config,
    })
    this.simulateDelay = config?.customConfig?.simulateDelay !== false
    this.delayMs = (config?.customConfig?.delayMs as number) ?? 200
  }

  async fetch(query: ExternalInfoQuery): Promise<ExternalInfoResult> {
    const startTime = Date.now()

    if (this.simulateDelay) {
      await this.sleep(this.delayMs)
    }

    try {
      const items = this.filterAndRankItems(query)
      const latencyMs = Date.now() - startTime

      this.recordSuccess(latencyMs)

      return {
        success: true,
        items,
        totalFound: items.length,
        source: this.sourceId,
        fetchedAt: new Date(),
        latencyMs,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.recordFailure(errorMessage)

      return {
        success: false,
        items: [],
        totalFound: 0,
        source: this.sourceId,
        fetchedAt: new Date(),
        latencyMs: Date.now() - startTime,
        error: {
          code: 'mock_fetch_error',
          message: errorMessage,
        },
      }
    }
  }

  private filterAndRankItems(query: ExternalInfoQuery): ExternalInfoItem[] {
    let items = [...MOCK_DATA]

    if (query.categories && query.categories.length > 0) {
      items = items.filter((item) => query.categories!.includes(item.category))
    }

    if (query.query) {
      const queryLower = query.query.toLowerCase()
      const queryTerms = queryLower.split(/\s+/)

      items = items
        .map((item) => {
          const relevanceScore = this.calculateRelevance(item, queryTerms)
          return { ...item, relevanceScore }
        })
        .filter((item) => item.relevanceScore > 0.1)
    }

    if (query.fromDate) {
      items = items.filter((item) => !item.publishedAt || item.publishedAt >= query.fromDate!)
    }

    if (query.toDate) {
      items = items.filter((item) => !item.publishedAt || item.publishedAt <= query.toDate!)
    }

    items.sort((a, b) => b.relevanceScore - a.relevanceScore)

    if (query.minRelevance !== undefined) {
      items = items.filter((item) => item.relevanceScore >= query.minRelevance!)
    }

    const limit = query.limit ?? 10
    return items.slice(0, limit)
  }

  private calculateRelevance(item: ExternalInfoItem, queryTerms: string[]): number {
    let score = 0

    const titleLower = item.title.toLowerCase()
    const summaryLower = item.summary.toLowerCase()
    const contentLower = item.content.toLowerCase()
    const tagsLower = item.tags.map((t) => t.toLowerCase())

    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 0.4
      if (summaryLower.includes(term)) score += 0.2
      if (contentLower.includes(term)) score += 0.1
      if (tagsLower.some((tag) => tag.includes(term))) score += 0.3
    }

    return Math.min(score, 1.0)
  }
}
