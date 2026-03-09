import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AnalysisPage from '@/app/(dashboard)/analysis/page'

vi.mock('@/app/(dashboard)/analysis/hooks/use-analysis', () => ({
  useAnalysis: () => ({
    financialData: {
      success: true,
      data: {
        overallScore: 75,
        overallStatus: 'good',
        executiveSummary: 'テストサマリー',
        categoryAnalyses: [],
        allAlerts: [],
        topRecommendations: [],
        keyMetrics: [
          { name: '流動比率', value: 150, unit: '%', format: 'percentage', status: 'good' },
        ],
        processingTimeMs: 100,
        analyzedAt: '2024-01-01T00:00:00.000Z',
      },
      metadata: {
        requestId: 'test-request-id',
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
  }),
}))

describe('AnalysisPage', () => {
  it('should render dashboard title', () => {
    render(<AnalysisPage />)
    expect(screen.getByText('財務分析ダッシュボード')).toBeInTheDocument()
  })

  it('should display overall score', async () => {
    render(<AnalysisPage />)
    await waitFor(() => {
      expect(screen.getByText('75')).toBeInTheDocument()
    })
  })

  it('should display period selector', () => {
    render(<AnalysisPage />)
    expect(screen.getByText(/年度/)).toBeInTheDocument()
  })

  it('should display export button', () => {
    render(<AnalysisPage />)
    expect(screen.getByText('エクスポート')).toBeInTheDocument()
  })
})
