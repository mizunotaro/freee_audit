import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestionChips } from '@/app/(dashboard)/chat/components/suggestion-chips'

describe('SuggestionChips', () => {
  it('should return null for empty suggestions', () => {
    const { container } = render(
      <SuggestionChips suggestions={[]} onSelect={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render all suggestions', () => {
    const suggestions = ['提案1', '提案2', '提案3']
    render(<SuggestionChips suggestions={suggestions} onSelect={vi.fn()} />)

    expect(screen.getByText('提案1')).toBeInTheDocument()
    expect(screen.getByText('提案2')).toBeInTheDocument()
    expect(screen.getByText('提案3')).toBeInTheDocument()
  })

  it('should call onSelect when suggestion is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const suggestions = ['分析して', 'レポートを見せて']

    render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} />)

    await user.click(screen.getByText('分析して'))
    expect(onSelect).toHaveBeenCalledWith('分析して')
  })

  it('should disable buttons when disabled prop is true', () => {
    const suggestions = ['提案1']
    render(<SuggestionChips suggestions={suggestions} onSelect={vi.fn()} disabled={true} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('should not call onSelect when disabled and clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const suggestions = ['提案1']

    render(<SuggestionChips suggestions={suggestions} onSelect={onSelect} disabled={true} />)

    await user.click(screen.getByText('提案1'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
