import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatErrorBoundary } from '@/app/(dashboard)/chat/components/error-boundary'

function ThrowError(): never {
  throw new Error('Test error')
}

describe('ChatErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ChatErrorBoundary>
        <div>Child content</div>
      </ChatErrorBoundary>
    )

    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('should render error UI when child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ChatErrorBoundary>
        <ThrowError />
      </ChatErrorBoundary>
    )

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    expect(screen.getByText(/予期しないエラーが発生しました/)).toBeInTheDocument()
  })

  it('should render retry button on error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ChatErrorBoundary>
        <ThrowError />
      </ChatErrorBoundary>
    )

    expect(screen.getByText('再試行')).toBeInTheDocument()
  })

  it('should recover when retry is clicked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let shouldThrow = true

    function ConditionalThrow() {
      if (shouldThrow) throw new Error('Test error')
      return <div>Recovered content</div>
    }

    const user = userEvent.setup()
    render(
      <ChatErrorBoundary>
        <ConditionalThrow />
      </ChatErrorBoundary>
    )

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()

    shouldThrow = false
    await user.click(screen.getByText('再試行'))

    expect(screen.getByText('Recovered content')).toBeInTheDocument()
  })

  it('should render custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ChatErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ChatErrorBoundary>
    )

    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })

  it('should call onError callback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()

    render(
      <ChatErrorBoundary onError={onError}>
        <ThrowError />
      </ChatErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })
})
