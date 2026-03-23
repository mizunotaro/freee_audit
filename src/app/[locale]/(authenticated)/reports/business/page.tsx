'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import {
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Save,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type {
  BusinessReportData,
  ReportTemplateType,
  KeidanrenBusinessReport,
  BusinessReportStatus,
} from '@/types/reports/business'
import { SIMPLE_REPORT_SECTIONS, KEIDANREN_REPORT_SECTIONS } from '@/types/reports/business'

const defaultSimpleReportData: BusinessReportData = {
  fiscalYear: new Date().getFullYear(),
  companyName: '',
  businessOverview: '',
  businessEnvironment: '',
  managementPolicy: '',
  issuesAndRisks: '',
  researchAndDevelopment: '',
  corporateGovernance: '',
  financialHighlights: '',
}

const defaultKeidanrenReportData: Partial<KeidanrenBusinessReport> = {
  fiscalYear: new Date().getFullYear(),
  companyName: '',
  templateVersion: '2022-11-01',
  templateType: 'keidanren_standard',
  status: 'draft' as BusinessReportStatus,
  companyStatus: {
    businessDescription: { mainBusiness: '', businessSegments: [], recentChanges: '' },
    businessPerformance: {
      revenue: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
      operatingIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
      ordinaryIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
      netIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
      yearOverYear: [],
      analysis: '',
    },
    productionOrders: undefined,
    financialSummary: {
      balanceSheet: {
        totalAssets: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        currentAssets: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        fixedAssets: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        currentLiabilities: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        fixedLiabilities: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        netAssets: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        totalLiabilitiesAndNetAssets: {
          currentYear: 0,
          previousYear: 0,
          change: 0,
          changePercent: 0,
        },
      },
      incomeStatement: {
        revenue: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        costOfSales: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        grossProfit: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        sellingGeneralAdminExpenses: {
          currentYear: 0,
          previousYear: 0,
          change: 0,
          changePercent: 0,
        },
        operatingIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        nonOperatingIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        nonOperatingExpenses: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        ordinaryIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        extraordinaryIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        extraordinaryLoss: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        incomeBeforeTax: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        corporateTax: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        netIncome: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
      },
      cashFlowStatement: {
        operatingActivities: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        investingActivities: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        financingActivities: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        freeCashFlow: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
        cashEquivalentEnd: { currentYear: 0, previousYear: 0, change: 0, changePercent: 0 },
      },
      keyRatios: [],
    },
    riskManagement: { framework: '', majorRisks: [], bcp: '' },
  },
  shares: {
    totalShares: { authorized: 0, issued: 0, treasury: 0, outstanding: 0 },
    shareholdingStructure: { byType: [], concentration: 0 },
    majorShareholders: [],
  },
  stockOptions: { stockAcquisitionRights: [], exerciseStatus: [] },
  officers: {
    directors: [],
    auditors: [],
    compensation: {
      directors: {
        baseCompensation: 0,
        bonus: 0,
        stockCompensation: 0,
        retirementAllowance: 0,
        total: 0,
        numberOfPersons: 0,
      },
      auditors: {
        baseCompensation: 0,
        bonus: 0,
        stockCompensation: 0,
        retirementAllowance: 0,
        total: 0,
        numberOfPersons: 0,
      },
      total: 0,
      policy: '',
    },
    boardMeetings: { heldCount: 0, attendance: [] },
  },
  auditor: {
    name: '',
    firm: '',
    engagementPeriod: { start: new Date(), end: new Date() },
    auditOpinion: { type: 'unqualified', summary: '', reportDate: new Date() },
    auditFees: { auditFee: 0, nonAuditFee: 0, total: 0 },
  },
  internalControl: {
    basicPolicy: '',
    organizationalStructure: { boardOfDirectors: '', auditSystem: '' },
    compliance: { policy: '', training: '', whistleblowing: '' },
    riskManagementSystem: '',
  },
  controlPolicy: { hasPolicy: false, capitalPolicy: '' },
  subsidiary: { isWhollyOwnedSubsidiary: false },
  relatedPartyTransactions: { hasTransactions: false, summary: '', armLengthConfirmation: '' },
  importantMatters: {},
}

type KeidanrenSectionKey =
  | 'companyStatus.businessDescription'
  | 'companyStatus.businessPerformance'
  | 'companyStatus.productionOrders'
  | 'companyStatus.financialSummary'
  | 'companyStatus.riskManagement'
  | 'shares.totalShares'
  | 'shares.shareholdingStructure'
  | 'shares.majorShareholders'
  | 'stockOptions.stockAcquisitionRights'
  | 'officers.directors'
  | 'officers.auditors'
  | 'officers.compensation'
  | 'officers.boardMeetings'
  | 'auditor.info'
  | 'auditor.opinion'
  | 'internalControl.basicPolicy'
  | 'internalControl.organizationalStructure'
  | 'internalControl.compliance'
  | 'controlPolicy.policy'
  | 'subsidiary.info'
  | 'relatedPartyTransactions.info'
  | 'importantMatters.subsequentEvents'
  | 'importantMatters.litigation'

const WIZARD_STEPS = [
  { id: 'template', title: 'テンプレート選択', description: 'ひな型の種類を選択' },
  { id: 'basic', title: '基本情報', description: '会社名・事業年度' },
  { id: 'sections', title: '各項目入力', description: '事業報告書の内容' },
  { id: 'review', title: '確認', description: '入力内容の確認' },
  { id: 'export', title: '出力', description: 'エクスポート' },
]

export default function BusinessReportPage() {
  const [templateType, setTemplateType] = useState<ReportTemplateType>('simple')
  const [currentStep, setCurrentStep] = useState(0)
  const [simpleData, setSimpleData] = useState<BusinessReportData>(defaultSimpleReportData)
  const [keidanrenData, setKeidanrenData] = useState<Partial<KeidanrenBusinessReport>>(
    defaultKeidanrenReportData
  )
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('1')

  const keidanrenSectionContents = useState<Record<string, string>>({})

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100

  const handleSimpleInputChange = (field: keyof BusinessReportData, value: string | number) => {
    setSimpleData((prev) => ({ ...prev, [field]: value }))
  }

  const handleKeidanrenSectionChange = (sectionKey: string, value: string) => {
    keidanrenSectionContents[1]((prev) => ({ ...prev, [sectionKey]: value }))
  }

  const handleGenerateSimpleSection = async (section: keyof BusinessReportData) => {
    setGenerating(true)
    try {
      const res = await fetchWithTimeout('/api/reports/business/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          templateType: 'simple',
          companyName: simpleData.companyName,
          fiscalYear: simpleData.fiscalYear,
        }),
        timeout: 60000,
      })

      if (res.ok) {
        const data = await res.json()
        setSimpleData((prev) => ({ ...prev, [section]: data.content }))
        toast.success('AIによる生成が完了しました')
      } else {
        throw new Error('Failed to generate content')
      }
    } catch (error) {
      console.error('Error generating content:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('生成に失敗しました')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateKeidanrenSection = async (section: KeidanrenSectionKey) => {
    setGenerating(true)
    try {
      const res = await fetchWithTimeout('/api/reports/business/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          templateType: 'keidanren',
          companyName: keidanrenData.companyName,
          fiscalYear: keidanrenData.fiscalYear,
        }),
        timeout: 60000,
      })

      if (res.ok) {
        const data = await res.json()
        handleKeidanrenSectionChange(section, data.content)
        toast.success('AIによる生成が完了しました')
      } else {
        throw new Error('Failed to generate content')
      }
    } catch (error) {
      console.error('Error generating content:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('生成に失敗しました')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetchWithTimeout('/api/reports/business/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType,
          data: templateType === 'simple' ? simpleData : keidanrenData,
        }),
        timeout: 30000,
      })

      if (res.ok) {
        toast.success('保存しました')
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'html' | 'word') => {
    setLoading(true)
    try {
      const res = await fetchWithTimeout('/api/reports/business/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType,
          data: templateType === 'simple' ? simpleData : keidanrenData,
          format,
        }),
        timeout: 60000,
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const extension = format === 'pdf' ? 'pdf' : format === 'word' ? 'docx' : 'html'
        a.download = `business_report_${templateType === 'simple' ? simpleData.fiscalYear : keidanrenData.fiscalYear}.${extension}`
        a.click()
        window.URL.revokeObjectURL(url)
        toast.success('エクスポートが完了しました')
      } else {
        throw new Error('Failed to export')
      }
    } catch (error) {
      console.error('Error exporting:', error)
      toast.error('エクスポートに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true
      case 1: {
        const companyName =
          templateType === 'simple' ? simpleData.companyName : keidanrenData.companyName
        return companyName && companyName.length > 0
      }
      case 2:
        return true
      case 3:
        return true
      default:
        return true
    }
  }

  const renderTemplateSelection = () => (
    <div className="space-y-6">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">テンプレートを選択</h2>
        <p className="text-muted-foreground">事業報告書の形式を選択してください</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card
          className={`cursor-pointer transition-all ${templateType === 'simple' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setTemplateType('simple')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              簡易版（7項目）
            </CardTitle>
            <CardDescription>中小企業向けの簡易的な事業報告書</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>・事業の概要</li>
              <li>・経営環境</li>
              <li>・経営方針</li>
              <li>・課題とリスク</li>
              <li>・財務ハイライト</li>
              <li>・研究開発活動</li>
              <li>・企業統治</li>
            </ul>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${templateType === 'keidanren' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setTemplateType('keidanren')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              経団連ひな型準拠版
            </CardTitle>
            <CardDescription>会社法に基づく正式な事業報告書</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>・株式会社の現況に関する事項</li>
              <li>・株式に関する事項</li>
              <li>・新株予約権等に関する事項</li>
              <li>・会社役員に関する事項</li>
              <li>・会計監査人に関する事項</li>
              <li>・内部統制に関する事項</li>
              <li>・その他5項目</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              ※ 経団連ひな型（2022年11月改訂版）準拠
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderBasicInfo = () => {
    const companyName =
      templateType === 'simple' ? simpleData.companyName : keidanrenData.companyName || ''
    const fiscalYear =
      templateType === 'simple'
        ? simpleData.fiscalYear
        : keidanrenData.fiscalYear || new Date().getFullYear()

    return (
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>会社名と事業年度を入力してください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">会社名</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => {
                if (templateType === 'simple') {
                  handleSimpleInputChange('companyName', e.target.value)
                } else {
                  setKeidanrenData((prev) => ({ ...prev, companyName: e.target.value }))
                }
              }}
              placeholder="株式会社○○"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiscalYear">事業年度</Label>
            <Select
              value={fiscalYear.toString()}
              onValueChange={(v) => {
                const year = parseInt(v)
                if (templateType === 'simple') {
                  handleSimpleInputChange('fiscalYear', year)
                } else {
                  setKeidanrenData((prev) => ({ ...prev, fiscalYear: year }))
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2022, 2023, 2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}年度
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderSimpleSections = () => (
    <div className="space-y-4">
      {SIMPLE_REPORT_SECTIONS.map((section) => (
        <Card key={section.key}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGenerateSimpleSection(section.key)}
                disabled={generating || !simpleData.companyName}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI生成
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={simpleData[section.key]}
              onChange={(e) => handleSimpleInputChange(section.key, e.target.value)}
              rows={6}
              placeholder={section.description}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const renderKeidanrenSections = () => (
    <div className="flex gap-4">
      <div className="w-64 shrink-0">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle className="text-sm">目次</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <nav className="space-y-1">
              {KEIDANREN_REPORT_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 space-y-4">
        {KEIDANREN_REPORT_SECTIONS.map((section) => (
          <div
            key={section.id}
            id={section.id}
            className={activeSection === section.id ? '' : 'hidden'}
          >
            <Card>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.subSections.map((sub) => (
                  <div key={sub.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{sub.title}</Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleGenerateKeidanrenSection(sub.id as KeidanrenSectionKey)
                        }
                        disabled={generating || !keidanrenData.companyName}
                      >
                        <Sparkles className="mr-2 h-3 w-3" />
                        AI生成
                      </Button>
                    </div>
                    <Textarea
                      value={keidanrenSectionContents[0][sub.id] || ''}
                      onChange={(e) => handleKeidanrenSectionChange(sub.id, e.target.value)}
                      rows={4}
                      placeholder={`${sub.title}を入力してください`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )

  const renderReview = () => {
    const companyName =
      templateType === 'simple' ? simpleData.companyName : keidanrenData.companyName
    const fiscalYear = templateType === 'simple' ? simpleData.fiscalYear : keidanrenData.fiscalYear

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>入力内容の確認</CardTitle>
            <CardDescription>以下の内容で事業報告書を作成します</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">会社名:</span>
                <span className="font-medium">{companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">事業年度:</span>
                <span className="font-medium">{fiscalYear}年度</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">テンプレート:</span>
                <span className="font-medium">
                  {templateType === 'simple' ? '簡易版（7項目）' : '経団連ひな型準拠版'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {templateType === 'simple' ? (
          <div className="space-y-2">
            {SIMPLE_REPORT_SECTIONS.map((section) => {
              const content = simpleData[section.key]
              const hasContent = content && content.length > 0
              return (
                <div key={section.key} className="flex items-center gap-2 rounded bg-muted p-2">
                  {hasContent ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="text-sm">{section.title}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {KEIDANREN_REPORT_SECTIONS.map((section) => (
              <div key={section.id} className="flex items-center gap-2 rounded bg-muted p-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{section.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderExport = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>エクスポート</CardTitle>
          <CardDescription>事業報告書を出力します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Button
              onClick={() => handleExport('pdf')}
              disabled={loading}
              className="h-20 flex-col"
            >
              <Download className="mb-2 h-6 w-6" />
              PDF出力
            </Button>
            <Button
              onClick={() => handleExport('html')}
              disabled={loading}
              variant="outline"
              className="h-20 flex-col"
            >
              <Download className="mb-2 h-6 w-6" />
              HTML出力
            </Button>
            <Button
              onClick={() => handleExport('word')}
              disabled={loading}
              variant="outline"
              className="h-20 flex-col"
            >
              <Download className="mb-2 h-6 w-6" />
              Word出力
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderTemplateSelection()
      case 1:
        return renderBasicInfo()
      case 2:
        return templateType === 'simple' ? renderSimpleSections() : renderKeidanrenSections()
      case 3:
        return renderReview()
      case 4:
        return renderExport()
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">事業報告書作成</h1>
          <p className="text-muted-foreground">
            {templateType === 'simple' ? '簡易版' : '経団連ひな型準拠版'}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} variant="outline">
          <Save className="mr-2 h-4 w-4" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{WIZARD_STEPS[currentStep].title}</span>
          <span>
            ステップ {currentStep + 1} / {WIZARD_STEPS.length}
          </span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="flex gap-2 text-sm">
        {WIZARD_STEPS.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(index)}
            className={`rounded-full px-3 py-1 transition-colors ${
              index === currentStep
                ? 'bg-primary text-primary-foreground'
                : index < currentStep
                  ? 'bg-muted text-muted-foreground'
                  : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {step.title}
          </button>
        ))}
      </div>

      {renderStepContent()}

      <div className="flex justify-between border-t pt-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          前へ
        </Button>
        <Button
          onClick={() => setCurrentStep((prev) => Math.min(WIZARD_STEPS.length - 1, prev + 1))}
          disabled={currentStep === WIZARD_STEPS.length - 1 || !canProceed()}
        >
          次へ
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
