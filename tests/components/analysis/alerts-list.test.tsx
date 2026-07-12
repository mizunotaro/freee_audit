import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertsList } from '@/app/[locale]/(authenticated)/analysis/components/alerts-list'
import type { AlertOutput } from '@/app/api/analysis/types/output'

function makeAlert(overrides: Partial<AlertOutput> = {}): AlertOutput {
  return {
    id: 'a1',
    category: 'liquidity',
    severity: 'high',
    title: '流動比率低下',
    description: '流動比率が基準を下回っています',
    metric: '流動比率',
    currentValue: 95.5,
    threshold: 150,
    recommendation: '短期借入の見直しを検討してください',
    ...overrides,
  }
}

describe('AlertsList', () => {
  describe('loading state', () => {
    it('exposes a status role with aria-busy and an accessible label', () => {
      render(<AlertsList alerts={[]} isLoading />)
      const region = screen.getByRole('status')
      expect(region).toHaveAttribute('aria-busy', 'true')
      expect(region).toHaveAttribute('aria-label', 'アラートを読み込み中')
    })
  })

  describe('empty state', () => {
    it('renders an explicit empty message with a status role', () => {
      render(<AlertsList alerts={[]} />)
      expect(screen.getByText('アラートはありません')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('アラートはありません')
    })
  })

  describe('populated state', () => {
    it('gives the severity filter an accessible name', () => {
      render(<AlertsList alerts={[makeAlert()]} />)
      expect(screen.getByRole('combobox', { name: '重大度で絞り込み' })).toBeInTheDocument()
    })

    it('marks the severity emoji decorative', () => {
      const { container } = render(<AlertsList alerts={[makeAlert()]} />)
      const emoji = container.querySelector('.text-lg')
      expect(emoji).toHaveAttribute('aria-hidden', 'true')
    })

    it('exposes the disclosure button with aria-expanded and aria-controls', async () => {
      const user = userEvent.setup()
      render(<AlertsList alerts={[makeAlert()]} />)
      const trigger = screen.getByRole('button', { name: /流動比率低下/ })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      const controlsId = trigger.getAttribute('aria-controls')
      expect(controlsId).toBeTruthy()

      await user.click(trigger)
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      const panel = document.getElementById(controlsId as string)
      expect(panel).not.toBeNull()
      expect(panel).toHaveTextContent('推奨対応')
    })

    it('renders the severity count badge', () => {
      render(<AlertsList alerts={[makeAlert({ severity: 'critical' })]} />)
      expect(screen.getByText('1件')).toBeInTheDocument()
    })
  })
})
