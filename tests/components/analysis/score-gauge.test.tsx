import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreGauge } from '@/app/[locale]/(authenticated)/analysis/components/score-gauge'

describe('ScoreGauge', () => {
  describe('loading state', () => {
    it('exposes a status role with aria-busy and an accessible label', () => {
      render(<ScoreGauge score={0} status="fair" isLoading />)
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-busy', 'true')
      expect(region).toHaveAttribute('aria-label', '総合評価スコアを読み込み中')
    })
  })

  describe('loaded state', () => {
    it('conveys the score and status to assistive tech via role=img', () => {
      render(<ScoreGauge score={75} status="good" />)
      const gauge = screen.getByRole('img')
      expect(gauge).toHaveAttribute('aria-label', '総合評価スコア 75 / 100、良好')
    })

    it('hides the decorative SVG from assistive tech', () => {
      const { container } = render(<ScoreGauge score={75} status="good" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })

    it('renders the numeric score visibly for sighted users', () => {
      render(<ScoreGauge score={42} status="fair" />)
      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('falls back to a default status label for unknown status', () => {
      render(<ScoreGauge score={10} status="unknown" />)
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', '総合評価スコア 10 / 100、普通')
    })
  })
})
