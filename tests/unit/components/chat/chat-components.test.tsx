import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatContainer } from '@/app/(dashboard)/chat/components/chat-container'
import { InputArea } from '@/app/(dashboard)/chat/components/input-area'
import { MessageList } from '@/app/(dashboard)/chat/components/message-list'
import { SuggestionChips } from '@/app/(dashboard)/chat/components/suggestion-chips'
import { TypingIndicator } from '@/app/(dashboard)/chat/components/typing-indicator'
import type { ChatMessage } from '@/app/api/chat/types'

const createMockMessage = (overrides?: Partial<ChatMessage>): ChatMessage => ({
  role: 'user',
  content: 'Test message',
  timestamp: new Date(),
  ...overrides,
})

describe('ChatContainer', () => {
  const defaultProps = {
    messages: [] as ChatMessage[],
    isLoading: false,
    onSendMessage: vi.fn(),
  }

  it('should render empty state when no messages', () => {
    render(<ChatContainer {...defaultProps} />)
    expect(screen.getByText('財務分析AIアシスタント')).toBeInTheDocument()
  })

  it('should render messages when provided', () => {
    const messages: ChatMessage[] = [
      createMockMessage({ role: 'user', content: 'Hello' }),
      createMockMessage({ role: 'assistant', content: 'Hi there!' }),
    ]
    render(<ChatContainer {...defaultProps} messages={messages} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('should show typing indicator when loading with messages', () => {
    const messages: ChatMessage[] = [createMockMessage()]
    render(<ChatContainer {...defaultProps} messages={messages} isLoading={true} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should call onSendMessage when suggestion selected', () => {
    const onSendMessage = vi.fn()
    render(<ChatContainer {...defaultProps} onSendMessage={onSendMessage} />)

    const suggestion = screen.getByText('今期の決算書を分析して')
    fireEvent.click(suggestion)

    expect(onSendMessage).toHaveBeenCalledWith('今期の決算書を分析して')
  })

  it('should not call onSendMessage when loading', () => {
    const onSendMessage = vi.fn()
    render(<ChatContainer {...defaultProps} onSendMessage={onSendMessage} isLoading={true} />)

    const suggestion = screen.getByText('今期の決算書を分析して')
    fireEvent.click(suggestion)

    expect(onSendMessage).not.toHaveBeenCalled()
  })

  it('should render custom suggestions', () => {
    const suggestions = ['Custom suggestion 1', 'Custom suggestion 2']
    render(<ChatContainer {...defaultProps} suggestions={suggestions} />)

    expect(screen.getByText('Custom suggestion 1')).toBeInTheDocument()
    expect(screen.getByText('Custom suggestion 2')).toBeInTheDocument()
  })

  it('should render with custom placeholder', () => {
    render(<ChatContainer {...defaultProps} placeholder="Custom placeholder" />)
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })
})

describe('InputArea', () => {
  const defaultProps = {
    onSend: vi.fn(),
  }

  it('should render textarea and button', () => {
    render(<InputArea {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })

  it('should call onSend when button clicked with text', () => {
    const onSend = vi.fn()
    render(<InputArea {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Test message' } })

    const button = screen.getByRole('button', { name: '送信' })
    fireEvent.click(button)

    expect(onSend).toHaveBeenCalledWith('Test message')
  })

  it('should clear input after sending', () => {
    const onSend = vi.fn()
    render(<InputArea {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Test message' } })

    const button = screen.getByRole('button', { name: '送信' })
    fireEvent.click(button)

    expect(textarea.value).toBe('')
  })

  it('should not call onSend when input is empty', () => {
    const onSend = vi.fn()
    render(<InputArea {...defaultProps} onSend={onSend} />)

    const button = screen.getByRole('button', { name: '送信' })
    fireEvent.click(button)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should not call onSend when input is whitespace only', () => {
    const onSend = vi.fn()
    render(<InputArea {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '   ' } })

    const button = screen.getByRole('button', { name: '送信' })
    fireEvent.click(button)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should send on Enter key press', () => {
    const onSend = vi.fn()
    render(<InputArea {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('Test message')
  })

  it('should not send on Shift+Enter', () => {
    const onSend = vi.fn()
    render(<InputArea {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should disable button when disabled prop is true', () => {
    render(<InputArea {...defaultProps} disabled={true} />)

    const button = screen.getByRole('button', { name: '送信' })
    expect(button).toBeDisabled()
  })

  it('should show character count when approaching limit', () => {
    render(<InputArea {...defaultProps} maxLength={100} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'a'.repeat(81) } })

    expect(screen.getByText('81 / 100')).toBeInTheDocument()
  })

  it('should show error when over character limit', () => {
    render(<InputArea {...defaultProps} maxLength={100} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'a'.repeat(101) } })

    const button = screen.getByRole('button', { name: '送信' })
    expect(button).toBeDisabled()
  })

  it('should render with custom placeholder', () => {
    render(<InputArea {...defaultProps} placeholder="Custom placeholder" />)
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
  })
})

describe('MessageList', () => {
  it('should render null when no messages', () => {
    const { container } = render(<MessageList messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render messages', () => {
    const messages: ChatMessage[] = [
      createMockMessage({ role: 'user', content: 'Hello' }),
      createMockMessage({ role: 'assistant', content: 'Hi there!' }),
    ]
    render(<MessageList messages={messages} />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('should have correct accessibility attributes', () => {
    const messages: ChatMessage[] = [createMockMessage()]
    render(<MessageList messages={messages} />)

    expect(screen.getByRole('log')).toHaveAttribute('aria-label', 'メッセージ一覧')
  })
})

describe('SuggestionChips', () => {
  const defaultProps = {
    suggestions: ['Suggestion 1', 'Suggestion 2', 'Suggestion 3'],
    onSelect: vi.fn(),
  }

  it('should render all suggestions', () => {
    render(<SuggestionChips {...defaultProps} />)

    expect(screen.getByText('Suggestion 1')).toBeInTheDocument()
    expect(screen.getByText('Suggestion 2')).toBeInTheDocument()
    expect(screen.getByText('Suggestion 3')).toBeInTheDocument()
  })

  it('should call onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<SuggestionChips {...defaultProps} onSelect={onSelect} />)

    fireEvent.click(screen.getByText('Suggestion 1'))

    expect(onSelect).toHaveBeenCalledWith('Suggestion 1')
  })

  it('should not call onSelect when disabled', () => {
    const onSelect = vi.fn()
    render(<SuggestionChips {...defaultProps} onSelect={onSelect} disabled={true} />)

    fireEvent.click(screen.getByText('Suggestion 1'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('should disable buttons when disabled prop is true', () => {
    render(<SuggestionChips {...defaultProps} disabled={true} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })
})

describe('TypingIndicator', () => {
  it('should render typing indicator', () => {
    render(<TypingIndicator />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should have correct accessibility attributes', () => {
    render(<TypingIndicator />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'AIが入力中')
  })
})
