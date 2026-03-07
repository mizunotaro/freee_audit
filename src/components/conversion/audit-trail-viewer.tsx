'use client'

import { useState } from 'react'
import {
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { AuditAction } from '@/types/conversion'

export interface AuditTrailEntry {
  id: string
  projectId: string
  action: AuditAction
  entityType: string
  entityId?: string
  previousValue?: unknown
  newValue?: unknown
  changedFields?: string[]
  userId: string
  userName: string
  userRole: string
  ipAddress: string
  userAgent: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface AuditTrailFilters {
  action?: AuditAction
  entityType?: string
  userId?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface AuditTrailViewerProps {
  projectId: string
  entries: PaginatedResult<AuditTrailEntry>
  filters?: AuditTrailFilters
  onFilterChange: (filters: AuditTrailFilters) => void
  onPageChange: (page: number) => void
  onExport: (format: 'csv' | 'excel' | 'pdf') => void
  onRefresh: () => void
  isLoading?: boolean
}

const ACTION_CONFIG: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
> = {
  project_create: {
    label: 'プロジェクト作成',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800',
  },
  project_update: { label: 'プロジェクト更新', variant: 'outline' },
  project_delete: { label: 'プロジェクト削除', variant: 'destructive' },
  project_execute: {
    label: '変換実行',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800',
  },
  project_abort: { label: '変換中止', variant: 'destructive' },
  mapping_create: { label: 'マッピング作成', variant: 'outline' },
  mapping_update: { label: 'マッピング更新', variant: 'outline' },
  mapping_delete: { label: 'マッピング削除', variant: 'destructive' },
  mapping_approve: {
    label: 'マッピング承認',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800',
  },
  mapping_batch_approve: {
    label: '一括承認',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800',
  },
  rationale_create: { label: '根拠作成', variant: 'outline' },
  rationale_update: { label: '根拠更新', variant: 'outline' },
  rationale_review: {
    label: '根拠レビュー',
    variant: 'secondary',
    className: 'bg-purple-100 text-purple-800',
  },
  adjustment_create: { label: '調整仕訳作成', variant: 'outline' },
  adjustment_update: { label: '調整仕訳更新', variant: 'outline' },
  adjustment_approve: {
    label: '調整仕訳承認',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800',
  },
  approval_submit: { label: '承認依頼', variant: 'outline' },
  approval_approve: {
    label: '承認',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800',
  },
  approval_reject: { label: '却下', variant: 'destructive' },
  approval_escalate: {
    label: 'エスカレーション',
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800',
  },
  export_generate: { label: 'エクスポート', variant: 'outline' },
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  project: 'プロジェクト',
  mapping: 'マッピング',
  rationale: '根拠',
  adjustment: '調整仕訳',
  approval: '承認',
  export: 'エクスポート',
}

export function AuditTrailViewer({
  entries,
  filters,
  onFilterChange,
  onPageChange,
  onExport,
  onRefresh,
  isLoading,
}: AuditTrailViewerProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [localFilters, setLocalFilters] = useState<AuditTrailFilters>(filters ?? {})

  const handleFilterApply = () => {
    onFilterChange(localFilters)
  }

  const handleFilterReset = () => {
    const emptyFilters: AuditTrailFilters = {}
    setLocalFilters(emptyFilters)
    onFilterChange(emptyFilters)
  }

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] ?? { label: action, variant: 'outline' as const }
  }

  const getEntityTypeLabel = (entityType: string) => {
    return ENTITY_TYPE_LABELS[entityType] ?? entityType
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            監査証跡
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="mr-2 h-4 w-4" />
              フィルタ
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
              更新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport('csv')}
              disabled={isLoading}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV出力
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 space-y-4 rounded-lg border p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">アクション</label>
                <Select
                  value={localFilters.action ?? ''}
                  onValueChange={(value) =>
                    setLocalFilters({
                      ...localFilters,
                      action: (value as AuditAction) || undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">すべて</SelectItem>
                    {Object.entries(ACTION_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">エンティティタイプ</label>
                <Select
                  value={localFilters.entityType ?? ''}
                  onValueChange={(value) =>
                    setLocalFilters({ ...localFilters, entityType: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">すべて</SelectItem>
                    {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">ユーザーID</label>
                <Input
                  placeholder="ユーザーID"
                  value={localFilters.userId ?? ''}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, userId: e.target.value || undefined })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleFilterReset}>
                リセット
              </Button>
              <Button size="sm" onClick={handleFilterApply}>
                適用
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px]">
          {entries.data.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">監査ログがありません</div>
          ) : (
            <div className="space-y-2">
              {entries.data.map((entry) => {
                const actionConfig = getActionConfig(entry.action)
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={actionConfig.variant} className={actionConfig.className}>
                          {actionConfig.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {getEntityTypeLabel(entry.entityType)}
                        </span>
                        {entry.entityId && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {entry.entityId}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{entry.userName}</span>
                          <span className="text-xs">({entry.userRole})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(entry.createdAt).toLocaleString('ja-JP')}</span>
                        </div>
                      </div>

                      {entry.changedFields && entry.changedFields.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          変更フィールド: {entry.changedFields.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {entries.pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground">
              全 {entries.pagination.total} 件中{' '}
              {(entries.pagination.page - 1) * entries.pagination.limit + 1} -{' '}
              {Math.min(
                entries.pagination.page * entries.pagination.limit,
                entries.pagination.total
              )}{' '}
              件
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(entries.pagination.page - 1)}
                disabled={entries.pagination.page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                前へ
              </Button>
              <span className="text-sm">
                {entries.pagination.page} / {entries.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(entries.pagination.page + 1)}
                disabled={entries.pagination.page >= entries.pagination.totalPages || isLoading}
              >
                次へ
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
