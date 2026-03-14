'use client'

import * as React from 'react'
import { Sparkles, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { IRReportSection, ReportSectionType } from '@/types/reports/ir-report'

interface AIGenerationState {
  isGenerating: boolean
  error: string | null
}

export interface IRSectionEditorProps {
  section: IRReportSection
  language: 'ja' | 'en'
  onUpdate: (updates: Partial<IRReportSection>) => void
  readOnly?: boolean
  reportId: string
}

const SECTION_TYPE_LABELS: Record<ReportSectionType, string> = {
  company_overview: '会社概要',
  message_from_ceo: 'CEOメッセージ',
  business_overview: '事業概要',
  financial_highlights: '財務ハイライト',
  financial_statements: '財務諸表',
  risk_factors: 'リスク要因',
  corporate_governance: 'コーポレートガバナンス',
  shareholder_information: '株主情報',
  sustainability: 'サステナビリティ',
  outlook: '今後の見通し',
  faq: 'FAQ',
}

export function IRSectionEditor({
  section,
  language,
  onUpdate,
  readOnly = false,
  reportId,
}: IRSectionEditorProps) {
  const [showPreview, setShowPreview] = React.useState(false)
  const [aiState, setAiState] = React.useState<AIGenerationState>({
    isGenerating: false,
    error: null,
  })

  const content = section.content[language]
  const title = section.title[language]
  const sectionLabel = SECTION_TYPE_LABELS[section.type]

  const handleContentChange = (value: string) => {
    onUpdate({
      content: {
        ...section.content,
        [language]: value,
      },
    })
  }

  const handleAIGenerate = async () => {
    setAiState({ isGenerating: true, error: null })

    try {
      const response = await fetch(`/api/reports/ir/${reportId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: section.type,
          language,
        }),
      })

      if (!response.ok) {
        throw new Error('AI generation failed')
      }

      const result = await response.json()

      if (result.success && result.content) {
        onUpdate({
          content: {
            ...section.content,
            [language]: result.content[language],
          },
        })
      } else {
        throw new Error(result.error || 'AI generation failed')
      }
    } catch (error) {
      setAiState({
        isGenerating: false,
        error: error instanceof Error ? error.message : 'AI generation failed',
      })
      return
    }

    setAiState({ isGenerating: false, error: null })
  }

  const renderPreview = (markdown: string) => {
    const lines = markdown.split('\n')
    return lines.map((line, i) => {
      if (line.startsWith('## ')) {
        return (
          <h2 key={i} className="mb-2 mt-4 text-xl font-bold">
            {line.replace('## ', '')}
          </h2>
        )
      }
      if (line.startsWith('### ')) {
        return (
          <h3 key={i} className="mb-1 mt-3 text-lg font-semibold">
            {line.replace('### ', '')}
          </h3>
        )
      }
      if (line.startsWith('- ')) {
        return (
          <li key={i} className="ml-4">
            {line.replace('- ', '')}
          </li>
        )
      }
      if (line.trim() === '') {
        return <br key={i} />
      }
      return (
        <p key={i} className="mb-2">
          {line}
        </p>
      )
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {sectionLabel}
            </Badge>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? (
                  <>
                    <EyeOff className="mr-1 h-3 w-3" />
                    編集
                  </>
                ) : (
                  <>
                    <Eye className="mr-1 h-3 w-3" />
                    プレビュー
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAIGenerate}
                disabled={aiState.isGenerating}
              >
                {aiState.isGenerating ? (
                  <>
                    <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI生成
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        {aiState.error && <p className="mt-2 text-sm text-destructive">{aiState.error}</p>}
      </CardHeader>
      <CardContent>
        {showPreview ? (
          <div className="prose prose-sm min-h-[200px] max-w-none rounded-md border bg-muted/30 p-4">
            {content ? (
              renderPreview(content)
            ) : (
              <p className="text-muted-foreground">コンテンツがありません</p>
            )}
          </div>
        ) : readOnly ? (
          <div className="prose prose-sm min-h-[200px] max-w-none rounded-md border bg-muted/30 p-4">
            {content ? (
              renderPreview(content)
            ) : (
              <p className="text-muted-foreground">コンテンツがありません</p>
            )}
          </div>
        ) : (
          <Textarea
            placeholder={`${title}の内容を入力...（Markdown形式）`}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            disabled={aiState.isGenerating}
          />
        )}
        {aiState.isGenerating && (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default IRSectionEditor
