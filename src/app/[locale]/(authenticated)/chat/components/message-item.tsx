'use client'

import { memo, useMemo } from 'react'
import { PersonaIndicator, getPersonaConfig } from './persona-indicator'
import type { ChatMessage } from '@/app/api/chat/types'
import { cn } from '@/lib/utils'

interface MessageItemProps {
  readonly message: ChatMessage
  readonly isLast: boolean
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}

function formatTime(date: Date | string | undefined): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export const MessageItem = memo(function MessageItem({
  message,
  isLast: _isLast,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const personaConfig = useMemo(() => getPersonaConfig(message.persona), [message.persona])

  const sanitizedContent = useMemo(() => {
    return escapeHtml(message.content || '')
  }, [message.content])

  const formattedTime = useMemo(() => formatTime(message.timestamp), [message.timestamp])

  return (
    <div
      className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
      role="article"
      aria-label={isUser ? 'ユーザーメッセージ' : `${personaConfig.name}のメッセージ`}
    >
      {!isUser && <PersonaIndicator persona={message.persona} />}

      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {!isUser && message.persona && (
          <div className="mb-1 text-xs font-medium text-muted-foreground">{personaConfig.name}</div>
        )}
        <div
          className="whitespace-pre-wrap break-words text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
        {formattedTime && (
          <div
            className={cn(
              'mt-2 text-xs',
              isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          >
            {formattedTime}
          </div>
        )}
      </div>
    </div>
  )
})

MessageItem.displayName = 'MessageItem'
