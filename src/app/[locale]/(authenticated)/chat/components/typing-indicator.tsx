'use client'

import { PersonaIndicator } from './persona-indicator'

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3" role="status" aria-label="AIが入力中">
      <PersonaIndicator />
      <div className="rounded-lg bg-muted px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
        </div>
      </div>
    </div>
  )
}
