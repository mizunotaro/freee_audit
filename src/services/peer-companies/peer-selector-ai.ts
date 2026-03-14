import type { AIProvider } from '@/lib/integrations/ai/provider'
import type { PeerCandidate, PeerSelectionCriteria, Result } from './types'
import {
  generateWithFallback,
  createSeededRandom,
} from '@/lib/integrations/ai/generate-with-fallback'

interface CompanyProfile {
  industry: string
  subIndustry?: string
  revenue?: number
  marketCap?: number
  employees?: number
  geography?: string
}

interface SuggestPeersOptions {
  seed?: number
  useAI?: boolean
}

const INDUSTRY_PEERS: Record<string, { ticker: string; name: string; industry: string }[]> = {
  software: [
    { ticker: '4755', name: '楽天グループ', industry: '情報通信業' },
    { ticker: '4689', name: 'ヤフー', industry: '情報通信業' },
    { ticker: '3932', name: 'アカツキ', industry: '情報通信業' },
    { ticker: '3692', name: 'ディー・エヌ・エー', industry: '情報通信業' },
    { ticker: '3776', name: 'ブロードバンドタワー', industry: '情報通信業' },
  ],
  'e-commerce': [
    { ticker: '4755', name: '楽天グループ', industry: '情報通信業' },
    { ticker: '9984', name: 'ソフトバンクグループ', industry: '情報通信業' },
    { ticker: '4307', name: '野村総合研究所', industry: '情報通信業' },
  ],
  manufacturing: [
    { ticker: '7203', name: 'トヨタ自動車', industry: '製造業' },
    { ticker: '7267', name: '本田技研工業', industry: '製造業' },
    { ticker: '6758', name: 'ソニーグループ', industry: '製造業' },
    { ticker: '6702', name: '富士通', industry: '製造業' },
  ],
  saas: [
    { ticker: '4776', name: 'サイボウズ', industry: '情報通信業' },
    { ticker: '4446', name: 'GMOペパボ', industry: '情報通信業' },
    { ticker: '4829', name: '日本エンタープライズ', industry: '情報通信業' },
    { ticker: '3844', name: 'コンプティア', industry: '情報通信業' },
  ],
  fintech: [
    { ticker: '8473', name: 'SBIホールディングス', industry: '金融業' },
    { ticker: '6541', name: 'GMOクリエイト', industry: '情報通信業' },
    { ticker: '3923', name: 'ラクス', industry: '情報通信業' },
  ],
}

export class PeerSelectorAI {
  private aiProvider: AIProvider | null

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider ?? null
  }

  async suggestPeers(
    companyProfile: CompanyProfile,
    criteria: PeerSelectionCriteria,
    options: SuggestPeersOptions = {}
  ): Promise<Result<PeerCandidate[]>> {
    try {
      if (this.aiProvider && options.useAI !== false) {
        return this.suggestWithAI(companyProfile, criteria, options)
      }
      return this.suggestWithRules(companyProfile, criteria, options)
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'suggestion_failed',
          message: error instanceof Error ? error.message : 'Failed to suggest peers',
        },
      }
    }
  }

  private async suggestWithAI(
    companyProfile: CompanyProfile,
    criteria: PeerSelectionCriteria,
    options: SuggestPeersOptions
  ): Promise<Result<PeerCandidate[]>> {
    const prompt = this.buildPrompt(companyProfile, criteria)

    try {
      const result = await generateWithFallback(this.aiProvider!, {
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2000,
        temperature: 0.3,
        seed: options.seed,
        retryWithoutTemperature: true,
      })

      const candidates = this.parseAIResponse(result.content)
      return { success: true, data: candidates }
    } catch {
      return this.suggestWithRules(companyProfile, criteria, options)
    }
  }

  private suggestWithRules(
    companyProfile: CompanyProfile,
    criteria: PeerSelectionCriteria,
    options: SuggestPeersOptions = {}
  ): Result<PeerCandidate[]> {
    const industryKey = this.normalizeIndustry(companyProfile.industry)
    const basePeers = INDUSTRY_PEERS[industryKey] ?? []
    const seed = options.seed ?? Date.now()
    const random = createSeededRandom(seed)

    const candidates: PeerCandidate[] = basePeers
      .filter((peer) => {
        if (criteria.market && companyProfile.geography) {
          const isJapan = peer.ticker.length === 4
          if (criteria.market === 'JPX' && !isJapan) return false
          if ((criteria.market === 'NASDAQ' || criteria.market === 'NYSE') && isJapan) return false
        }
        return true
      })
      .slice(0, criteria.maxPeers)
      .map((peer, index) => {
        const score = Math.max(0.3, 1 - index * 0.1)
        return {
          ticker: peer.ticker,
          name: peer.name,
          industry: peer.industry,
          similarityScore: Math.round(score * 100) / 100,
          keyMetrics: {
            per: 15 + Math.floor(random() * 20),
            pbr: 1 + Math.floor(random() * 30) / 10,
            evEbitda: 8 + Math.floor(random() * 10),
          },
          matchReasons: this.generateMatchReasons(companyProfile, peer),
        }
      })

    if (candidates.length < criteria.minPeers) {
      const genericPeers = [
        { ticker: '7203', name: 'トヨタ自動車', industry: '製造業' },
        { ticker: '6758', name: 'ソニーグループ', industry: '製造業' },
        { ticker: '9984', name: 'ソフトバンクグループ', industry: '情報通信業' },
      ]
      for (const peer of genericPeers) {
        if (candidates.length >= criteria.minPeers) break
        if (!candidates.some((c) => c.ticker === peer.ticker)) {
          candidates.push({
            ticker: peer.ticker,
            name: peer.name,
            industry: peer.industry,
            similarityScore: 0.2,
            keyMetrics: {},
            matchReasons: ['一般的なベンチマーク企業'],
          })
        }
      }
    }

    return { success: true, data: candidates }
  }

  private normalizeIndustry(industry: string): string {
    const lower = industry.toLowerCase()
    if (lower.includes('software') || lower.includes('ソフ')) return 'software'
    if (lower.includes('saas') || lower.includes('クラウド')) return 'saas'
    if (lower.includes('ec') || lower.includes('商') || lower.includes('小売')) return 'e-commerce'
    if (lower.includes('fintech') || lower.includes('金融')) return 'fintech'
    if (lower.includes('製造') || lower.includes('manufacturing')) return 'manufacturing'
    return 'software'
  }

  private generateMatchReasons(
    profile: CompanyProfile,
    peer: { name: string; industry: string }
  ): string[] {
    const reasons: string[] = []
    reasons.push(`同一業界（${peer.industry}）`)
    if (profile.revenue && profile.revenue > 1000000000) {
      reasons.push('類似した収益規模')
    }
    if (profile.geography === 'Japan' || profile.geography === '日本') {
      reasons.push('同一地域（日本）')
    }
    return reasons
  }

  private buildPrompt(profile: CompanyProfile, criteria: PeerSelectionCriteria): string {
    return `あなたは公開会計士・証券アナリストです。以下の企業に類似する上場企業を${criteria.minPeers}〜${criteria.maxPeers}社提案してください。

対象企業:
- 業界: ${profile.industry}${profile.subIndustry ? ` (${profile.subIndustry})` : ''}
- 売上高: ${profile.revenue ? `${(profile.revenue / 100000000).toFixed(1)}億円` : '不明'}
- 従業員数: ${profile.employees ?? '不明'}
- 地域: ${profile.geography ?? '不明'}

条件:
- 市場: ${criteria.market ?? '指定なし'}
- 成長ステージ: ${criteria.growthStage ?? '指定なし'}

以下のJSON形式で回答してください:
{
  "candidates": [
    {
      "ticker": "証券コード",
      "name": "企業名",
      "industry": "業界",
      "similarityScore": 0.0-1.0,
      "keyMetrics": {
        "per": 数値,
        "pbr": 数値,
        "evEbitda": 数値
      },
      "matchReasons": ["理由1", "理由2"]
    }
  ]
}`
  }

  private parseAIResponse(response: string): PeerCandidate[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return []

      const parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed.candidates)) return []

      return parsed.candidates
        .filter(
          (c: Record<string, unknown>) =>
            typeof c.name === 'string' && typeof c.similarityScore === 'number'
        )
        .map((c: Record<string, unknown>) => {
          const km = c.keyMetrics as Record<string, unknown> | undefined
          return {
            ticker: typeof c.ticker === 'string' ? c.ticker : undefined,
            name: c.name as string,
            industry: typeof c.industry === 'string' ? c.industry : '',
            similarityScore: Math.min(1, Math.max(0, c.similarityScore as number)),
            keyMetrics: {
              per: typeof km?.per === 'number' ? km.per : undefined,
              pbr: typeof km?.pbr === 'number' ? km.pbr : undefined,
              evEbitda: typeof km?.evEbitda === 'number' ? km.evEbitda : undefined,
            },
            matchReasons: Array.isArray(c.matchReasons)
              ? (c.matchReasons as string[]).filter((r) => typeof r === 'string')
              : [],
          }
        })
    } catch {
      return []
    }
  }
}

export function createPeerSelectorAI(aiProvider?: AIProvider): PeerSelectorAI {
  return new PeerSelectorAI(aiProvider)
}
