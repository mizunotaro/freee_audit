'use client'

import * as React from 'react'
import { Save, Eye, Send, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LanguageToggle } from './language-toggle'
import { IRSectionEditor } from './ir-section-editor'
import { IRPreview } from './ir-preview'
import type { IRReport, IRReportSection, Language, ReportStatus } from '@/types/reports/ir-report'

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

const DEFAULT_SECTIONS: Omit<IRReportSection, 'id' | 'order'>[] = [
  {
    type: 'company_overview',
    title: { ja: '会社概要', en: 'Company Overview' },
    content: { ja: '', en: '' },
  },
  {
    type: 'message_from_ceo',
    title: { ja: 'CEOメッセージ', en: 'Message from CEO' },
    content: { ja: '', en: '' },
  },
  {
    type: 'business_overview',
    title: { ja: '事業概要', en: 'Business Overview' },
    content: { ja: '', en: '' },
  },
  {
    type: 'financial_highlights',
    title: { ja: '財務ハイライト', en: 'Financial Highlights' },
    content: { ja: '', en: '' },
  },
  {
    type: 'financial_statements',
    title: { ja: '財務諸表', en: 'Financial Statements' },
    content: { ja: '', en: '' },
  },
  {
    type: 'risk_factors',
    title: { ja: 'リスク要因', en: 'Risk Factors' },
    content: { ja: '', en: '' },
  },
  {
    type: 'corporate_governance',
    title: { ja: 'コーポレートガバナンス', en: 'Corporate Governance' },
    content: { ja: '', en: '' },
  },
  {
    type: 'shareholder_information',
    title: { ja: '株主情報', en: 'Shareholder Information' },
    content: { ja: '', en: '' },
  },
  {
    type: 'sustainability',
    title: { ja: 'サステナビリティ', en: 'Sustainability' },
    content: { ja: '', en: '' },
  },
  {
    type: 'outlook',
    title: { ja: '今後の見通し', en: 'Outlook' },
    content: { ja: '', en: '' },
  },
]

export interface IRReportEditorProps {
  report: IRReport
  onSave?: (report: IRReport) => void | Promise<void>
  onPublish?: (report: IRReport) => void | Promise<void>
  onBack?: () => void
  onLanguageChange?: (language: Language) => void
  readOnly?: boolean
}

export function IRReportEditor({
  report: initialReport,
  onSave,
  onPublish,
  onBack,
  onLanguageChange,
  readOnly = false,
}: IRReportEditorProps) {
  const [report, setReport] = React.useState<IRReport>(initialReport)
  const [activeTab, setActiveTab] = React.useState<'ja' | 'en' | 'preview'>('ja')
  const [isSaving, setIsSaving] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const sections =
    report.sections.length > 0
      ? report.sections
      : DEFAULT_SECTIONS.map((s, i) => ({ ...s, id: `section_${i}`, order: i }))

  const handleLanguageToggle = (language: Language) => {
    onLanguageChange?.(language)
  }

  const handleSectionUpdate = (sectionId: string, updates: Partial<IRReportSection>) => {
    setReport((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
    }))
    setHasUnsavedChanges(true)
    scheduleAutoSave()
  }

  const scheduleAutoSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      handleSave(true)
    }, 3000)
  }

  const handleSave = async (isAutoSave = false) => {
    if (isAutoSave && !hasUnsavedChanges) return

    if (!isAutoSave) setIsSaving(true)

    try {
      await onSave?.(report)
      setLastSaved(new Date())
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      if (!isAutoSave) setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    try {
      await onPublish?.(report)
    } catch (error) {
      console.error('Publish failed:', error)
    }
  }

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const statusConfig = STATUS_CONFIG[report.status]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-semibold">{report.title.ja}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{report.fiscalYear}</span>
              <span>•</span>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              {lastSaved && (
                <>
                  <span>•</span>
                  <span>最終保存: {lastSaved.toLocaleTimeString('ja-JP')}</span>
                </>
              )}
              {hasUnsavedChanges && <span className="text-orange-500">• 未保存</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle
            value={report.language}
            onChange={handleLanguageToggle}
            disabled={readOnly}
          />
          <Separator orientation="vertical" className="h-6" />
          {!readOnly && (
            <>
              <Button variant="outline" onClick={() => handleSave()} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? '保存中...' : '保存'}
              </Button>
              <Button variant="outline" onClick={() => setActiveTab('preview')}>
                <Eye className="mr-2 h-4 w-4" />
                プレビュー
              </Button>
              {report.status === 'approved' && (
                <Button onClick={handlePublish}>
                  <Send className="mr-2 h-4 w-4" />
                  公開
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-1"
      >
        <div className="border-b px-4 pt-2">
          <TabsList>
            <TabsTrigger value="ja">日本語</TabsTrigger>
            <TabsTrigger value="en">English</TabsTrigger>
            <TabsTrigger value="preview">プレビュー</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ja" className="m-0 flex-1">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-6 p-4">
              {sections.map((section) => (
                <IRSectionEditor
                  key={section.id}
                  section={section}
                  language="ja"
                  onUpdate={(updates) => handleSectionUpdate(section.id, updates)}
                  readOnly={readOnly}
                  reportId={report.id}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="en" className="m-0 flex-1">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-6 p-4">
              {sections.map((section) => (
                <IRSectionEditor
                  key={section.id}
                  section={section}
                  language="en"
                  onUpdate={(updates) => handleSectionUpdate(section.id, updates)}
                  readOnly={readOnly}
                  reportId={report.id}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="preview" className="m-0 flex-1">
          <IRPreview
            report={report}
            language={report.language === 'bilingual' ? 'ja' : report.language}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default IRReportEditor
