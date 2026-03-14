'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Minus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useFloatingChat, useDrag, useResize } from './hooks'
import type { ChatMessage } from './types'
import { WIDGET_POSITION_OFFSET } from './types'
import { ProgressIndicator } from './progress-indicator'

const PERSONA_LABELS: Record<string, string> = {
  cpa: '公認会計士',
  tax_accountant: '税理士',
  cfo: 'CFO',
  financial_analyst: '財務アナリスト',
}

const PERSONA_COLORS: Record<string, string> = {
  cpa: 'bg-blue-500',
  tax_accountant: 'bg-green-500',
  cfo: 'bg-purple-500',
  financial_analyst: 'bg-orange-500',
}

function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  if (message.isLoading) {
    return (
      <div className="flex justify-start">
        <div className="rounded-lg bg-muted px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-muted-foreground">入力中...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className={`text-xs text-white ${message.persona ? PERSONA_COLORS[message.persona] : 'bg-primary'}`}
            >
              {message.persona ? (PERSONA_LABELS[message.persona]?.slice(0, 2) ?? 'AI') : 'AI'}
            </AvatarFallback>
          </Avatar>
        )}
        <div
          className={`rounded-lg px-4 py-2 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          {message.persona && !isUser && (
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              {PERSONA_LABELS[message.persona]}
            </div>
          )}
          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
        </div>
      </div>
    </div>
  )
}

export function FloatingChatWidget() {
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [showMenu, setShowMenu] = useState(false)

  const {
    state,
    position,
    size,
    messages,
    isLoading,
    progress,
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
  } = useFloatingChat({ persistState: true })

  const { dragHandleProps, isDragging } = useDrag({
    initialPosition: position,
    onPositionChange: setPosition,
    boundaryRef: containerRef,
  })

  const { resizeHandleProps, isResizing } = useResize({
    initialSize: size,
    onSizeChange: setSize,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (state === 'open') {
      markAsRead()
      inputRef.current?.focus()
    }
  }, [state, markAsRead])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return
    const message = inputValue.trim()
    setInputValue('')
    await sendMessage(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (state === 'closed') {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button onClick={toggle} className="h-14 w-14 rounded-full shadow-lg" size="icon">
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </div>
    )
  }

  if (state === 'minimized') {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground shadow-lg"
        onClick={open}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-medium">財務AIアシスタント</span>
        {unreadCount > 0 && (
          <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs" variant="destructive">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fixed z-50 overflow-hidden rounded-lg border bg-background shadow-2xl ${
        isDragging || isResizing ? 'select-none' : ''
      }`}
      style={{
        right: WIDGET_POSITION_OFFSET,
        bottom: WIDGET_POSITION_OFFSET,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Header */}
      <div
        {...dragHandleProps}
        className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">財務AIアシスタント</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={(e) => {
              e.stopPropagation()
              minimize()
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" style={{ height: size.height - 180 }}>
        <div className="space-y-4 p-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-sm text-muted-foreground">
              <p className="mb-2">財務AIアシスタントへようこそ</p>
              <p className="text-xs">公認会計士、税理士、CFO、財務アナリストの視点から分析します</p>
            </div>
          )}
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Progress Indicator */}
      {isLoading && progress && <ProgressIndicator progress={progress} />}

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="質問を入力..."
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()} size="sm">
            送信
          </Button>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        {...resizeHandleProps}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, currentColor 50%)',
          opacity: 0.3,
        }}
      />

      {/* Clear Menu */}
      {showMenu && (
        <div className="absolute right-4 top-14 rounded-md border bg-background p-2 shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearMessages()
              setShowMenu(false)
            }}
            className="w-full justify-start text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            会話をクリア
          </Button>
        </div>
      )}
    </div>
  )
}
