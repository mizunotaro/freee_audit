'use client'

import { memo, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Calendar } from 'lucide-react'
import type { FiscalPeriod } from '../hooks/use-analysis'

interface PeriodSelectorProps {
  readonly value: FiscalPeriod
  readonly onChange: (period: FiscalPeriod) => void
  readonly disabled?: boolean
}

export const PeriodSelector = memo(function PeriodSelector({
  value,
  onChange,
  disabled = false,
}: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const months = [3, 6, 9, 12]

  const formatPeriod = (period: FiscalPeriod): string => {
    return `${period.fiscalYear}年度 ${period.month}月期`
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm',
          disabled && 'cursor-not-allowed opacity-50',
          !disabled && 'hover:bg-muted'
        )}
      >
        <Calendar className="h-4 w-4" />
        <span>{formatPeriod(value)}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-lg border bg-background p-4 shadow-lg">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs text-muted-foreground">年度</label>
              <div className="grid grid-cols-3 gap-1">
                {years.map((year) => (
                  <button
                    key={year}
                    onClick={() => {
                      onChange({ ...value, fiscalYear: year })
                    }}
                    className={cn(
                      'rounded px-2 py-1 text-xs',
                      value.fiscalYear === year
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-muted-foreground">月</label>
              <div className="grid grid-cols-4 gap-1">
                {months.map((month) => (
                  <button
                    key={month}
                    onClick={() => {
                      onChange({ ...value, month })
                      setIsOpen(false)
                    }}
                    className={cn(
                      'rounded px-2 py-1 text-xs',
                      value.month === month
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    {month}月
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
