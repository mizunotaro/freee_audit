'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface CSVUploadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fiscalYear: number
  onSuccess: () => void
}

interface UploadResult {
  success: boolean
  imported?: number
  errors?: string[]
  message?: string
}

export function CSVUpload({ open, onOpenChange, fiscalYear, onSuccess }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[][]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('CSVファイルを選択してください')
      return
    }

    setFile(selectedFile)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').slice(0, 6)
      const rows = lines.map((line) =>
        line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
      )
      setPreview(rows)
    }
    reader.readAsText(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setResult(null)

    try {
      const content = await file.text()

      const res = await fetch('/api/reports/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          data: {
            csvContent: content,
            fiscalYear,
          },
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setResult({
          success: true,
          imported: data.imported,
        })
        toast.success(`${data.imported}件の予算をインポートしました`)
        onSuccess()
      } else {
        setResult({
          success: false,
          errors: data.errors || [data.error || 'インポートに失敗しました'],
        })
        toast.error('インポートに失敗しました')
      }
    } catch (error) {
      setResult({
        success: false,
        errors: ['ファイルの読み込みに失敗しました'],
      })
      toast.error('ファイルの読み込みに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>CSVアップロード</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6">
            <div className="flex flex-col items-center">
              <Upload className="mb-2 h-10 w-10 text-gray-400" />
              <p className="mb-2 text-sm text-gray-600">
                CSVファイルをドラッグ＆ドロップ、または選択
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button variant="outline" asChild>
                  <span>ファイルを選択</span>
                </Button>
              </label>
              {file && (
                <div className="mt-2 flex items-center text-sm text-gray-600">
                  <FileText className="mr-1 h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>
          </div>

          {preview.length > 0 && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <h4 className="mb-2 text-sm font-medium">プレビュー（先頭5行）</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={i === 0 ? 'font-semibold' : ''}>
                        {row.map((cell, j) => (
                          <td key={j} className="border px-2 py-1">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className={`rounded-lg p-4 ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
              {result.success ? (
                <div className="flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
                  <span className="text-green-800">{result.imported}件をインポートしました</span>
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">エラーが発生しました</span>
                  </div>
                  <ul className="ml-7 list-disc text-sm text-red-700">
                    {result.errors?.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500">
            CSVフォーマット: 月,勘定科目コード,勘定科目名,金額,部門ID（任意）
          </p>
          <a
            href="/api/reports/budget?action=template"
            className="text-sm text-blue-600 hover:underline"
          >
            テンプレートをダウンロード
          </a>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            閉じる
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'アップロード中...' : 'アップロード'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
