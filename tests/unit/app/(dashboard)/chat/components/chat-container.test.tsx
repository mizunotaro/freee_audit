import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatContainer } from '@/app/(dashboard)/chat/components/chat-container'
import type { ChatMessage } from '@/app/api/chat/types'

describe('ChatContainer', () => {
  const mockMessages: ChatMessage[] = [
    { role: 'user', content: '分析して', timestamp: new Date() },
    { role: 'assistant', content: '分析結果です', timestamp: new Date() },
  ]

  it('should render messages', () => {
    render(<ChatContainer messages={mockMessages} isLoading={false} onSendMessage={vi.fn()} />)

    expect(screen.getByText('分析して')).toBeInTheDocument()
    expect(screen.getByText('分析結果です')).toBeInTheDocument()
  })

  it('should show suggestion chips when no messages', () => {
    render(<ChatContainer messages={[]} isLoading={false} onSendMessage={vi.fn()} />)

    expect(screen.getByText('今期の決算書を分析して')).toBeInTheDocument()
  })

  it('should call onSendMessage when suggestion clicked', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatContainer messages={[]} isLoading={false} onSendMessage={onSend} />)

    await user.click(screen.getByText('今期の決算書を分析して'))
    expect(onSend).toHaveBeenCalledWith('今期の決算書を分析して')
  })

  it('should show typing indicator when loading', () => {
    render(<ChatContainer messages={mockMessages} isLoading={true} onSendMessage={vi.fn()} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should disable input when loading', () => {
    render(<ChatContainer messages={mockMessages} isLoading={true} onSendMessage={vi.fn()} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('should not call onSendMessage when suggestion clicked while loading', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatContainer messages={[]} isLoading={true} onSendMessage={onSend} />)

    await user.click(screen.getByText('今期の決算書を分析して'))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('should render custom suggestions', () => {
    const customSuggestions = ['カスタム提案1', 'カスタム提案2']
    render(
      <ChatContainer
        messages={[]}
        isLoading={false}
        onSendMessage={vi.fn()}
        suggestions={customSuggestions}
      />
    )

    expect(screen.getByText('カスタム提案1')).toBeInTheDocument()
    expect(screen.getByText('カスタム提案2')).toBeInTheDocument()
  })
})

describe('InputArea', () => {
  it('should send message on button click', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatContainer messages={[]} isLoading={false} onSendMessage={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テストメッセージ')

    const sendButton = screen.getByRole('button', { name: '送信' })
    await user.click(sendButton)

    expect(onSend).toHaveBeenCalledWith('テストメッセージ')
  })

  it('should send message on Enter key', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatContainer messages={[]} isLoading={false} onSendMessage={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テストメッセージ{Enter}')

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('テストメッセージ')
    })
  })

  it('should not send empty message', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatContainer messages={[]} isLoading={false} onSendMessage={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '   ')

    const sendButton = screen.getByRole('button', { name: '送信' })
    await user.click(sendButton)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should clear input after sending', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatContainer messages={[]} isLoading={false} onSendMessage={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テストメッセージ')

    const sendButton = screen.getByRole('button', { name: '送信' })
    await user.click(sendButton)

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })
})

describe('MessageList', () => {
  it('should render empty state', () => {
    render(<ChatContainer messages={[]} isLoading={false} onSendMessage={vi.fn()} />)
    expect(screen.getByText('財務分析AIアシスタント')).toBeInTheDocument()
  })

  it('should render all messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Message 1', timestamp: new Date() },
      { role: 'assistant', content: 'Message 2', timestamp: new Date() },
      { role: 'user', content: 'Message 3', timestamp: new Date() },
    ]

    render(<ChatContainer messages={messages} isLoading={false} onSendMessage={vi.fn()} />)

    expect(screen.getByText('Message 1')).toBeInTheDocument()
    expect(screen.getByText('Message 2')).toBeInTheDocument()
    expect(screen.getByText('Message 3')).toBeInTheDocument()
  })
})

describe('PersonaIndicator', () => {
  it('should render default avatar when no persona', () => {
    const messages: ChatMessage[] = [{ role: 'assistant', content: 'Test', timestamp: new Date() }]

    render(<ChatContainer messages={messages} isLoading={false} onSendMessage={vi.fn()} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('should render CPA persona', () => {
    const messages: ChatMessage[] = [
      { role: 'assistant', content: 'Test', persona: 'cpa', timestamp: new Date() },
    ]

    render(<ChatContainer messages={messages} isLoading={false} onSendMessage={vi.fn()} />)
    expect(screen.getByText('CPA')).toBeInTheDocument()
  })
})
