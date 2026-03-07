'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ConversionStepper, type Step } from './stepper'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import type {
  AccountingStandard,
  ConversionSettings,
  CreateConversionProjectRequest,
} from '@/types/conversion'

interface ChartOfAccountOption {
  id: string
  name: string
  standard: AccountingStandard
}

interface ProjectWizardProps {
  companyId: string
  chartOfAccounts: ChartOfAccountOption[]
}

const WIZARD_STEPS: Step[] = [
  { id: 'basic', label: '基本情報', status: 'current' },
  { id: 'period', label: '期間設定', status: 'pending' },
  { id: 'target', label: 'ターゲット設定', status: 'pending' },
  { id: 'options', label: 'オプション', status: 'pending' },
  { id: 'confirm', label: '確認', status: 'pending' },
]

const TARGET_STANDARDS = [
  { value: 'USGAAP', label: 'US GAAP' },
  { value: 'IFRS', label: 'IFRS' },
]

export function ProjectWizard({ companyId: _companyId, chartOfAccounts }: ProjectWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetStandard: '' as AccountingStandard | '',
    targetCoaId: '',
    periodStart: '',
    periodEnd: '',
    settings: {
      includeJournals: true,
      includeFinancialStatements: true,
      generateAdjustingEntries: true,
      aiAssistedMapping: true,
    } as ConversionSettings,
  })

  const getSteps = (): Step[] => {
    return WIZARD_STEPS.map((step, index) => ({
      ...step,
      status: index < currentStep ? 'completed' : index === currentStep ? 'current' : 'pending',
    }))
  }

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const updateSettings = (updates: Partial<ConversionSettings>) => {
    setFormData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return formData.name.trim().length > 0
      case 1:
        return (
          formData.periodStart && formData.periodEnd && formData.periodStart < formData.periodEnd
        )
      case 2:
        return formData.targetStandard && formData.targetCoaId
      case 3:
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (canProceed() && currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (!canProceed()) return

    setLoading(true)
    setError(null)

    try {
      const request: CreateConversionProjectRequest = {
        name: formData.name,
        description: formData.description || undefined,
        targetStandard: formData.targetStandard as 'USGAAP' | 'IFRS',
        targetCoaId: formData.targetCoaId,
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        settings: formData.settings,
      }

      const res = await fetch('/api/conversion/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create project')
      }

      const data = await res.json()
      router.push(`/conversion/projects/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const filteredCoa = chartOfAccounts.filter((coa) => coa.standard === formData.targetStandard)

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">プロジェクト名 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="例: 2024年度 IFRS変換"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="プロジェクトの目的や備考を入力"
                rows={3}
              />
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart">期間開始日 *</Label>
                <Input
                  id="periodStart"
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => updateFormData({ periodStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">期間終了日 *</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => updateFormData({ periodEnd: e.target.value })}
                />
              </div>
            </div>
            {formData.periodStart &&
              formData.periodEnd &&
              formData.periodStart >= formData.periodEnd && (
                <p className="text-sm text-destructive">
                  期間開始日は期間終了日より前に設定してください
                </p>
              )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetStandard">ターゲット会計基準 *</Label>
              <Select
                value={formData.targetStandard}
                onValueChange={(value) =>
                  updateFormData({ targetStandard: value as AccountingStandard, targetCoaId: '' })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_STANDARDS.map((standard) => (
                    <SelectItem key={standard.value} value={standard.value}>
                      {standard.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetCoaId">ターゲット勘定科目表 *</Label>
              <Select
                value={formData.targetCoaId}
                onValueChange={(value) => updateFormData({ targetCoaId: value })}
                disabled={!formData.targetStandard}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      formData.targetStandard ? '選択してください' : '先に会計基準を選択'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCoa.map((coa) => (
                    <SelectItem key={coa.id} value={coa.id}>
                      {coa.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.targetStandard && filteredCoa.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  選択した基準の勘定科目表がありません。先に勘定科目表を作成してください。
                </p>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>仕訳変換</Label>
                <p className="text-sm text-muted-foreground">期間内の仕訳を変換対象に含める</p>
              </div>
              <Switch
                checked={formData.settings.includeJournals}
                onCheckedChange={(checked) => updateSettings({ includeJournals: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>財務諸表変換</Label>
                <p className="text-sm text-muted-foreground">
                  貸借対照表・損益計算書・CF計算書を生成
                </p>
              </div>
              <Switch
                checked={formData.settings.includeFinancialStatements}
                onCheckedChange={(checked) =>
                  updateSettings({ includeFinancialStatements: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>調整仕訳生成</Label>
                <p className="text-sm text-muted-foreground">基準差異に基づく調整仕訳を自動生成</p>
              </div>
              <Switch
                checked={formData.settings.generateAdjustingEntries}
                onCheckedChange={(checked) => updateSettings({ generateAdjustingEntries: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>AIアシストマッピング</Label>
                <p className="text-sm text-muted-foreground">
                  AIによる勘定科目マッピング推奨を使用
                </p>
              </div>
              <Switch
                checked={formData.settings.aiAssistedMapping}
                onCheckedChange={(checked) => updateSettings({ aiAssistedMapping: checked })}
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="font-medium">プロジェクト設定の確認</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                以下の設定でプロジェクトを作成します。内容を確認して「作成」をクリックしてください。
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">プロジェクト名</dt>
                <dd className="font-medium">{formData.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ターゲット基準</dt>
                <dd className="font-medium">{formData.targetStandard}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">期間開始</dt>
                <dd className="font-medium">{formData.periodStart}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">期間終了</dt>
                <dd className="font-medium">{formData.periodEnd}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">説明</dt>
                <dd className="font-medium">{formData.description || '-'}</dd>
              </div>
            </dl>

            <div className="rounded-lg border p-4">
              <h4 className="mb-3 font-medium">オプション設定</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>仕訳変換: {formData.settings.includeJournals ? '有効' : '無効'}</div>
                <div>
                  財務諸表: {formData.settings.includeFinancialStatements ? '有効' : '無効'}
                </div>
                <div>調整仕訳: {formData.settings.generateAdjustingEntries ? '有効' : '無効'}</div>
                <div>AIマッピング: {formData.settings.aiAssistedMapping ? '有効' : '無効'}</div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <ConversionStepper steps={getSteps()} />

      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[currentStep].label}</CardTitle>
          <CardDescription>
            ステップ {currentStep + 1} / {WIZARD_STEPS.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 0 || loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              戻る
            </Button>

            {currentStep < WIZARD_STEPS.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                次へ
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                作成
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
