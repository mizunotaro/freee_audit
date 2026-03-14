'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { ChatMessage, ChatWidgetState, ChatWidgetPosition, ChatWidgetSize } from '../types'
import { DEFAULT_WIDGET_SIZE, MIN_WIDGET_SIZE, MAX_WIDGET_SIZE } from '../types'
import type { ChatProgressState, ChatProgressStage } from '../config'
import {
  DEFAULT_CHAT_CONFIG,
  PROGRESS_STAGES,
  calculateProgress,
  estimateRemaining,
} from '../config'
import type { ChatResponse } from '@/app/api/chat/types'
import { usePageContext, inferPageTypeFromPath } from '@/contexts/page-context'

const STORAGE_KEY_POSITION = 'chat-widget-position'
const STORAGE_KEY_SIZE = 'chat-widget-size'
const STORAGE_KEY_STATE = 'chat-widget-state'
const STORAGE_KEY_SESSION = 'chat-session'

export interface UseFloatingChatOptions {
  persistState?: boolean
  defaultOpen?: boolean
}

export interface UseFloatingChatReturn {
  state: ChatWidgetState
  position: ChatWidgetPosition
  size: ChatWidgetSize
  messages: ChatMessage[]
  isLoading: boolean
  progress: ChatProgressState | null
  sessionId: string
  unreadCount: number
  open: () => void
  close: () => void
  minimize: () => void
  toggle: () => void
  setPosition: (position: ChatWidgetPosition) => void
  setSize: (size: ChatWidgetSize) => void
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  markAsRead: () => void
}

export function useFloatingChat(options: UseFloatingChatOptions = {}): UseFloatingChatReturn {
  const { persistState = true, defaultOpen = false } = options
  const pathname = usePathname()
  const pageContext = usePageContext()

  const [state, setState] = useState<ChatWidgetState>(() => {
    if (typeof window === 'undefined' || !persistState) return defaultOpen ? 'open' : 'closed'
    const saved = localStorage.getItem(STORAGE_KEY_STATE)
    return (saved as ChatWidgetState) ?? (defaultOpen ? 'open' : 'closed')
  })

  const [position, setPositionState] = useState<ChatWidgetPosition>(() => {
    if (typeof window === 'undefined' || !persistState) return { x: 0, y: 0 }
    const saved = localStorage.getItem(STORAGE_KEY_POSITION)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return { x: 0, y: 0 }
      }
    }
    return { x: 0, y: 0 }
  })

  const [size, setSizeState] = useState<ChatWidgetSize>(() => {
    if (typeof window === 'undefined' || !persistState) return DEFAULT_WIDGET_SIZE
    const saved = localStorage.getItem(STORAGE_KEY_SIZE)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          width: Math.max(MIN_WIDGET_SIZE.width, Math.min(MAX_WIDGET_SIZE.width, parsed.width)),
          height: Math.max(MIN_WIDGET_SIZE.height, Math.min(MAX_WIDGET_SIZE.height, parsed.height)),
        }
      } catch {
        return DEFAULT_WIDGET_SIZE
      }
    }
    return DEFAULT_WIDGET_SIZE
  })

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined' || !persistState) return []
    const saved = localStorage.getItem(STORAGE_KEY_SESSION)
    if (saved) {
      try {
        const session = JSON.parse(saved)
        return session.messages.map((m: ChatMessage) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }))
      } catch {
        return []
      }
    }
    return []
  })

  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<ChatProgressState | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window === 'undefined' || !persistState) return ''
    const saved = localStorage.getItem(STORAGE_KEY_SESSION)
    if (saved) {
      try {
        const session = JSON.parse(saved)
        return session.id ?? ''
      } catch {
        return ''
      }
    }
    return ''
  })

  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (persistState) {
      localStorage.setItem(STORAGE_KEY_STATE, state)
    }
  }, [state, persistState])

  useEffect(() => {
    if (persistState) {
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position))
    }
  }, [position, persistState])

  useEffect(() => {
    if (persistState) {
      localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify(size))
    }
  }, [size, persistState])

  useEffect(() => {
    if (persistState) {
      localStorage.setItem(
        STORAGE_KEY_SESSION,
        JSON.stringify({
          id: sessionId,
          messages,
          updatedAt: new Date().toISOString(),
        })
      )
    }
  }, [sessionId, messages, persistState])

  useEffect(() => {
    const pageType = inferPageTypeFromPath(pathname)
    pageContext.setPageContext({
      pageType,
      pagePath: pathname,
    })
  }, [pathname, pageContext])

  const open = useCallback(() => setState('open'), [])
  const close = useCallback(() => setState('closed'), [])
  const minimize = useCallback(() => setState('minimized'), [])
  const toggle = useCallback(() => {
    setState((prev) => (prev === 'closed' ? 'open' : 'closed'))
  }, [])

  const setPosition = useCallback((newPosition: ChatWidgetPosition) => {
    setPositionState(newPosition)
  }, [])

  const setSize = useCallback((newSize: ChatWidgetSize) => {
    setSizeState({
      width: Math.max(MIN_WIDGET_SIZE.width, Math.min(MAX_WIDGET_SIZE.width, newSize.width)),
      height: Math.max(MIN_WIDGET_SIZE.height, Math.min(MAX_WIDGET_SIZE.height, newSize.height)),
    })
  }, [])

  const updateProgress = useCallback(
    (stage: ChatProgressStage) => {
      const now = Date.now()
      const elapsedMs = now - (progress?.startTime ?? now)
      setProgress({
        stage,
        progress: calculateProgress(stage, elapsedMs),
        message: PROGRESS_STAGES[stage].label,
        subMessage: PROGRESS_STAGES[stage].description,
        startTime: progress?.startTime ?? now,
        estimatedRemainingMs: estimateRemaining(elapsedMs, DEFAULT_CHAT_CONFIG.processingTimeoutMs),
      })
    },
    [progress]
  )

  const startProgressTracking = useCallback(() => {
    const startTime = Date.now()
    setProgress({
      stage: 'connecting',
      progress: 0,
      message: PROGRESS_STAGES.connecting.label,
      subMessage: PROGRESS_STAGES.connecting.description,
      startTime,
    })

    const stages: ChatProgressStage[] = [
      'connecting',
      'analyzing',
      'searching',
      'synthesizing',
      'generating',
    ]
    let stageIndex = 0

    progressIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startTime
      if (stageIndex < stages.length - 1 && elapsedMs > (stageIndex + 1) * 5000) {
        stageIndex++
        updateProgress(stages[stageIndex])
      } else if (stageIndex < stages.length) {
        const currentStage = stages[stageIndex]
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                progress: calculateProgress(currentStage, elapsedMs),
                estimatedRemainingMs: estimateRemaining(
                  elapsedMs,
                  DEFAULT_CHAT_CONFIG.processingTimeoutMs
                ),
              }
            : null
        )
      }
    }, 500)
  }, [updateProgress])

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    setProgress(null)
  }, [])

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)
      startProgressTracking()

      const loadingMessage: ChatMessage = {
        id: `msg-loading-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      }

      setMessages((prev) => [...prev, loadingMessage])

      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(new Error('Request timeout')),
        DEFAULT_CHAT_CONFIG.processingTimeoutMs
      )

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content.trim(),
            sessionId: sessionId || undefined,
            context: {
              language: 'ja',
              pageType: pageContext.pageType,
              pagePath: pageContext.pagePath,
              pageTitle: pageContext.pageTitle,
              financialData: pageContext.financialData,
            },
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data: ChatResponse = await response.json()

        setMessages((prev) => prev.filter((m) => !m.isLoading))

        if (data.success && data.response) {
          setSessionId(data.sessionId)

          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: data.response.summary,
            timestamp: new Date(),
            persona: data.response.personaAnalyses?.[0]?.persona,
          }

          setMessages((prev) => [...prev, assistantMessage])

          if (state !== 'open') {
            setUnreadCount((prev) => prev + 1)
          }
        } else {
          const errorMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `エラーが発生しました: ${data.error?.message ?? '不明なエラー'}`,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, errorMessage])
        }
      } catch (error) {
        clearTimeout(timeoutId)
        setMessages((prev) => prev.filter((m) => !m.isLoading))

        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content:
            error instanceof Error && error.name === 'AbortError'
              ? 'リクエストがタイムアウトしました。もう一度お試しください。'
              : '通信エラーが発生しました。もう一度お試しください。',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        stopProgressTracking()
        setIsLoading(false)
      }
    },
    [sessionId, isLoading, pageContext, state, startProgressTracking, stopProgressTracking]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setSessionId('')
    if (persistState) {
      localStorage.removeItem(STORAGE_KEY_SESSION)
    }
  }, [persistState])

  const markAsRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  return {
    state,
    position,
    size,
    messages,
    isLoading,
    progress,
    sessionId,
    unreadCount,
    open,
    close,
    minimize,
    toggle,
    setPosition,
    setSize,
    sendMessage,
    clearMessages,
    markAsRead,
  }
}
