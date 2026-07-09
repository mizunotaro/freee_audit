import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ProgressIndicator, AnimatedStatusIcon } from '@/components/chat/progress-indicator'
import type { ChatProgressState, ChatProgressStage } from '@/components/chat/config'

function progressState(
  stage: ChatProgressStage,
  overrides: Partial<ChatProgressState> = {}
): ChatProgressState {
  return {
    stage,
    progress: 0,
    message: '進行中メッセージ',
    subMessage: '補足メッセージ',
    startTime: Date.now(),
    ...overrides,
  }
}

describe('chat/progress-indicator — AnimatedStatusIcon', () => {
  it('renders nothing for the idle stage', () => {
    const { container } = render(<AnimatedStatusIcon stage="idle" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the error indicator (!) for the error stage', () => {
    const { getByText, container } = render(<AnimatedStatusIcon stage="error" />)
    expect(getByText('!')).toBeInTheDocument()
    expect(container.querySelector('.bg-destructive')).not.toBeNull()
  })

  it('renders the success indicator (✓) for the complete stage', () => {
    const { getByText, container } = render(<AnimatedStatusIcon stage="complete" />)
    expect(getByText('✓')).toBeInTheDocument()
    expect(container.querySelector('.bg-green-500')).not.toBeNull()
  })

  it('renders a spinner (no terminal glyph) for an active processing stage', () => {
    const { queryByText, container } = render(<AnimatedStatusIcon stage="connecting" />)
    expect(queryByText('!')).toBeNull()
    expect(queryByText('✓')).toBeNull()
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('applies the requested size class', () => {
    const sm = render(<AnimatedStatusIcon stage="error" size="sm" />)
    expect(sm.container.querySelector('.h-4.w-4')).not.toBeNull()
    const lg = render(<AnimatedStatusIcon stage="complete" size="lg" />)
    expect(lg.container.querySelector('.h-8.w-8')).not.toBeNull()
  })
})

describe('chat/progress-indicator — ProgressIndicator', () => {
  it('renders nothing for terminal/idle stages', () => {
    const idle = render(<ProgressIndicator progress={progressState('idle')} />)
    expect(idle.container.firstChild).toBeNull()
    const complete = render(<ProgressIndicator progress={progressState('complete')} />)
    expect(complete.container.firstChild).toBeNull()
    const error = render(<ProgressIndicator progress={progressState('error')} />)
    expect(error.container.firstChild).toBeNull()
  })

  it('renders the stage label, message, percentage, and elapsed time for an active stage', () => {
    const { getByText, container } = render(
      <ProgressIndicator progress={progressState('analyzing')} showPersonaAnimation={false} />
    )

    expect(getByText('分析中')).toBeInTheDocument()
    expect(getByText('進行中メッセージ')).toBeInTheDocument()
    // analyzing at elapsed 0 == cumulative connecting weight (10%).
    expect(getByText('10%')).toBeInTheDocument()
    expect(getByText('0.0秒')).toBeInTheDocument()

    const bar = container.querySelector('div[style*="width"]') as HTMLElement
    expect(bar).not.toBeNull()
    expect(bar.style.width).toBe('10%')
  })

  it('uses the stage description when no explicit message is provided', () => {
    const { getByText } = render(
      <ProgressIndicator
        progress={progressState('connecting', { message: '' })}
        showPersonaAnimation={false}
      />
    )
    expect(getByText('サーバーに接続しています...')).toBeInTheDocument()
  })

  it('exposes the progress track as an accessible progressbar', () => {
    const { getByRole } = render(
      <ProgressIndicator progress={progressState('analyzing')} showPersonaAnimation={false} />
    )

    const bar = getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '10')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', '分析中')
  })
})
