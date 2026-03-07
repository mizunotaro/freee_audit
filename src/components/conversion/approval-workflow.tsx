'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, ArrowRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ApprovalStage, ApprovalStatus } from '@/types/conversion'

export interface ApprovalWorkflow {
  id: string
  projectId: string
  stage: ApprovalStage
  status: ApprovalStatus
  assignees: ApprovalAssignee[]
  history: ApprovalHistoryEntry[]
  dueDate?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ApprovalAssignee {
  id: string
  userId: string
  userName: string
  userRole: string
  assignedAt: Date
  isRequired: boolean
  approvedAt?: Date
  comment?: string
}

export interface ApprovalHistoryEntry {
  id: string
  stage: ApprovalStage
  action: 'submit' | 'approve' | 'reject' | 'escalate' | 'comment'
  userId: string
  userName: string
  userRole: string
  comment?: string
  createdAt: Date
}

interface ApprovalWorkflowProps {
  workflow: ApprovalWorkflow
  currentUserId: string
  onApprove: (stage: ApprovalStage, comment?: string) => void
  onReject: (stage: ApprovalStage, reason: string) => void
  onEscalate: (stage: ApprovalStage, reason: string) => void
  onAdvanceStage?: (projectId: string) => void
  isLoading?: boolean
}

const STAGE_CONFIG: Record<ApprovalStage, { label: string; description: string }> = {
  mapping_review: {
    label: 'マッピング確認',
    description: '勘定科目マッピングの妥当性を確認',
  },
  rationale_review: {
    label: '根拠確認',
    description: '変換根拠の完全性を確認',
  },
  adjustment_review: {
    label: '調整仕訳確認',
    description: '調整仕訳の妥当性を確認',
  },
  fs_review: {
    label: '財務諸表確認',
    description: '変換後財務諸表を確認',
  },
  final_approval: {
    label: '最終承認',
    description: 'プロジェクト全体の最終承認',
  },
}

const STATUS_CONFIG: Record<
  ApprovalStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
> = {
  pending: { label: '保留中', variant: 'outline' },
  in_review: { label: 'レビュー中', variant: 'secondary', className: 'bg-blue-100 text-blue-800' },
  approved: { label: '承認済み', variant: 'secondary', className: 'bg-green-100 text-green-800' },
  rejected: { label: '却下', variant: 'destructive' },
  escalated: {
    label: 'エスカレーション',
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800',
  },
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

export function ApprovalWorkflowComponent({
  workflow,
  currentUserId,
  onApprove,
  onReject,
  onEscalate,
  onAdvanceStage,
  isLoading,
}: ApprovalWorkflowProps) {
  const [comment, setComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [escalateReason, setEscalateReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showEscalateDialog, setShowEscalateDialog] = useState(false)

  const stageKeys = Object.keys(STAGE_CONFIG) as ApprovalStage[]
  const currentStageIndex = stageKeys.indexOf(workflow.stage)
  const isAssignee = workflow.assignees.some((a) => a.userId === currentUserId)
  const hasApproved = workflow.assignees.find((a) => a.userId === currentUserId && a.approvedAt)
  const allRequiredApproved = workflow.assignees
    .filter((a) => a.isRequired)
    .every((a) => a.approvedAt)

  const handleApprove = () => {
    onApprove(workflow.stage, comment || undefined)
    setComment('')
  }

  const handleReject = () => {
    if (!rejectReason.trim()) return
    onReject(workflow.stage, rejectReason)
    setRejectReason('')
    setShowRejectDialog(false)
  }

  const handleEscalate = () => {
    if (!escalateReason.trim()) return
    onEscalate(workflow.stage, escalateReason)
    setEscalateReason('')
    setShowEscalateDialog(false)
  }

  const handleAdvance = () => {
    if (onAdvanceStage) {
      onAdvanceStage(workflow.projectId)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          承認ワークフロー
          <StatusBadge status={workflow.status} />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {stageKeys.map((stage, index) => {
            const isCompleted = index < currentStageIndex
            const isCurrent = stage === workflow.stage
            const isPending = index > currentStageIndex

            return (
              <div key={stage} className="flex items-center">
                <div
                  className={cn(
                    'flex min-w-[100px] flex-col items-center rounded-lg p-3',
                    isCompleted && 'border border-green-200 bg-green-50',
                    isCurrent && 'border border-primary bg-primary/10',
                    isPending && 'border border-muted bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isCompleted && 'bg-green-500 text-white',
                      isCurrent && 'bg-primary text-primary-foreground',
                      isPending && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <span>{index + 1}</span>}
                  </div>
                  <span className="mt-1 text-center text-xs">{STAGE_CONFIG[stage].label}</span>
                </div>

                {index < stageKeys.length - 1 && (
                  <ArrowRight className="mx-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
              </div>
            )
          })}
        </div>

        <div className="rounded-lg border p-4">
          <h4 className="mb-2 font-medium">{STAGE_CONFIG[workflow.stage].label}</h4>
          <p className="mb-4 text-sm text-muted-foreground">
            {STAGE_CONFIG[workflow.stage].description}
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {workflow.assignees.map((assignee) => (
              <div
                key={assignee.userId}
                className="flex items-center gap-2 rounded-full bg-muted px-3 py-1"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback>{assignee.userName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{assignee.userName}</span>
                {assignee.approvedAt && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {assignee.isRequired && (
                  <span className="text-xs text-muted-foreground">(必須)</span>
                )}
              </div>
            ))}
          </div>

          {isAssignee && !hasApproved && workflow.status === 'in_review' && (
            <div className="space-y-4">
              <Textarea
                placeholder="承認コメント（任意）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                disabled={isLoading}
              />

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleApprove} disabled={isLoading}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  承認
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isLoading}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  却下
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEscalateDialog(true)}
                  disabled={isLoading}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  エスカレーション
                </Button>
              </div>
            </div>
          )}

          {hasApproved && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">承認済み</span>
            </div>
          )}

          {allRequiredApproved && workflow.status === 'approved' && onAdvanceStage && (
            <div className="mt-4 border-t pt-4">
              <Button onClick={handleAdvance} disabled={isLoading}>
                <ArrowRight className="mr-2 h-4 w-4" />
                次のステージへ進む
              </Button>
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-2 font-medium">承認履歴</h4>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {workflow.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">履歴はありません</p>
              ) : (
                workflow.history.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 rounded border p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{entry.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{entry.userName}</span>
                        <Badge variant="outline">{entry.action}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {STAGE_CONFIG[entry.stage].label}
                        </span>
                      </div>
                      {entry.comment && (
                        <p className="mt-1 text-sm text-muted-foreground">{entry.comment}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>却下理由</DialogTitle>
              <DialogDescription>却下する理由を入力してください</DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="却下理由"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                キャンセル
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                却下
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEscalateDialog} onOpenChange={setShowEscalateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>エスカレーション理由</DialogTitle>
              <DialogDescription>エスカレーションする理由を入力してください</DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="エスカレーション理由"
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEscalateDialog(false)}>
                キャンセル
              </Button>
              <Button variant="outline" onClick={handleEscalate}>
                エスカレーション
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
