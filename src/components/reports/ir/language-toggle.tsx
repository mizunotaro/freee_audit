'use client'

import * as React from 'react'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Language } from '@/types/reports/ir-report'

export interface LanguageToggleProps {
  value: Language
  onChange: (language: Language) => void
  disabled?: boolean
  showLabel?: boolean
}

const LANGUAGE_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'bilingual', label: '日/英', flag: '🌐' },
]

export function LanguageToggle({
  value,
  onChange,
  disabled = false,
  showLabel = true,
}: LanguageToggleProps) {
  const currentLanguage = LANGUAGE_OPTIONS.find((opt) => opt.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Languages className="mr-2 h-4 w-4" />
          {showLabel && (
            <span className="flex items-center gap-1">
              <span>{currentLanguage?.flag}</span>
              <span>{currentLanguage?.label}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={value === option.value ? 'bg-accent' : ''}
          >
            <span className="mr-2">{option.flag}</span>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageToggle
