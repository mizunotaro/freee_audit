'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, PieChart } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type {
  ShareholderComposition,
  CreateShareholderData as _CreateShareholderData,
  UpdateShareholderData as _UpdateShareholderData,
} from '@/types/ir-report'

type ShareholderTypeLabel =
  | 'FINANCIAL_INSTITUTION'
  | 'INDIVIDUAL'
  | 'FOREIGN_INVESTOR'
  | 'OTHER_CORPORATION'
  | 'TREASURY_STOCK'
  | 'OTHER'

const CATEGORY_LABELS: Record<ShareholderTypeLabel, string> = {
  FINANCIAL_INSTITUTION: '金融機関',
  INDIVIDUAL: '個人',
  FOREIGN_INVESTOR: '海外投資家',
  OTHER_CORPORATION: 'その他法人',
  TREASURY_STOCK: '自己株式',
  OTHER: 'その他',
}

const CATEGORY_COLORS: Record<ShareholderTypeLabel, string> = {
  FINANCIAL_INSTITUTION: '#3B82F6',
  INDIVIDUAL: '#10B981',
  FOREIGN_INVESTOR: '#F59E0B',
  OTHER_CORPORATION: '#8B5CF6',
  TREASURY_STOCK: '#6B7280',
  OTHER: '#EC4899',
}

function toCategoryLabel(type: string): ShareholderTypeLabel {
  const upperType = type.toUpperCase().replace(/\s+/g, '_')
  if (upperType in CATEGORY_LABELS) {
    return upperType as ShareholderTypeLabel
  }
  return 'OTHER'
}

export default function ShareholdersPage() {
  const [shareholders, setShareholders] = useState<ShareholderComposition[]>([])
  const [loading, setLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ShareholderComposition | null>(null)
  const [editingShareholder, setEditingShareholder] = useState<ShareholderComposition | null>(null)

  const [formData, setFormData] = useState({
    shareholderType: 'INDIVIDUAL' as ShareholderTypeLabel,
    shareholderName: '',
    sharesHeld: '',
    percentage: '',
  })

  const fetchShareholders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/ir/shareholders?asOfDate=${asOfDate}`, {
        timeout: 30000,
      })

      if (!res.ok) {
        throw new Error('株主データの取得に失敗しました')
      }

      const data = await res.json()
      setShareholders(data.shareholders || [])
    } catch (error) {
      console.error('Failed to fetch shareholders:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('株主データの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [asOfDate])

  useEffect(() => {
    fetchShareholders()
  }, [fetchShareholders])

  const resetForm = () => {
    setFormData({
      shareholderType: 'INDIVIDUAL',
      shareholderName: '',
      sharesHeld: '',
      percentage: '',
    })
    setEditingShareholder(null)
  }

  const handleOpenForm = (shareholder?: ShareholderComposition) => {
    if (shareholder) {
      setEditingShareholder(shareholder)
      setFormData({
        shareholderType: toCategoryLabel(shareholder.shareholderType),
        shareholderName: shareholder.shareholderName ?? '',
        sharesHeld: shareholder.sharesHeld.toString(),
        percentage: shareholder.percentage.toString(),
      })
    } else {
      resetForm()
    }
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const data = {
      companyId: 'default',
      asOfDate: new Date(asOfDate),
      shareholderType: formData.shareholderType,
      shareholderName: formData.shareholderName,
      sharesHeld: parseInt(formData.sharesHeld),
      percentage: parseFloat(formData.percentage),
    }

    try {
      const url = editingShareholder
        ? `/api/ir/shareholders/${editingShareholder.id}`
        : '/api/ir/shareholders'
      const method = editingShareholder ? 'PATCH' : 'POST'

      const res = await fetchWithTimeout(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 30000,
      })

      if (!res.ok) throw new Error('保存に失敗しました')

      toast.success(editingShareholder ? '更新しました' : '追加しました')
      setFormOpen(false)
      resetForm()
      fetchShareholders()
    } catch (error) {
      console.error('Failed to save shareholder:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('保存に失敗しました')
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetchWithTimeout(`/api/ir/shareholders/${deleteTarget.id}`, {
        method: 'DELETE',
        timeout: 30000,
      })

      if (!res.ok) throw new Error('削除に失敗しました')

      toast.success('削除しました')
      fetchShareholders()
    } catch (error) {
      console.error('Failed to delete shareholder:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('削除に失敗しました')
      }
    } finally {
      setDeleteTarget(null)
    }
  }

  const categoryData = shareholders.reduce(
    (acc, s) => {
      const category = toCategoryLabel(s.shareholderType)
      const current = acc[category] || 0
      acc[category] = current + s.percentage
      return acc
    },
    {} as Record<ShareholderTypeLabel, number>
  )

  const pieChartData = Object.entries(categoryData)
    .filter(([, ratio]) => ratio > 0)
    .map(([category, ratio]) => ({
      category: category as ShareholderTypeLabel,
      label: CATEGORY_LABELS[category as ShareholderTypeLabel],
      value: ratio,
      color: CATEGORY_COLORS[category as ShareholderTypeLabel],
    }))
    .sort((a, b) => b.value - a.value)

  const totalShares = shareholders.reduce((sum, s) => sum + s.sharesHeld, 0)

  if (loading) {
    return (
      <AppLayout title="株主構成管理">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-64 rounded bg-gray-200"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="株主構成管理">
      <div className="mb-6">
        <Link
          href="/reports/ir"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          IRレポート一覧に戻る
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="space-y-1">
          <Label htmlFor="asOfDate">基準日</Label>
          <Input
            id="asOfDate"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <div className="ml-auto">
          <Button onClick={() => handleOpenForm()}>
            <Plus className="mr-1 h-4 w-4" />
            株主を追加
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              株主構成比率
            </CardTitle>
            <CardDescription>カテゴリ別の持株比率</CardDescription>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex h-8 overflow-hidden rounded-lg">
                  {pieChartData.map((item, index) => (
                    <div
                      key={item.category}
                      className="h-full transition-all hover:opacity-80"
                      style={{
                        width: `${item.value}%`,
                        backgroundColor: item.color,
                        marginLeft: index > 0 ? '1px' : '0',
                      }}
                      title={`${item.label}: ${item.value.toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {pieChartData.map((item) => (
                    <div key={item.category} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm text-gray-600">
                        {item.label}: {item.value.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">データがありません</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>サマリー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">総発行株数</span>
                <span className="font-bold">{totalShares.toLocaleString()} 株</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">株主数</span>
                <span className="font-bold">{shareholders.length} 名</span>
              </div>
              {pieChartData[0] && (
                <div className="flex justify-between">
                  <span className="text-gray-500">最大株主カテゴリ</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: pieChartData[0].color }}
                    />
                    <span className="font-bold">{pieChartData[0].label}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>株主一覧</CardTitle>
          <CardDescription>
            基準日: {new Date(asOfDate).toLocaleDateString('ja-JP')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    株主名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    カテゴリ
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    株式数
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    持株比率
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {shareholders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  shareholders.map((shareholder) => (
                    <tr key={shareholder.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {shareholder.shareholderName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {CATEGORY_LABELS[toCategoryLabel(shareholder.shareholderType)]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {shareholder.sharesHeld.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {shareholder.percentage.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenForm(shareholder)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(shareholder)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingShareholder ? '株主情報編集' : '株主追加'}</DialogTitle>
              <DialogDescription>株主の情報を入力してください</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="shareholderType">カテゴリ</Label>
                <Select
                  value={formData.shareholderType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, shareholderType: value as ShareholderTypeLabel })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shareholderName">株主名</Label>
                <Input
                  id="shareholderName"
                  value={formData.shareholderName}
                  onChange={(e) => setFormData({ ...formData, shareholderName: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sharesHeld">株式数</Label>
                  <Input
                    id="sharesHeld"
                    type="number"
                    value={formData.sharesHeld}
                    onChange={(e) => setFormData({ ...formData, sharesHeld: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="percentage">持株比率 (%)</Label>
                  <Input
                    id="percentage"
                    type="number"
                    step="0.01"
                    value={formData.percentage}
                    onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>株主の削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.shareholderName}」を削除しますか？ この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
