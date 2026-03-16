'use client'

import { useState, useCallback, KeyboardEvent, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

interface InputAreaProps {
  readonly onSend: (content: string) => void
  readonly disabled?: boolean
  readonly placeholder?: string
  readonly maxLength?: number
}

const DEFAULT_PLACEHOLDER = '財務に関する質問を入力してください...'
const DEFAULT_MAX_LENGTH = 2000

export function InputArea({
  onSend,
  disabled = false,
  placeholder = DEFAULT_PLACEHOLDER,
  maxLength = DEFAULT_MAX_LENGTH,
}: InputAreaProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (trimmed && !disabled && trimmed.length <= maxLength) {
      onSend(trimmed)
      setInput('')
    }
  }, [input, disabled, onSend, maxLength])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`
    }
  }, [input])

  const charCount = input.length
  const isOverLimit = charCount > maxLength
  const isDisabled = disabled || isOverLimit

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-1">
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="max-h-32 min-h-[44px] resize-none"
          rows={1}
          maxLength={maxLength + 100}
          aria-label="メッセージ入力"
        />
        <Button
          onClick={handleSend}
          disabled={isDisabled || !input.trim()}
          size="icon"
          className="shrink-0"
          type="button"
          aria-label="送信"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {charCount > maxLength * 0.8 && (
        <div
          className={`text-right text-xs ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}
        >
          {charCount} / {maxLength}
        </div>
      )}
    </div>
  )
}
