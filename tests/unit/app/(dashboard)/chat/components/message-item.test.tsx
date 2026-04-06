import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageItem } from '@/app/(dashboard)/chat/components/message-item'
import type { ChatMessage } from '@/app/api/chat/types'

describe('MessageItem', () => {
  it('should render user message with correct content', () => {
    const message: ChatMessage = {
      role: 'user',
      content: 'テストメッセージ',
      timestamp: new Date('2024-01-15T10:30:00'),
    }

    render(<MessageItem message={message} isLast={true} />)
    expect(screen.getByText('テストメッセージ')).toBeInTheDocument()
  })

  it('should render assistant message with default persona', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: '分析結果です',
      timestamp: new Date('2024-01-15T10:30:00'),
    }

    render(<MessageItem message={message} isLast={false} />)
    expect(screen.getByText('分析結果です')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('should render assistant message with CPA persona', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: 'CPA分析',
      persona: 'cpa',
      timestamp: new Date('2024-01-15T10:30:00'),
    }

    render(<MessageItem message={message} isLast={false} />)
    expect(screen.getByText('CPA')).toBeInTheDocument()
    expect(screen.getByText('公認会計士')).toBeInTheDocument()
  })

  it('should format markdown bold text', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: 'これは**重要**なポイントです',
      timestamp: new Date(),
    }

    render(<MessageItem message={message} isLast={false} />)
    const strong = document.querySelector('strong')
    expect(strong?.textContent).toBe('重要')
  })

  it('should format markdown italic text', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: 'これは*強調*テキストです',
      timestamp: new Date(),
    }

    render(<MessageItem message={message} isLast={false} />)
    const em = document.querySelector('em')
    expect(em?.textContent).toBe('強調')
  })

  it('should format inline code', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: '値は `1.5` です',
      timestamp: new Date(),
    }

    render(<MessageItem message={message} isLast={false} />)
    const code = document.querySelector('code')
    expect(code?.textContent).toBe('1.5')
  })

  it('should render time for valid timestamp', () => {
    const message: ChatMessage = {
      role: 'user',
      content: 'テスト',
      timestamp: new Date('2024-01-15T10:30:00'),
    }

    render(<MessageItem message={message} isLast={true} />)
    expect(screen.getByText('10:30')).toBeInTheDocument()
  })

  it('should not render time for undefined timestamp', () => {
    const message: ChatMessage = {
      role: 'user',
      content: 'テスト',
    }

    const { container } = render(<MessageItem message={message} isLast={true} />)
    const timeDivs = container.querySelectorAll('.text-xs')
    const hasTime = Array.from(timeDivs).some((el) => el.textContent?.match(/\d{2}:\d{2}/))
    expect(hasTime).toBe(false)
  })

  it('should render user message with reversed flex direction', () => {
    const message: ChatMessage = {
      role: 'user',
      content: 'ユーザー',
      timestamp: new Date(),
    }

    render(<MessageItem message={message} isLast={true} />)
    const article = screen.getByRole('article')
    expect(article.className).toContain('flex-row-reverse')
  })

  it('should render assistant message with normal flex direction', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: 'AI',
      timestamp: new Date(),
    }

    render(<MessageItem message={message} isLast={true} />)
    const article = screen.getByRole('article')
    expect(article.className).not.toContain('flex-row-reverse')
  })

  it('should sanitize dangerous HTML content', () => {
    const message: ChatMessage = {
      role: 'assistant',
      content: '<script>alert("xss")</script>safe content',
      timestamp: new Date(),
    }

    render(<MessageItem message={message} isLast={false} />)
    expect(document.querySelector('script')).not.toBeInTheDocument()
  })
})
