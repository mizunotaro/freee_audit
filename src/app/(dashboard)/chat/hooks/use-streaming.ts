'use client'

import { useCallback, useRef, useState } from 'react'
import type { StreamChunk } from '@/app/api/chat/types'

interface UseStreamingOptions {
  readonly onChunk?: (chunk: StreamChunk) => void
  readonly onError?: (error: Error) => void
  readonly onComplete?: () => void
  readonly timeoutMs?: number
}

interface UseStreamingReturn {
  readonly connect: (url: string, body?: unknown) => Promise<void>
  readonly disconnect: () => void
  readonly isConnected: boolean
}

const DEFAULT_TIMEOUT_MS = 60000

export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const { onChunk, onError, onComplete, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const connect = useCallback(
    async (url: string, body?: unknown) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort(new Error('Connection timeout'))
      }, timeoutMs)

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        readerRef.current = reader
        setIsConnected(true)
        clearTimeout(timeoutId)

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
                onChunk?.(chunk)

                if (chunk.type === 'done' || chunk.type === 'error') {
                  setIsConnected(false)
                  onComplete?.()
                  return
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE message:', parseError)
              }
            }
          }
        }

        setIsConnected(false)
        onComplete?.()
      } catch (error) {
        clearTimeout(timeoutId)
        setIsConnected(false)
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        const err = error instanceof Error ? error : new Error('Unknown error')
        onError?.(err)
      } finally {
        readerRef.current = null
        abortControllerRef.current = null
      }
    },
    [onChunk, onError, onComplete, timeoutMs]
  )

  const disconnect = useCallback(() => {
    abortControllerRef.current?.abort()
    readerRef.current?.cancel()
    readerRef.current = null
    abortControllerRef.current = null
    setIsConnected(false)
  }, [])

  return {
    connect,
    disconnect,
    isConnected,
  }
}
