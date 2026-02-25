'use client'

import { useState } from 'react'
import {
  ExportFormat,
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  ExportLanguage,
  ExportCurrency,
  PaperSize,
  Orientation,
} from '@/services/export'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (format: ExportFormat, options: ExportOptions) => Promise<void>
}

const formatLabels: Record<ExportFormat, string> = {
  pdf: 'PDF',
  pptx: 'PowerPoint',
  excel: 'Excel',
  csv: 'CSV',
}

const languageLabels: Record<ExportLanguage, string> = {
  ja: '日本語',
  en: 'English',
  dual: '日英併記',
}

const currencyLabels: Record<ExportCurrency, string> = {
  JPY: '日本円 (JPY)',
  USD: '米ドル (USD)',
  dual: '二通貨表示',
}

const paperSizeLabels: Record<PaperSize, string> = {
  A4: 'A4',
  A3: 'A3',
  Letter: 'レター',
}

const orientationLabels: Record<Orientation, string> = {
  portrait: '縦向き',
  landscape: '横向き',
}

export function ExportModal({ isOpen, onClose, onExport }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await onExport(format, { ...options, format })
      onClose()
    } finally {
      setIsExporting(false)
    }
  }

  const updateOption = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

        <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">エクスポート設定</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">出力形式</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(formatLabels) as ExportFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      format === f
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {formatLabels[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">言語</label>
              <select
                value={options.language}
                onChange={(e) => updateOption('language', e.target.value as ExportLanguage)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(languageLabels) as ExportLanguage[]).map((lang) => (
                  <option key={lang} value={lang}>
                    {languageLabels[lang]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">通貨</label>
              <select
                value={options.currency}
                onChange={(e) => updateOption('currency', e.target.value as ExportCurrency)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(currencyLabels) as ExportCurrency[]).map((curr) => (
                  <option key={curr} value={curr}>
                    {currencyLabels[curr]}
                  </option>
                ))}
              </select>
            </div>

            {format === 'pdf' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      用紙サイズ
                    </label>
                    <select
                      value={options.paperSize}
                      onChange={(e) => updateOption('paperSize', e.target.value as PaperSize)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      {(Object.keys(paperSizeLabels) as PaperSize[]).map((size) => (
                        <option key={size} value={size}>
                          {paperSizeLabels[size]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">向き</label>
                    <select
                      value={options.orientation}
                      onChange={(e) => updateOption('orientation', e.target.value as Orientation)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      {(Object.keys(orientationLabels) as Orientation[]).map((ori) => (
                        <option key={ori} value={ori}>
                          {orientationLabels[ori]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="includeCharts"
                    checked={options.includeCharts}
                    onChange={(e) => updateOption('includeCharts', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="includeCharts" className="ml-2 text-sm text-gray-700">
                    グラフを含める
                  </label>
                </div>
              </>
            )}

            {options.currency === 'dual' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  為替レート (USD/JPY)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={options.exchangeRate || ''}
                  onChange={(e) => updateOption('exchangeRate', parseFloat(e.target.value))}
                  placeholder="149.50"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 rounded-b-lg border-t bg-gray-50 p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isExporting ? 'エクスポート中...' : 'エクスポート'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportModal
