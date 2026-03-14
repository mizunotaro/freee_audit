export interface CreatePeerCompanyInput {
  ticker?: string
  name: string
  nameEn?: string
  exchange?: string
  industry?: string
  marketCap?: number
  revenue?: number
  employees?: number
  per?: number
  pbr?: number
  evEbitda?: number
  psr?: number
  beta?: number
  similarityScore?: number
  dataSource?: 'manual' | 'ai_suggested' | 'api'
  sourceUrl?: string
}

export interface UpdatePeerCompanyInput extends Partial<CreatePeerCompanyInput> {
  isActive?: boolean
}

export interface PeerCompanyFilter {
  activeOnly?: boolean
  industry?: string
  minSimilarityScore?: number
}

export interface PeerCompanyListItem {
  id: string
  ticker: string | null
  name: string
  nameEn: string | null
  exchange: string | null
  industry: string | null
  marketCap: number | null
  revenue: number | null
  employees: number | null
  per: number | null
  pbr: number | null
  evEbitda: number | null
  psr: number | null
  beta: number | null
  similarityScore: number | null
  dataSource: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PeerCandidate {
  ticker?: string
  name: string
  nameEn?: string
  exchange?: string
  industry: string
  revenue?: number
  marketCap?: number
  similarityScore: number
  keyMetrics: {
    per?: number
    pbr?: number
    evEbitda?: number
    psr?: number
    beta?: number
  }
  matchReasons: string[]
}

export interface PeerSelectionCriteria {
  industry: string
  subIndustry?: string
  revenue?: { min: number; max: number }
  market?: 'JPX' | 'NASDAQ' | 'NYSE' | 'GLOBAL'
  geography?: string
  growthStage?: 'seed' | 'early' | 'growth' | 'mature'
  minPeers: number
  maxPeers: number
}

export type Result<T, E = AppError> = { success: true; data: T } | { success: false; error: E }

export interface AppError {
  code: string
  message: string
  details?: unknown
}
