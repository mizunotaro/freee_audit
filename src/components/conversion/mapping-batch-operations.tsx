'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { CheckCircle2, Trash2, X } from 'lucide-react'

interface MappingBatchOperationsProps {
  selectedCount: number
  onApprove: () => Promise<void>
  onDelete: () => Promise<void>
  onClear: () => void
}

export function MappingBatchOperations({
  selectedCount,
  onApprove,
  onDelete,
  onClear,
}: MappingBatchOperationsProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      await onApprove()
      setShowApproveDialog(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await onDelete()
      setShowDeleteDialog(false)
    } finally {
      setLoading(false)
    }
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
        <span className="text-sm">{selectedCount}件選択中</span>
        <Button size="sm" onClick={() => setShowApproveDialog(true)} disabled={loading}>
          <CheckCircle2 className="mr-1 h-4 w-4" />
          一括承認
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          disabled={loading}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          一括削除
        </Button>
        <Button size="sm" variant="outline" onClick={onClear} disabled={loading}>
          <X className="mr-1 h-4 w-4" />
          選択解除
        </Button>
      </div>

      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一括承認の確認</AlertDialogTitle>
            <AlertDialogDescription>
              選択した{selectedCount}件のマッピングを承認しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={loading}>
              {loading ? '処理中...' : '承認'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一括削除の確認</AlertDialogTitle>
            <AlertDialogDescription>
              選択した{selectedCount}件のマッピングを削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading} className="bg-destructive">
              {loading ? '処理中...' : '削除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
