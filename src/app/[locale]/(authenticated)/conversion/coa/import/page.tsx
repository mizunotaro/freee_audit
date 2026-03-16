'use client'

import { useState, useCallback } from 'react'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { ConversionLayout } from '@/components/conversion/layout'
import { toast } from 'sonner'
import Link from 'next/link'

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors?: Array<{ row: number; code: string; error: string }>
  coaId?: string
}

export default function COAImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [standard, setStandard] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]

    if (!validTypes.includes(selectedFile.type)) {
      toast.error('CSVまたはExcelファイルを選択してください')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('ファイルサイズは10MB以下にしてください')
      return
    }

    setFile(selectedFile)
    setResult(null)
  }

  const handleImport = async () => {
    if (!file || !standard) {
      toast.error('会計基準を選択してください')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const format = file.name.endsWith('.csv') ? 'csv' : 'excel'

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch(
        `/api/conversion/coa/import?standardId=${standard}&format=${format}`,
        {
          method: 'POST',
          body: formData,
        }
      )

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        toast.success(`インポート完了: ${data.imported}件`)
      } else {
        toast.error(data.error || 'インポートに失敗しました')
      }
    } catch {
      toast.error('インポートに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = (type: 'csv' | 'excel') => {
    const templateData = `code,name,name_en,category,subcategory,normal_balance,parent_code,is_convertible
1000,現金及び預金,Cash and Cash Equivalents,current_asset,cash,debit,,true
1100,売掛金,Accounts Receivable,current_asset,receivables,debit,,true
1200,棚卸資産,Inventory,current_asset,inventory,debit,,true
2000,建物,Buildings,fixed_asset,property,debit,,true
3000,買掛金,Accounts Payable,current_liability,payables,credit,,true
4000,資本金,Capital Stock,equity,,credit,,true
5000,売上高,Revenue,revenue,,credit,,true
6000,給与手当,Salaries and Wages,sga_expense,labor,debit,,true`

    const blob = new Blob([templateData], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `coa_template.${type}`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ConversionLayout companyId="current">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">勘定科目表インポート</h1>
            <p className="text-muted-foreground">Import Chart of Accounts</p>
          </div>

          <Button variant="outline" asChild>
            <Link href="/conversion/coa">一覧に戻る</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>会計基準</CardTitle>
            <CardDescription>インポートする勘定科目表の会計基準を選択</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={standard} onValueChange={setStandard}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="会計基準を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JGAAP">JGAAP（日本基準）</SelectItem>
                <SelectItem value="USGAAP">USGAAP（米国基準）</SelectItem>
                <SelectItem value="IFRS">IFRS（国際会計基準）</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ファイル選択</CardTitle>
            <CardDescription>CSVまたはExcelファイルをアップロード</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'} ${file ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''} `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-10 w-10 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                    変更
                  </Button>
                </div>
              ) : (
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">ファイルをドラッグ＆ドロップ</p>
                  <p className="mt-1 text-sm text-muted-foreground">または クリックして選択</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    対応形式: CSV, Excel (.xlsx, .xls) / 最大10MB
                  </p>
                </label>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-center text-sm text-muted-foreground">
                  アップロード中... {uploadProgress}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>テンプレート</CardTitle>
            <CardDescription>フォーマットに合わせてデータを準備してください</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => downloadTemplate('csv')}>
                <Download className="mr-2 h-4 w-4" />
                CSVテンプレート
              </Button>
              <Button variant="outline" onClick={() => downloadTemplate('excel')}>
                <Download className="mr-2 h-4 w-4" />
                Excelテンプレート
              </Button>
            </div>

            <div className="mt-4 rounded-lg bg-muted p-4">
              <h4 className="mb-2 font-medium">必要なカラム</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  <code>code</code> - 勘定科目コード（必須）
                </li>
                <li>
                  <code>name</code> - 日本語名称（必須）
                </li>
                <li>
                  <code>name_en</code> - 英語名称（必須）
                </li>
                <li>
                  <code>category</code> - カテゴリ（必須）
                </li>
                <li>
                  <code>normal_balance</code> - 借方/貸方
                </li>
                <li>
                  <code>parent_code</code> - 親コード（階層構造用）
                </li>
                <li>
                  <code>is_convertible</code> - 変換対象フラグ
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                インポート結果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-sm text-muted-foreground">インポート成功</p>
                </div>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                  <p className="text-sm text-muted-foreground">スキップ</p>
                </div>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{result.errors?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">エラー</p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>エラー詳細</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1">
                      {result.errors.slice(0, 5).map((error, i) => (
                        <li key={i} className="text-sm">
                          行 {error.row}: {error.error}
                        </li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-sm text-muted-foreground">
                          他 {result.errors.length - 5}件...
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                {result.coaId && (
                  <Button asChild>
                    <Link href={`/conversion/coa/${result.coaId}`}>詳細を表示</Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null)
                    setResult(null)
                    setUploadProgress(0)
                  }}
                >
                  続けてインポート
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/conversion/coa">キャンセル</Link>
          </Button>
          <Button onClick={handleImport} disabled={!file || !standard || uploading}>
            {uploading ? 'インポート中...' : 'インポート'}
          </Button>
        </div>
      </div>
    </ConversionLayout>
  )
}
