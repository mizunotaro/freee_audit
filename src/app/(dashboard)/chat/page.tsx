'use client'

import { useState, useCallback } from 'react'
import { ChatContainer } from './components/chat-container'
import { ChatErrorBoundary } from './components/error-boundary'
import type { ChatMessage, ChatResponse } from '@/app/api/chat/types'

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(new Error('Request timeout')), 60000)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            sessionId: sessionId || undefined,
            context: { language: 'ja' },
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data: ChatResponse = await response.json()

        if (data.success && data.response) {
          setSessionId(data.sessionId)

          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: data.response.summary,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, assistantMessage])
        } else {
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: `エラーが発生しました: ${data.error?.message ?? '不明なエラー'}`,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, errorMessage])
        }
      } catch (error) {
        clearTimeout(timeoutId)

        const errorMessage: ChatMessage = {
          role: 'assistant',
          content:
            error instanceof Error && error.name === 'AbortError'
              ? 'リクエストがタイムアウトしました。もう一度お試しください。'
              : '通信エラーが発生しました。もう一度お試しください。',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId]
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">財務AIアシスタント</h1>
        <p className="text-sm text-muted-foreground">
          公認会計士、税理士、CFO、財務アナリストの視点から分析します
        </p>
      </header>

      <ChatErrorBoundary>
        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
        />
      </ChatErrorBoundary>
    </div>
  )
}
