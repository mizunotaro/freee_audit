'use client'

import { useRef, useEffect } from 'react'
import { MessageList } from './message-list'
import { InputArea } from './input-area'
import { TypingIndicator } from './typing-indicator'
import { SuggestionChips } from './suggestion-chips'
import type { ChatMessage } from '@/app/api/chat/types'

interface ChatContainerProps {
  readonly messages: readonly ChatMessage[]
  readonly isLoading: boolean
  readonly onSendMessage: (content: string) => void
  readonly suggestions?: readonly string[]
  readonly placeholder?: string
}

const DEFAULT_SUGGESTIONS = [
  '今期の決算書を分析して',
  'キャッシュフローの状況は？',
  '節税対策を教えて',
  '安全性比率を評価して',
] as const

export function ChatContainer({
  messages,
  isLoading,
  onSendMessage,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSuggestionSelect = (suggestion: string) => {
    if (!isLoading) {
      onSendMessage(suggestion)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-8">
              <h2 className="mb-2 text-xl font-semibold">財務分析AIアシスタント</h2>
              <p className="max-w-md text-muted-foreground">
                財務に関するご質問をお聞かせください。 複数の専門家の視点から分析いたします。
              </p>
            </div>
            <SuggestionChips
              suggestions={suggestions}
              onSelect={handleSuggestionSelect}
              disabled={isLoading}
            />
          </div>
        ) : (
          <>
            <MessageList messages={messages} />
            {isLoading && <TypingIndicator />}
          </>
        )}
      </div>

      <div className="border-t p-4">
        <InputArea onSend={onSendMessage} disabled={isLoading} placeholder={placeholder} />
      </div>
    </div>
  )
}
