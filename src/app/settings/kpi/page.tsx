'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Trash2, Eye, EyeOff, GripVertical, RefreshCw } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface CustomKPI {
  id: string
  name: string
  formula: string
  category: string
  unit: string
  targetValue: number | null
  isVisible: boolean
  sortOrder: number
}

interface KPITemplate {
  name: string
  formula: string
  category: string
  unit: string
  targetValue?: number
}

const KPI_CATEGORIES = ['収益性', '効率性', '生産性', '安全性', '成長性', 'キャッシュフロー']

const KPI_TEMPLATES: KPITemplate[] = [
  {
    name: '売上高経常利益率',
    formula: 'ordinaryIncome / revenue * 100',
    category: '収益性',
    unit: '%',
    targetValue: 10,
  },
  {
    name: '労働分配率',
    formula: 'laborCost / addedValue * 100',
    category: '効率性',
    unit: '%',
    targetValue: 50,
  },
  {
    name: '付加価値率',
    formula: 'addedValue / revenue * 100',
    category: '生産性',
    unit: '%',
    targetValue: 40,
  },
  {
    name: '資本生産性',
    formula: 'addedValue / totalAssets * 100',
    category: '生産性',
    unit: '%',
    targetValue: 20,
  },
  {
    name: '従業員一人当たり売上高',
    formula: 'revenue / employeeCount',
    category: '生産性',
    unit: '円',
    targetValue: 30000000,
  },
  {
    name: '固定長期適合率',
    formula: 'fixedAssets / (equity + fixedLiabilities) * 100',
    category: '安全性',
    unit: '%',
    targetValue: 100,
  },
  {
    name: 'キャッシュコンバージョンサイクル',
    formula:
      '(inventory / (costOfSales / 365)) + (receivables / (revenue / 365)) - (payables / (costOfSales / 365))',
    category: 'キャッシュフロー',
    unit: '日',
    targetValue: 60,
  },
]

const FORMULA_HELP = `
使用可能な変数:
- revenue: 売上高
- grossProfit: 売上総利益
- operatingIncome: 営業利益
- ordinaryIncome: 経常利益
- netIncome: 当期純利益
- ebit: EBIT
- ebitda: EBITDA
- totalAssets: 総資産
- currentAssets: 流動資産
- fixedAssets: 固定資産
- totalLiabilities: 総負債
- currentLiabilities: 流動負債
- fixedLiabilities: 固定負債
- equity: 純資産
- interestExpense: 支払利息
- depreciation: 減価償却費
- laborCost: 人件費
- addedValue: 付加価値
- employeeCount: 従業員数
- inventory: 棚卸資産
- receivables: 売掛金
- payables: 買掛金
`

function SortableKPIItem({
  kpi,
  onToggleVisibility,
  onDelete,
  onEdit,
}: {
  kpi: CustomKPI
  onToggleVisibility: (id: string, isVisible: boolean) => void
  onDelete: (id: string) => void
  onEdit: (kpi: CustomKPI) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: kpi.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card p-4"
    >
      <button {...attributes} {...listeners} className="cursor-grab rounded p-1 hover:bg-muted">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{kpi.name}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {kpi.category}
          </span>
        </div>
        <p className="truncate font-mono text-sm text-muted-foreground">{kpi.formula}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{kpi.unit}</span>
        {kpi.targetValue !== null && (
          <span className="text-xs text-muted-foreground">目標: {kpi.targetValue}</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleVisibility(kpi.id, !kpi.isVisible)}
        >
          {kpi.isVisible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onEdit(kpi)}>
          編集
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(kpi.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

export default function KPISettingsPage() {
  const [kpis, setKpis] = useState<CustomKPI[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKPI, setEditingKPI] = useState<CustomKPI | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    formula: '',
    category: '収益性',
    unit: '%',
    targetValue: '',
  })
  const [formulaError, setFormulaError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchKPIs()
  }, [])

  const fetchKPIs = async () => {
    try {
      const res = await fetch('/api/kpi/custom')
      if (res.ok) {
        const data = await res.json()
        setKpis(data.kpis || [])
      }
    } catch (error) {
      console.error('Failed to fetch KPIs:', error)
      toast.error('KPIの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleInitializeDefaults = async () => {
    try {
      const res = await fetch('/api/kpi/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.count}件のデフォルトKPIを追加しました`)
        fetchKPIs()
      }
    } catch (error) {
      toast.error('デフォルトKPIの初期化に失敗しました')
    }
  }

  const handleToggleVisibility = async (id: string, isVisible: boolean) => {
    try {
      const res = await fetch('/api/kpi/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateVisibility', id, isVisible }),
      })
      if (res.ok) {
        setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, isVisible } : k)))
      }
    } catch (error) {
      toast.error('表示設定の変更に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このKPIを削除しますか？')) return

    try {
      const res = await fetch(`/api/kpi/custom?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setKpis((prev) => prev.filter((k) => k.id !== id))
        toast.success('KPIを削除しました')
      }
    } catch (error) {
      toast.error('KPIの削除に失敗しました')
    }
  }

  const handleEdit = (kpi: CustomKPI) => {
    setEditingKPI(kpi)
    setFormData({
      name: kpi.name,
      formula: kpi.formula,
      category: kpi.category,
      unit: kpi.unit,
      targetValue: kpi.targetValue?.toString() || '',
    })
    setShowForm(true)
  }

  const validateFormula = async (formula: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/kpi/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', formula }),
      })
      const data = await res.json()
      if (!data.valid) {
        setFormulaError(data.error || '数式が無効です')
        return false
      }
      setFormulaError(null)
      return true
    } catch {
      setFormulaError('数式の検証に失敗しました')
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const isValid = await validateFormula(formData.formula)
    if (!isValid) return

    try {
      const url = '/api/kpi/custom'
      const method = editingKPI ? 'PUT' : 'POST'
      const body = editingKPI
        ? {
            id: editingKPI.id,
            name: formData.name,
            formula: formData.formula,
            category: formData.category,
            unit: formData.unit,
            targetValue: formData.targetValue ? parseFloat(formData.targetValue) : null,
          }
        : {
            name: formData.name,
            formula: formData.formula,
            category: formData.category,
            unit: formData.unit,
            targetValue: formData.targetValue ? parseFloat(formData.targetValue) : null,
            isVisible: true,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(editingKPI ? 'KPIを更新しました' : 'KPIを作成しました')
        setShowForm(false)
        setEditingKPI(null)
        setFormData({ name: '', formula: '', category: '収益性', unit: '%', targetValue: '' })
        fetchKPIs()
      } else {
        const data = await res.json()
        toast.error(data.error || 'KPIの保存に失敗しました')
      }
    } catch (error) {
      toast.error('KPIの保存に失敗しました')
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = kpis.findIndex((k) => k.id === active.id)
      const newIndex = kpis.findIndex((k) => k.id === over.id)
      const newKpis = arrayMove(kpis, oldIndex, newIndex)
      setKpis(newKpis)

      fetch('/api/kpi/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrder',
          updates: newKpis.map((k, i) => ({ id: k.id, sortOrder: i })),
        }),
      })
    }
  }

  const applyTemplate = (template: KPITemplate) => {
    setFormData({
      name: template.name,
      formula: template.formula,
      category: template.category,
      unit: template.unit,
      targetValue: template.targetValue?.toString() || '',
    })
    setShowForm(true)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-screen items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">経営指標設定</h1>
            <p className="text-muted-foreground">カスタムKPIの追加・編集・並べ替え</p>
          </div>
          <div className="flex gap-2">
            {kpis.length === 0 && (
              <Button variant="outline" onClick={handleInitializeDefaults}>
                デフォルトKPIを初期化
              </Button>
            )}
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              KPIを追加
            </Button>
          </div>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingKPI ? 'KPIを編集' : '新しいKPIを追加'}</CardTitle>
              <CardDescription>カスタム指標の計算式を設定します</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">指標名</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例: 売上高経常利益率"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">カテゴリ</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KPI_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formula">計算式</Label>
                  <Textarea
                    id="formula"
                    value={formData.formula}
                    onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                    placeholder="例: ordinaryIncome / revenue * 100"
                    className="font-mono"
                    required
                  />
                  {formulaError && <p className="text-sm text-destructive">{formulaError}</p>}
                  <pre className="overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                    {FORMULA_HELP}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit">単位</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      placeholder="例: %, 円, 倍"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetValue">目標値（任意）</Label>
                    <Input
                      id="targetValue"
                      type="number"
                      value={formData.targetValue}
                      onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                      placeholder="例: 10"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">{editingKPI ? '更新' : '追加'}</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setEditingKPI(null)
                      setFormData({
                        name: '',
                        formula: '',
                        category: '収益性',
                        unit: '%',
                        targetValue: '',
                      })
                    }}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>テンプレートから追加</CardTitle>
            <CardDescription>よく使用される指標テンプレート</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {KPI_TEMPLATES.map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template)}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>登録済みKPI ({kpis.length}件)</CardTitle>
            <CardDescription>ドラッグ＆ドロップで並べ替え</CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                KPIが登録されていません。「デフォルトKPIを初期化」または「KPIを追加」をクリックしてください。
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={kpis.map((k) => k.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {kpis.map((kpi) => (
                      <SortableKPIItem
                        key={kpi.id}
                        kpi={kpi}
                        onToggleVisibility={handleToggleVisibility}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
