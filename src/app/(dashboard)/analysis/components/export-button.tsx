'use client'

import { memo, useState } from 'react'
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

  const handleExport = async (format: ExportFormat) => {
    onExport(format)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && !isExporting && setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className={cn(
          'flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm',
          disabled && 'cursor-not-allowed opacity-50',
          !disabled && !isExporting && 'hover:bg-muted'
        )}
      >
        <Download className="h-4 w-4" />
        <span>{isExporting ? 'エクスポート中...' : 'エクスポート'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[140px] rounded-lg border bg-background p-2 shadow-lg">
          {EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.format}
                onClick={() => handleExport(option.format)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-muted"
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
