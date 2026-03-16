'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'

interface SuggestionChipsProps {
  readonly suggestions: readonly string[]
  readonly onSelect: (suggestion: string) => void
  readonly disabled?: boolean
}

export const SuggestionChips = memo(function SuggestionChips({
  suggestions,
  onSelect,
  disabled = false,
}: SuggestionChipsProps) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="flex max-w-lg flex-wrap justify-center gap-2">
      {suggestions.map((suggestion, index) => (
        <Button
          key={`suggestion-${index}`}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          className="text-sm"
          type="button"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  )
})

SuggestionChips.displayName = 'SuggestionChips'
