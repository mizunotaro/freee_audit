'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { FileText, MoreHorizontal, Pencil, Trash2, Eye, Send, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { IRReport, ReportStatus, Language } from '@/types/reports/ir-report'

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: '下書き', variant: 'secondary' },
  in_review: { label: 'レビュー中', variant: 'outline' },
  approved: { label: '承認済み', variant: 'default' },
  published: { label: '公開済み', variant: 'default' },
  archived: { label: 'アーカイブ', variant: 'secondary' },
}

const LANGUAGE_LABELS: Record<Language, string> = {
  ja: '日本語',
  en: '英語',
  bilingual: 'バイリンガル',
}

export interface IRReportListProps {
  reports: IRReport[]
  isLoading?: boolean
  onView?: (report: IRReport) => void
  onEdit?: (report: IRReport) => void
  onDelete?: (report: IRReport) => void
  onDuplicate?: (report: IRReport) => void
  onPublish?: (report: IRReport) => void
  onFilterChange?: (filters: {
    status?: ReportStatus
    language?: Language
    search?: string
  }) => void
}

export function IRReportList({
  reports,
  isLoading = false,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onPublish,
  onFilterChange,
}: IRReportListProps) {
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<ReportStatus | 'all'>('all')
  const [languageFilter, setLanguageFilter] = React.useState<Language | 'all'>('all')

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFilterChange?.({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      language: languageFilter !== 'all' ? languageFilter : undefined,
      search: value || undefined,
    })
  }

  const handleStatusChange = (value: string) => {
    const status = value as ReportStatus | 'all'
    setStatusFilter(status)
    onFilterChange?.({
      status: status !== 'all' ? status : undefined,
      language: languageFilter !== 'all' ? languageFilter : undefined,
      search: search || undefined,
    })
  }

  const handleLanguageChange = (value: string) => {
    const language = value as Language | 'all'
    setLanguageFilter(language)
    onFilterChange?.({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      language: language !== 'all' ? language : undefined,
      search: search || undefined,
    })
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy/MM/dd', { locale: ja })
    } catch {
      return '-'
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>IRレポート一覧</CardTitle>
          <CardDescription>読み込み中...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>IRレポート一覧</CardTitle>
            <CardDescription>{reports.length}件のレポート</CardDescription>
          </div>
        </div>
        <div className="mt-4 flex gap-4">
          <Input
            placeholder="レポートを検索..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={languageFilter} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="言語" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {Object.entries(LANGUAGE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>レポートがありません</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タイトル</TableHead>
                <TableHead>会計年度</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>言語</TableHead>
                <TableHead>更新日</TableHead>
                <TableHead className="w-[70px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const statusConfig = STATUS_CONFIG[report.status]
                return (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="font-medium">{report.title.ja}</div>
                      <div className="text-sm text-muted-foreground">{report.title.en}</div>
                    </TableCell>
                    <TableCell>{report.fiscalYear}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                    </TableCell>
                    <TableCell>{LANGUAGE_LABELS[report.language]}</TableCell>
                    <TableCell>{formatDate(report.metadata.updatedAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView?.(report)}>
                            <Eye className="mr-2 h-4 w-4" />
                            プレビュー
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit?.(report)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicate?.(report)}>
                            <Copy className="mr-2 h-4 w-4" />
                            複製
                          </DropdownMenuItem>
                          {report.status === 'approved' && (
                            <DropdownMenuItem onClick={() => onPublish?.(report)}>
                              <Send className="mr-2 h-4 w-4" />
                              公開
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete?.(report)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default IRReportList
