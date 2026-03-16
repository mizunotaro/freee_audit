'use client'

import { useState, useRef } from 'react'
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'
import { ConversionLayout } from '@/components/conversion/layout'
import { toast } from 'sonner'
import Link from 'next/link'
import type { ChartOfAccounts, MappingType } from '@/types/conversion'

interface ParsedMapping {
  sourceCode: string
  sourceName: string
  targetCode: string
  targetName: string
  mappingType: MappingType
  percentage?: number
  confidence: number
  isValid: boolean
  error?: string
}

export default function BatchMappingsPage() {
  const [sourceCoa] = useState<ChartOfAccounts | null>(null)
  const [targetCoa] = useState<ChartOfAccounts | null>(null)
  const [availableCoas] = useState<ChartOfAccounts[]>([])
  const [selectedTargetCoaId, setSelectedTargetCoaId] = useState<string>('')

  const [parsedMappings, setParsedMappings] = useState<ParsedMapping[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'create' | 'approve' | 'delete' | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const content = e.target?.result as string
      parseCSV(content)
    }
    reader.readAsText(file)
  }

  const parseCSV = (content: string) => {
    const lines = content.split('\n').filter((line) => line.trim())
    if (lines.length < 2) {
      toast.error('CSVファイルにヘッダー行とデータ行が必要です')
      return
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const sourceCodeIndex = header.findIndex(
      (h) => h === 'sourcecode' || h === 'source_code' || h === 'ソースコード'
    )
    const targetCodeIndex = header.findIndex(
      (h) => h === 'targetcode' || h === 'target_code' || h === 'ターゲットコード'
    )
    const mappingTypeIndex = header.findIndex(
      (h) => h === 'mappingtype' || h === 'mapping_type' || h === 'タイプ'
    )
    const percentageIndex = header.findIndex(
      (h) => h === 'percentage' || h === '配分率' || h === '%'
    )

    if (sourceCodeIndex === -1 || targetCodeIndex === -1) {
      toast.error('ソースコードとターゲットコードの列が必要です')
      return
    }

    const sourceItems = sourceCoa?.items || []
    const targetItems = targetCoa?.items || []

    const mappings: ParsedMapping[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim())
      const sourceCode = values[sourceCodeIndex]
      const targetCode = values[targetCodeIndex]
      const mappingType = (values[mappingTypeIndex] || '1to1') as MappingType
      const percentage = percentageIndex !== -1 ? parseFloat(values[percentageIndex]) : undefined

      const sourceItem = sourceItems.find((item) => item.code === sourceCode)
      const targetItem = targetItems.find((item) => item.code === targetCode)

      const isValid = !!sourceItem && !!targetItem
      let error: string | undefined

      if (!sourceItem) {
        error = `ソースコード "${sourceCode}" が見つかりません`
      } else if (!targetItem) {
        error = `ターゲットコード "${targetCode}" が見つかりません`
      }

      mappings.push({
        sourceCode,
        sourceName: sourceItem?.name || '',
        targetCode,
        targetName: targetItem?.name || '',
        mappingType,
        percentage,
        confidence: isValid ? 0.9 : 0,
        isValid,
        error,
      })
    }

    setParsedMappings(mappings)
    toast.success(`${mappings.length}件のマッピングを読み込みました`)
  }

  const handleBatchCreate = async () => {
    if (!sourceCoa || !targetCoa) return

    const validMappings = parsedMappings.filter((m) => m.isValid)
    if (validMappings.length === 0) {
      toast.error('有効なマッピングがありません')
      return
    }

    setProcessing(true)
    setProgress(0)
    setProcessedCount(0)

    const sourceItems = sourceCoa.items || []
    const targetItems = targetCoa.items || []

    let success = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < validMappings.length; i++) {
      const mapping = validMappings[i]
      const sourceItem = sourceItems.find((item) => item.code === mapping.sourceCode)
      const targetItem = targetItems.find((item) => item.code === mapping.targetCode)

      if (!sourceItem || !targetItem) {
        failed++
        errors.push(`${mapping.sourceCode}: 科目が見つかりません`)
        continue
      }

      try {
        const response = await fetch('/api/conversion/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceCoaId: sourceCoa.id,
            sourceItemId: sourceItem.id,
            targetCoaId: targetCoa.id,
            targetItemId: targetItem.id,
            mappingType: mapping.mappingType,
            percentage: mapping.percentage,
          }),
        })

        if (response.ok) {
          success++
        } else {
          const data = await response.json()
          if (data.code === 'DUPLICATE') {
            errors.push(`${mapping.sourceCode}: 既に存在します`)
          } else {
            errors.push(`${mapping.sourceCode}: ${data.error || '作成に失敗'}`)
          }
          failed++
        }
      } catch {
        failed++
        errors.push(`${mapping.sourceCode}: 通信エラー`)
      }

      setProcessedCount(i + 1)
      setProgress(((i + 1) / validMappings.length) * 100)
    }

    setProcessing(false)
    setShowConfirmDialog(false)

    if (failed === 0) {
      toast.success(`${success}件のマッピングを作成しました`)
      setParsedMappings([])
    } else {
      toast.warning(`${success}件成功、${failed}件失敗`)
      console.error('Batch create errors:', errors)
    }
  }

  const handleDownloadTemplate = () => {
    const headers = ['SourceCode', 'TargetCode', 'MappingType', 'Percentage']
    const sampleData = ['1000', '1000', '1to1', '']
    const csv = [headers.join(','), sampleData.join(',')].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'mapping_template.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleConfirm = () => {
    switch (confirmAction) {
      case 'create':
        handleBatchCreate()
        break
    }
  }

  const validCount = parsedMappings.filter((m) => m.isValid).length
  const invalidCount = parsedMappings.length - validCount

  return (
    <ConversionLayout companyId="current">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/conversion/mappings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">一括操作</h1>
            <p className="text-muted-foreground">Batch Operations</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              CSV インポート
            </CardTitle>
            <CardDescription>CSVファイルからマッピングを一括作成します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ソース勘定科目表 (JGAAP)</Label>
                <Input value={sourceCoa?.name || 'JGAAP標準'} disabled />
              </div>
              <div className="space-y-2">
                <Label>ターゲット勘定科目表</Label>
                <Select value={selectedTargetCoaId} onValueChange={setSelectedTargetCoaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="ターゲットCOAを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoas
                      .filter((c) => c.standard !== 'JGAAP')
                      .map((coa) => (
                        <SelectItem key={coa.id} value={coa.id}>
                          {coa.name} ({coa.standard})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedTargetCoaId}
              >
                <Upload className="mr-2 h-4 w-4" />
                CSVファイルを選択
              </Button>
              <Button variant="ghost" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                テンプレートをダウンロード
              </Button>
            </div>
          </CardContent>
        </Card>

        {processing && (
          <Card>
            <CardContent className="py-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    処理中... {processedCount} / {parsedMappings.filter((m) => m.isValid).length}
                  </span>
                  <span className="text-sm font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {parsedMappings.length > 0 && !processing && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>プレビュー</CardTitle>
                  <CardDescription>
                    {validCount}件有効、{invalidCount}件無効
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setConfirmAction('create')
                      setShowConfirmDialog(true)
                    }}
                    disabled={validCount === 0}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {validCount}件を作成
                  </Button>
                  <Button variant="outline" onClick={() => setParsedMappings([])}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    クリア
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">状態</TableHead>
                    <TableHead>ソースコード</TableHead>
                    <TableHead>ソース名</TableHead>
                    <TableHead>ターゲットコード</TableHead>
                    <TableHead>ターゲット名</TableHead>
                    <TableHead>タイプ</TableHead>
                    <TableHead>エラー</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedMappings.slice(0, 100).map((mapping, index) => (
                    <TableRow key={index} className={!mapping.isValid ? 'bg-red-50' : ''}>
                      <TableCell>
                        {mapping.isValid ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1 text-xs">{mapping.sourceCode}</code>
                      </TableCell>
                      <TableCell>{mapping.sourceName || '-'}</TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1 text-xs">{mapping.targetCode}</code>
                      </TableCell>
                      <TableCell>{mapping.targetName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{mapping.mappingType}</Badge>
                      </TableCell>
                      <TableCell>
                        {mapping.error && (
                          <span className="text-sm text-red-600">{mapping.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedMappings.length > 100 && (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  先頭100件のみ表示（全{parsedMappings.length}件）
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>CSVフォーマット</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>CSVファイルには以下の列が必要です:</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>
                  <strong>SourceCode</strong>: ソース勘定科目コード（JGAAP）
                </li>
                <li>
                  <strong>TargetCode</strong>: ターゲット勘定科目コード
                </li>
                <li>
                  <strong>MappingType</strong>: マッピングタイプ（1to1, 1toN, Nto1, complex）
                </li>
                <li>
                  <strong>Percentage</strong>: 配分率（オプション、1toNの場合）
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                一括作成の確認
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {validCount}件のマッピングを作成しますか？
              {invalidCount > 0 && (
                <span className="mt-2 block text-yellow-600">
                  {invalidCount}件の無効なエントリはスキップされます。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>作成</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConversionLayout>
  )
}
