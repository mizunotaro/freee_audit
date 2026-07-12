'use client'

import { memo, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react'
import { useExport, type ExportFormat } from '../hooks/use-export'

interface ExportButtonProps {
  readonly onExport: (format: ExportFormat) => void
  readonly disabled?: boolean
}

const EXPORT_OPTIONS: Array<{ format: ExportFormat; label: string; icon: typeof FileText }> = [
  { format: 'pdf', label: 'PDF', icon: FileText },
  { format: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { format: 'json', label: 'JSON', icon: FileJson },
]

export const ExportButton = memo(function ExportButton({
  onExport,
  disabled = false,
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { isExporting } = useExport()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleExport = async (format: ExportFormat) => {
    onExport(format)
    setIsOpen(false)
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isOpen) {
          setIsOpen(false)
        }
      }}
    >
      <button
        onClick={() => !disabled && !isExporting && setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="export-button-popup"
        aria-busy={isExporting}
        aria-label={isExporting ? 'エクスポート中' : 'エクスポート形式を選択'}
        className={cn(
          'flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm',
          disabled && 'cursor-not-allowed opacity-50',
          !disabled && !isExporting && 'hover:bg-muted'
        )}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span>{isExporting ? 'エクスポート中...' : 'エクスポート'}</span>
      </button>

      {isOpen && (
        <div
          id="export-button-popup"
          role="group"
          aria-label="エクスポート形式を選択"
          className="absolute right-0 top-full z-50 mt-2 min-w-[140px] rounded-lg border bg-background p-2 shadow-lg"
        >
          {EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.format}
                onClick={() => handleExport(option.format)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
