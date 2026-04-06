import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalysisPage from '@/app/(dashboard)/analysis/page'

vi.mock('@/app/(dashboard)/analysis/hooks/use-analysis', () => ({
  useAnalysis: vi.fn(),
}))

const mockSuccessData = {
  overallScore: 78,
  overallStatus: 'good' as const,
  executiveSummary: 'Test executive summary',
  categoryAnalyses: [] as const,
  allAlerts: [] as const,
  topRecommendations: [] as const,
  keyMetrics: [] as const,
  processingTimeMs: 100,
  analyzedAt: '2024-01-01T00:00:00.000Z',
}

import { useAnalysis } from '@/app/(dashboard)/analysis/hooks/use-analysis'

const mockedUseAnalysis = vi.mocked(useAnalysis)

describe('AnalysisPage', () => {
  beforeEach(() => {
    mockedUseAnalysis.mockReturnValue({
      financialData: null,
      ratioData: null,
      benchmarkData: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render page title', () => {
    render(<AnalysisPage />)
    expect(screen.getByText('財務分析ダッシュボード')).toBeInTheDocument()
  })

  it('should render subtitle', () => {
    render(<AnalysisPage />)
    expect(screen.getByText('包括的な財務分析とAIインサイト')).toBeInTheDocument()
  })

  it('should show error state with retry button', () => {
    mockedUseAnalysis.mockReturnValue({
      financialData: null,
      ratioData: null,
      benchmarkData: null,
      isLoading: false,
      error: 'データ取得エラー',
      refetch: vi.fn(),
    })

    render(<AnalysisPage />)
    expect(screen.getByText('分析データの取得に失敗しました')).toBeInTheDocument()
    expect(screen.getByText('データ取得エラー')).toBeInTheDocument()
    expect(screen.getByText('再試行')).toBeInTheDocument()
  })

  it('should call refetch when retry button clicked', async () => {
    const refetch = vi.fn()
    mockedUseAnalysis.mockReturnValue({
      financialData: null,
      ratioData: null,
      benchmarkData: null,
      isLoading: false,
      error: 'データ取得エラー',
      refetch,
    })

    const user = userEvent.setup()
    render(<AnalysisPage />)

    await user.click(screen.getByText('再試行'))
    expect(refetch).toHaveBeenCalled()
  })

  it('should render all dashboard sections when data is loaded', () => {
    mockedUseAnalysis.mockReturnValue({
      financialData: {
        success: true,
        data: mockSuccessData,
        metadata: {
          requestId: 'test',
          processingTimeMs: 100,
          cached: false,
          version: '1.0.0',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
      ratioData: null,
      benchmarkData: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<AnalysisPage />)

    expect(screen.getByText('財務分析ダッシュボード')).toBeInTheDocument()
    expect(screen.getByText('総合評価スコア')).toBeInTheDocument()
    expect(screen.getByText('主要財務指標')).toBeInTheDocument()
    expect(screen.getByText('財務比率分析')).toBeInTheDocument()
    expect(screen.getByText('カテゴリ別スコア分布')).toBeInTheDocument()
    expect(screen.getByText('AI分析インサイト')).toBeInTheDocument()
    expect(screen.getByText('推奨アクション')).toBeInTheDocument()
    expect(screen.getByText('アラート')).toBeInTheDocument()
  })

  it('should default score to 0 when financial data is null', () => {
    mockedUseAnalysis.mockReturnValue({
      financialData: null,
      ratioData: null,
      benchmarkData: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<AnalysisPage />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
