'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Save, RotateCcw, Info } from 'lucide-react'
import type {
  AnalysisType,
  AnalysisPromptDetail,
  PromptVariable,
} from '@/services/ai/prompt-service'

interface AnalysisTypeInfo {
  type: AnalysisType
  name: string
  description: string
}

const ANALYSIS_TYPES: AnalysisTypeInfo[] = [
  {
    type: 'FINANCIAL_ANALYSIS',
    name: '財務分析',
    description: 'BS/PL/CFデータに基づく総合的な財務分析',
  },
  { type: 'JOURNAL_AUDIT', name: '仕訳監査', description: '個別仕訳の整合性チェック' },
  { type: 'BUDGET_VARIANCE', name: '予実差異分析', description: '予算と実績の差異分析' },
  {
    type: 'CASH_FLOW_FORECAST',
    name: 'キャッシュフロー予測',
    description: '将来のキャッシュフロー予測',
  },
  { type: 'KPI_ANALYSIS', name: 'KPI分析', description: '経営指標の分析と評価' },
  {
    type: 'BOARD_REPORT',
    name: '取締役会報告',
    description: '取締役会向けレポートの分析セクション',
  },
]

function PromptEditor({
  analysisType,
  info,
}: {
  analysisType: AnalysisType
  info: AnalysisTypeInfo
}) {
  const [prompt, setPrompt] = useState<AnalysisPromptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isCustom, setIsCustom] = useState(false)

  useEffect(() => {
    fetchPrompt()
  }, [analysisType])

  const fetchPrompt = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/prompts/${analysisType}`)
      if (res.ok) {
        const data = await res.json()
        setPrompt(data.prompt)
        setIsCustom(data.prompt?.companyId !== null)
      }
    } catch (error) {
      console.error('Failed to fetch prompt:', error)
      toast.error('プロンプトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!prompt) return

    setSaving(true)
    try {
      const res = await fetch(`/api/prompts/${analysisType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prompt.name,
          description: prompt.description,
          systemPrompt: prompt.systemPrompt,
          userPromptTemplate: prompt.userPromptTemplate,
          variables: prompt.variables,
        }),
      })

      if (res.ok) {
        toast.success('プロンプトを保存しました')
        setIsCustom(true)
        fetchPrompt()
      } else {
        const data = await res.json()
        toast.error(data.error || '保存に失敗しました')
      }
    } catch (error) {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('デフォルトのプロンプトに戻しますか？')) return

    try {
      const res = await fetch(`/api/prompts/${analysisType}/reset`, { method: 'POST' })
      if (res.ok) {
        toast.success('デフォルトに戻しました')
        fetchPrompt()
      }
    } catch (error) {
      toast.error('リセットに失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!prompt) {
    return <p className="py-8 text-center text-muted-foreground">プロンプトが見つかりません</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{info.name}</h3>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
        <div className="flex gap-2">
          {isCustom && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              デフォルトに戻す
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>

      {isCustom && (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <Info className="mr-2 inline h-4 w-4" />
          カスタムプロンプトが設定されています
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">プロンプト名</Label>
          <Input
            id="name"
            value={prompt.name}
            onChange={(e) => setPrompt({ ...prompt, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">説明</Label>
          <Input
            id="description"
            value={prompt.description || ''}
            onChange={(e) => setPrompt({ ...prompt, description: e.target.value })}
            placeholder="このプロンプトの説明"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="systemPrompt">システムプロンプト</Label>
          <Textarea
            id="systemPrompt"
            value={prompt.systemPrompt}
            onChange={(e) => setPrompt({ ...prompt, systemPrompt: e.target.value })}
            className="min-h-[200px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">AIの役割や制約条件を定義します</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="userPromptTemplate">ユーザープロンプトテンプレート</Label>
          <Textarea
            id="userPromptTemplate"
            value={prompt.userPromptTemplate}
            onChange={(e) => setPrompt({ ...prompt, userPromptTemplate: e.target.value })}
            className="min-h-[300px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">{`{{変数名}}`}形式で変数を使用できます</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">変数一覧</CardTitle>
            <CardDescription>テンプレートで使用できる変数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {prompt.variables.map((v: PromptVariable, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded border p-2">
                  <code className="rounded bg-muted px-2 py-1 text-sm">{`{{${v.name}}}`}</code>
                  <span className="flex-1 text-sm">{v.description}</span>
                  {v.required ? (
                    <span className="text-xs text-red-500">必須</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">任意</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PromptSettingsPage() {
  const [activeType, setActiveType] = useState<AnalysisType>('FINANCIAL_ANALYSIS')

  return (
    <AppLayout>
      <div className="container mx-auto space-y-6 py-6">
        <div>
          <h1 className="text-3xl font-bold">分析プロンプト設定</h1>
          <p className="text-muted-foreground">各分析機能のプロンプトをカスタマイズ</p>
        </div>

        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as AnalysisType)}>
          <TabsList className="h-auto flex-wrap gap-1">
            {ANALYSIS_TYPES.map((at) => (
              <TabsTrigger
                key={at.type}
                value={at.type}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {at.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {ANALYSIS_TYPES.map((at) => (
            <TabsContent key={at.type} value={at.type} className="mt-6">
              <PromptEditor analysisType={at.type} info={at} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  )
}
