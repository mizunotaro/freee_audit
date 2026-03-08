'use client'

import { memo } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { PersonaType } from '@/lib/ai/personas/types'

interface PersonaIndicatorProps {
  readonly persona?: PersonaType
  readonly size?: 'sm' | 'md' | 'lg'
}

const PERSONA_CONFIG: Record<PersonaType, { name: string; color: string; initials: string }> = {
  cpa: { name: '公認会計士', color: 'bg-blue-500', initials: 'CPA' },
  tax_accountant: { name: '税理士', color: 'bg-green-500', initials: '税' },
  cfo: { name: 'CFO', color: 'bg-purple-500', initials: 'CFO' },
  financial_analyst: { name: '財務アナリスト', color: 'bg-orange-500', initials: 'FA' },
} as const

const DEFAULT_CONFIG = { name: 'AI', color: 'bg-gray-500', initials: 'AI' } as const

const SIZE_MAP = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
} as const

export const PersonaIndicator = memo(function PersonaIndicator({
  persona,
  size = 'md',
}: PersonaIndicatorProps) {
  const config = persona && PERSONA_CONFIG[persona] ? PERSONA_CONFIG[persona] : DEFAULT_CONFIG

  return (
    <Avatar className={cn('shrink-0', SIZE_MAP[size])}>
      <AvatarFallback className={cn('text-xs font-medium text-white', config.color)}>
        {config.initials}
      </AvatarFallback>
    </Avatar>
  )
})

PersonaIndicator.displayName = 'PersonaIndicator'

export function PersonaLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      {Object.entries(PERSONA_CONFIG).map(([key, config]) => (
        <div key={key} className="flex items-center gap-1">
          <div className={cn('h-3 w-3 rounded-full', config.color)} />
          <span>{config.name}</span>
        </div>
      ))}
    </div>
  )
}

export function getPersonaConfig(persona?: PersonaType) {
  return persona && PERSONA_CONFIG[persona] ? PERSONA_CONFIG[persona] : DEFAULT_CONFIG
}
