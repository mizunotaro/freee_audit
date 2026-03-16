'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConversionLayout } from '@/components/conversion/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ChartOfAccountItem, AccountCategory, AccountingStandard } from '@/types/conversion'

interface EditPageProps {
  params: Promise<{ id: string }>
}

const CATEGORY_OPTIONS: { value: AccountCategory; label: string }[] = [
  { value: 'current_asset', label: '流動資産' },
  { value: 'fixed_asset', label: '固定資産' },
  { value: 'deferred_asset', label: '繰延資産' },
  { value: 'current_liability', label: '流動負債' },
  { value: 'fixed_liability', label: '固定負債' },
  { value: 'deferred_liability', label: '繰延負債' },
  { value: 'equity', label: '純資産' },
  { value: 'revenue', label: '収益' },
  { value: 'cogs', label: '売上原価' },
  { value: 'sga_expense', label: '販売費及び一般管理費' },
  { value: 'non_operating_income', label: '営業外収益' },
  { value: 'non_operating_expense', label: '営業外費用' },
  { value: 'extraordinary_income', label: '特別利益' },
  { value: 'extraordinary_loss', label: '特別損失' },
]

export default function COAEditPage({ params }: EditPageProps) {
  const router = useRouter()
  const [id, setId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    standard: 'JGAAP' as AccountingStandard,
    isActive: true,
    items: [] as ChartOfAccountItem[],
  })

  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  const fetchCOA = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/conversion/coa/${id}`)
      if (response.ok) {
        const data = await response.json()
        setFormData({
          name: data.data.name || '',
          description: data.data.description || '',
          standard: data.data.standard || 'JGAAP',
          isActive: data.data.isActive ?? true,
          items: data.data.items || [],
        })
      }
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchCOA()
  }, [id, fetchCOA])

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('名称を入力してください')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/conversion/coa/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('保存しました')
        router.push(`/conversion/coa/${id}`)
      } else {
        const error = await response.json()
        toast.error(error.error || '保存に失敗しました')
      }
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const addItem = () => {
    const newItem: ChartOfAccountItem = {
      id: `temp-${Date.now()}`,
      code: '',
      name: '',
      nameEn: '',
      standard: formData.standard,
      category: 'current_asset',
      normalBalance: 'debit',
      level: 0,
      isConvertible: true,
    }
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }))
  }

  const updateItem = (index: number, field: keyof ChartOfAccountItem, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  return (
    <ConversionLayout companyId="current">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/conversion/coa/${id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">勘定科目表の編集</h1>
              <p className="text-muted-foreground">Edit Chart of Accounts</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/conversion/coa/${id}`}>キャンセル</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>基本情報</CardTitle>
                <CardDescription>勘定科目表の基本情報を設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">名称</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="勘定科目表の名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="standard">会計基準</Label>
                    <Select
                      value={formData.standard}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, standard: value as AccountingStandard }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JGAAP">JGAAP（日本基準）</SelectItem>
                        <SelectItem value="USGAAP">USGAAP（米国基準）</SelectItem>
                        <SelectItem value="IFRS">IFRS（国際会計基準）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">説明</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="勘定科目表の説明"
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <Label htmlFor="isActive">有効</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>勘定科目一覧</CardTitle>
                    <CardDescription>{formData.items.length} 件</CardDescription>
                  </div>
                  <Button size="sm" onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" />
                    追加
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">コード</TableHead>
                        <TableHead>科目名</TableHead>
                        <TableHead>英語名</TableHead>
                        <TableHead className="w-[150px]">カテゴリ</TableHead>
                        <TableHead className="w-[100px]">借/貸</TableHead>
                        <TableHead className="w-[80px]">変換対象</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            勘定科目がありません
                          </TableCell>
                        </TableRow>
                      ) : (
                        formData.items.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Input
                                value={item.code}
                                onChange={(e) => updateItem(index, 'code', e.target.value)}
                                className="h-8 font-mono text-xs"
                                placeholder="1000"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.name}
                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                className="h-8"
                                placeholder="現金及び預金"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.nameEn}
                                onChange={(e) => updateItem(index, 'nameEn', e.target.value)}
                                className="h-8"
                                placeholder="Cash and Cash Equivalents"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateItem(index, 'category', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.normalBalance}
                                onValueChange={(value) => updateItem(index, 'normalBalance', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="debit">借方</SelectItem>
                                  <SelectItem value="credit">貸方</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={item.isConvertible}
                                onCheckedChange={(checked) =>
                                  updateItem(index, 'isConvertible', checked)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ConversionLayout>
  )
}
