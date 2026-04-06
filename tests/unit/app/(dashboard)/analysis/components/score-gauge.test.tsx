import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScoreGauge } from '@/app/(dashboard)/analysis/components/score-gauge'

describe('ScoreGauge', () => {
  it('should render loading state', () => {
    render(<ScoreGauge score={0} status="fair" isLoading={true} />)
    expect(screen.getByText('総合評価スコア')).toBeInTheDocument()
  })

  it('should render score value', () => {
    render(<ScoreGauge score={85} status="excellent" />)
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('/ 100')).toBeInTheDocument()
  })

  it('should render status label for excellent', () => {
    render(<ScoreGauge score={90} status="excellent" />)
    expect(screen.getByText('非常に良好')).toBeInTheDocument()
  })

  it('should render status label for good', () => {
    render(<ScoreGauge score={75} status="good" />)
    expect(screen.getByText('良好')).toBeInTheDocument()
  })

  it('should render status label for fair', () => {
    render(<ScoreGauge score={50} status="fair" />)
    expect(screen.getByText('普通')).toBeInTheDocument()
  })

  it('should render status label for poor', () => {
    render(<ScoreGauge score={30} status="poor" />)
    expect(screen.getByText('要注意')).toBeInTheDocument()
  })

  it('should render status label for critical', () => {
    render(<ScoreGauge score={10} status="critical" />)
    expect(screen.getByText('危険')).toBeInTheDocument()
  })

  it('should default to fair for unknown status', () => {
    render(<ScoreGauge score={50} status="unknown" />)
    expect(screen.getByText('普通')).toBeInTheDocument()
  })

  it('should render SVG circles for the gauge', () => {
    const { container } = render(<ScoreGauge score={75} status="good" />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
  })

  it('should round score display', () => {
    render(<ScoreGauge score={75.7} status="good" />)
    expect(screen.getByText('76')).toBeInTheDocument()
  })

  it('should show zero score', () => {
    render(<ScoreGauge score={0} status="critical" />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
