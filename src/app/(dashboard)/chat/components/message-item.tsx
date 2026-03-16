'use client'

import { memo, useMemo } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { PersonaIndicator, getPersonaConfig } from './persona-indicator'
import type { ChatMessage } from '@/app/api/chat/types'
import { cn } from '@/lib/utils'

interface MessageItemProps {
  readonly message: ChatMessage
  readonly isLast: boolean
}

const ALLOWED_TAGS = [
  'b',
  'i',
  'u',
  'strong',
  'em',
  'br',
  'p',
  'span',
  'ul',
  'ol',
  'li',
  'a',
  'code',
  'pre',
  'blockquote',
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class']

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORCE_BODY: true,
  })
}

function formatMarkdownToHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
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
    const content = message.content || ''
    const formatted = formatMarkdownToHtml(content)
    return sanitizeHtml(formatted)
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
