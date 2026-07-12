import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecommendationsPanel } from '@/app/[locale]/(authenticated)/analysis/components/recommendations-panel'
import type { RecommendationOutput } from '@/app/api/analysis/types/output'

function makeRec(overrides: Partial<RecommendationOutput> = {}): RecommendationOutput {
  return {
    id: 'r1',
    priority: 'high',
    category: 'liquidity',
    title: 'キャッシュフロー改善',
    description: '売掛金回収を早める',
    expectedImpact: '現金回収サイクル短縮',
    timeframe: 'short_term',
    ...overrides,
  }
}

describe('RecommendationsPanel', () => {
  describe('loading state', () => {
    it('exposes a status role with aria-busy and an accessible label', () => {
      render(<RecommendationsPanel recommendations={[]} isLoading />)
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-busy', 'true')
      expect(region).toHaveAttribute('aria-label', '推奨アクションを読み込み中')
    })
  })

  describe('empty state', () => {
    it('renders an explicit empty message with a status role', () => {
      render(<RecommendationsPanel recommendations={[]} />)
      expect(screen.getByText('推奨事項はありません')).toBeInTheDocument()
    })
  })

  describe('populated state', () => {
    it('exposes the completion toggle as a labelled checkbox', () => {
      render(<RecommendationsPanel recommendations={[makeRec()]} />)
      const checkbox = screen.getByRole('checkbox', { name: /完了にする.*キャッシュフロー改善/ })
      expect(checkbox).toHaveAttribute('aria-checked', 'false')
    })

    it('toggles aria-checked when activated', async () => {
      const user = userEvent.setup()
      render(<RecommendationsPanel recommendations={[makeRec()]} />)
      const checkbox = screen.getByRole('checkbox', { name: /完了にする/ })

      await user.click(checkbox)
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
      expect(checkbox).toHaveAccessibleName(/完了を取り消す/)
    })

    it('filters by priority', async () => {
      const user = userEvent.setup()
      render(
        <RecommendationsPanel
          recommendations={[
            makeRec({ id: 'r1', priority: 'high' }),
            makeRec({ id: 'r2', priority: 'low', title: '費用見直し' }),
          ]}
        />
      )
      expect(screen.getByText('キャッシュフロー改善')).toBeInTheDocument()
      expect(screen.getByText('費用見直し')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '高' }))
      expect(screen.getByText('キャッシュフロー改善')).toBeInTheDocument()
      expect(screen.queryByText('費用見直し')).not.toBeInTheDocument()
    })
  })
})
