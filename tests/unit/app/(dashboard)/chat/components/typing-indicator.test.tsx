import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TypingIndicator } from '@/app/(dashboard)/chat/components/typing-indicator'

describe('TypingIndicator', () => {
  it('should render with status role', () => {
    render(<TypingIndicator />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should render aria-label', () => {
    render(<TypingIndicator />)
    expect(screen.getByLabelText('AIが入力中')).toBeInTheDocument()
  })

  it('should render bouncing dots', () => {
    const { container } = render(<TypingIndicator />)
    const dots = container.querySelectorAll('.animate-bounce')
    expect(dots.length).toBe(3)
  })

  it('should render persona indicator', () => {
    render(<TypingIndicator />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })
})
