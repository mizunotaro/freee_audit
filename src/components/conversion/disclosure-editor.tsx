'use client'

import { useState, useCallback } from 'react'
import {
  FileText,
  Sparkles,
  Download,
  Edit,
  CheckCircle2,
  Loader2,
  Languages,
  Eye,
  Save,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { DisclosureDocument } from '@/types/conversion'

interface DisclosureEditorProps {
  projectId: string
  disclosure: DisclosureDocument
  onSave: (disclosure: DisclosureDocument) => Promise<void>
  onEnhance: () => Promise<void>
  onExport: (format: 'pdf' | 'word') => void
  onReview?: () => Promise<void>
}

function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    .replace(/\n/gim, '<br>')
}

export function DisclosureEditor({
  projectId: _projectId,
  disclosure,
  onSave,
  onEnhance,
  onExport,
  onReview,
}: DisclosureEditorProps) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(disclosure.content)
  const [contentEn, setContentEn] = useState(disclosure.contentEn ?? '')
  const [enhancing, setEnhancing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  const handleEnhance = useCallback(async () => {
    setEnhancing(true)
    try {
      await onEnhance()
    } finally {
      setEnhancing(false)
    }
  }, [onEnhance])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave({
        ...disclosure,
        content,
        contentEn,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }, [disclosure, content, contentEn, onSave])

  const handleCancel = useCallback(() => {
    setContent(disclosure.content)
    setContentEn(disclosure.contentEn ?? '')
    setEditing(false)
  }, [disclosure])

  const handleExport = useCallback(
    async (format: 'pdf' | 'word') => {
      setExporting(format)
      try {
        await onExport(format)
      } finally {
        setExporting(null)
      }
    },
    [onExport]
  )

  const handleReview = useCallback(async () => {
    if (onReview) {
      await onReview()
    }
  }, [onReview])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {disclosure.title}
          </CardTitle>
          <div className="flex gap-2">
            {disclosure.isAiEnhanced && (
              <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                <Sparkles className="mr-1 h-3 w-3" />
                AI強化済
              </Badge>
            )}
            {disclosure.reviewedAt && (
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                レビュー済
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="ja">
          <TabsList className="mb-4">
            <TabsTrigger value="ja" className="flex items-center gap-1">
              <Languages className="h-3 w-3" />
              日本語
            </TabsTrigger>
            <TabsTrigger value="en" className="flex items-center gap-1">
              <Languages className="h-3 w-3" />
              English
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              プレビュー
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ja" className="mt-0">
            {editing ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder="開示文書の内容を入力..."
              />
            ) : (
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {content || (
                    <span className="italic text-muted-foreground">内容がありません</span>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="en" className="mt-0">
            {editing ? (
              <Textarea
                value={contentEn}
                onChange={(e) => setContentEn(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder="Enter disclosure content in English..."
              />
            ) : (
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {contentEn || (
                    <span className="italic text-muted-foreground">
                      No English content available
                    </span>
                  )}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="preview" className="mt-0">
            <ScrollArea className="h-[400px] rounded-md border bg-white p-8">
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {disclosure.standardReferences.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <h4 className="mb-2 text-sm font-medium">参照会計基準</h4>
              <div className="flex flex-wrap gap-2">
                {disclosure.standardReferences.map((ref) => (
                  <Badge key={ref.id} variant="outline" className="text-xs">
                    {ref.referenceNumber}: {ref.title}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {disclosure.relatedRationaleIds.length > 0 && (
          <>
            <Separator className="my-4" />
            <div>
              <h4 className="mb-2 text-sm font-medium">関連する変換根拠</h4>
              <p className="text-sm text-muted-foreground">
                {disclosure.relatedRationaleIds.length}件の変換根拠が紐付けられています
              </p>
            </div>
          </>
        )}

        <Separator className="my-4" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnhance}
              disabled={enhancing || editing}
            >
              {enhancing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              AI強化
            </Button>
            {onReview && !disclosure.reviewedAt && (
              <Button variant="outline" size="sm" onClick={handleReview} disabled={editing}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                レビュー
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  保存
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  編集
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('word')}
                  disabled={exporting !== null}
                >
                  {exporting === 'word' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('pdf')}
                  disabled={exporting !== null}
                >
                  {exporting === 'pdf' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  PDF
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            生成日時: {new Date(disclosure.generatedAt).toLocaleString()}
            {disclosure.reviewedAt && (
              <> | レビュー日時: {new Date(disclosure.reviewedAt).toLocaleString()}</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface DisclosureListProps {
  projectId: string
  disclosures: DisclosureDocument[]
  onSelect: (disclosure: DisclosureDocument) => void
  selectedId?: string
}

export function DisclosureList({
  projectId: _projectId,
  disclosures,
  onSelect,
  selectedId,
}: DisclosureListProps) {
  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 p-2">
        {disclosures.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">開示文書がありません</div>
        ) : (
          disclosures.map((disclosure) => (
            <button
              key={disclosure.id}
              onClick={() => onSelect(disclosure)}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent',
                selectedId === disclosure.id && 'border-primary bg-accent'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{disclosure.title}</span>
                <div className="flex gap-1">
                  {disclosure.isAiEnhanced && (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="mr-1 h-2 w-2" />
                      AI
                    </Badge>
                  )}
                  {disclosure.reviewedAt && (
                    <Badge variant="outline" className="bg-green-50 text-xs">
                      <CheckCircle2 className="mr-1 h-2 w-2" />済
                    </Badge>
                  )}
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {disclosure.content.slice(0, 100)}...
              </p>
            </button>
          ))
        )}
      </div>
    </ScrollArea>
  )
}
