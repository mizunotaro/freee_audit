'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, ChatResponse, StreamChunk } from '@/app/api/chat/types'

interface UseChatOptions {
  readonly onError?: (error: Error) => void
  readonly onStreamChunk?: (chunk: StreamChunk) => void
  readonly timeoutMs?: number
}

interface UseChatReturn {
  readonly messages: ChatMessage[]
  readonly isLoading: boolean
  readonly sessionId: string
  readonly sendMessage: (content: string) => Promise<void>
  readonly sendStreamingMessage: (content: string) => Promise<void>
  readonly clearMessages: () => void
  readonly error: Error | null
  readonly abort: () => void
}

const DEFAULT_TIMEOUT_MS = 60000

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { onError, onStreamChunk, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsLoading(false)
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        return
      }

      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmedContent,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort(new Error('Request timeout'))
      }, timeoutMs)

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmedContent,
            sessionId: sessionId || undefined,
            context: { language: 'ja' },
          }),
          signal: abortControllerRef.current.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.message ?? `HTTP error! status: ${response.status}`)
        }

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
          throw new Error(data.error?.message ?? 'Request failed')
        }
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        onError?.(error)

        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `エラーが発生しました: ${error.message}`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [sessionId, onError, timeoutMs]
  )

  const sendStreamingMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        return
      }

      const userMessage: ChatMessage = {
        role: 'user',
        content: trimmedContent,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      setError(null)

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort(new Error('Request timeout'))
      }, timeoutMs)

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmedContent,
            sessionId: sessionId || undefined,
            context: { language: 'ja' },
          }),
          signal: abortControllerRef.current.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.message ?? `HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const chunk: StreamChunk = JSON.parse(line.slice(6))
                onStreamChunk?.(chunk)

                if (chunk.type === 'intent') {
                  const data = chunk.data as { sessionId?: string }
                  if (data.sessionId) {
                    setSessionId(data.sessionId)
                  }
                }

                if (chunk.type === 'persona_complete') {
                  const data = chunk.data as { persona: string; conclusion: string }
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: 'assistant',
                      content: `[${data.persona}] ${data.conclusion}`,
                      timestamp: new Date(),
                    },
                  ])
                }

                if (chunk.type === 'error') {
                  const data = chunk.data as { message: string }
                  throw new Error(data.message)
                }
              } catch (parseError) {
                if (parseError instanceof Error && parseError.message !== 'error') {
                  console.warn('Failed to parse chunk:', parseError)
                } else {
                  throw parseError
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        onError?.(error)

        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `エラーが発生しました: ${error.message}`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [sessionId, onError, onStreamChunk, timeoutMs]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setSessionId('')
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    sendStreamingMessage,
    clearMessages,
    error,
    abort,
  }
}
