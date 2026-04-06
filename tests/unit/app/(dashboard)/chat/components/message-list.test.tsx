import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageList } from '@/app/(dashboard)/chat/components/message-list'
import type { ChatMessage } from '@/app/api/chat/types'

describe('MessageList', () => {
  it('should return null for empty messages', () => {
    const { container } = render(<MessageList messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render messages with correct content', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'ユーザーメッセージ', timestamp: new Date('2024-01-01T10:00:00') },
      { role: 'assistant', content: 'AIメッセージ', timestamp: new Date('2024-01-01T10:01:00') },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('ユーザーメッセージ')).toBeInTheDocument()
    expect(screen.getByText('AIメッセージ')).toBeInTheDocument()
  })

  it('should render messages in order', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'First', timestamp: new Date() },
      { role: 'assistant', content: 'Second', timestamp: new Date() },
      { role: 'user', content: 'Third', timestamp: new Date() },
    ]

    render(<MessageList messages={messages} />)

    const articles = screen.getAllByRole('article')
    expect(articles.length).toBe(3)
    expect(articles[0]).toHaveTextContent('First')
    expect(articles[1]).toHaveTextContent('Second')
    expect(articles[2]).toHaveTextContent('Third')
  })

  it('should render log role', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test', timestamp: new Date() },
    ]

    render(<MessageList messages={messages} />)
    expect(screen.getByRole('log')).toBeInTheDocument()
  })

  it('should render messages with persona', () => {
    const messages: ChatMessage[] = [
      { role: 'assistant', content: 'CPA analysis', persona: 'cpa', timestamp: new Date() },
    ]

    render(<MessageList messages={messages} />)
    expect(screen.getByText('CPA')).toBeInTheDocument()
  })

  it('should render end ref marker (hidden div)', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test', timestamp: new Date() },
    ]

    const { container } = render(<MessageList messages={messages} />)
    const hiddenDiv = container.querySelector('[aria-hidden="true"]')
    expect(hiddenDiv).toBeInTheDocument()
  })
})
