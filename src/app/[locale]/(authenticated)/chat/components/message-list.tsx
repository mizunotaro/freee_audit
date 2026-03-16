'use client'

import { memo, useRef, useEffect } from 'react'
import { MessageItem } from './message-item'
import type { ChatMessage } from '@/app/api/chat/types'

interface MessageListProps {
  readonly messages: readonly ChatMessage[]
}

export const MessageList = memo(function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages])

  if (messages.length === 0) {
    return null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4" role="log" aria-label="メッセージ一覧">
      {messages.map((message, index) => (
        <MessageItem
          key={`message-${index}-${message.timestamp ? new Date(message.timestamp).getTime() : ''}`}
          message={message}
          isLast={index === messages.length - 1}
        />
      ))}
      <div ref={endRef} aria-hidden="true" />
    </div>
  )
})

MessageList.displayName = 'MessageList'
