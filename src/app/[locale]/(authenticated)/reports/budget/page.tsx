'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { BudgetVsActualHorizontalChart } from '@/components/charts/BudgetVsActualChart'
import { BudgetForm } from '@/components/budget/BudgetForm'
import { CSVUpload } from '@/components/budget/CSVUpload'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
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
import { formatCurrency, formatPercent } from '@/lib/utils'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { BudgetRecord, BudgetVsActual, DetailedBudget, VarianceData } from '@/types/reports'

export default function BudgetPage() {
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActual | null>(null)
  const [detailedBudget, setDetailedBudget] = useState<DetailedBudget | null>(null)
  const [variance, setVariance] = useState<VarianceData | null>(null)
  const [budgets, setBudgets] = useState<BudgetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const [formOpen, setFormOpen] = useState(false)
  const [csvOpen, setCSVOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BudgetRecord | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [varianceResult, budgetsResult, detailedResult] = await Promise.allSettled([
        fetchWithTimeout(
          `/api/reports/budget?action=variance&fiscalYear=${fiscalYear}&month=${month}`,
          { timeout: 30000 }
        ),
        fetchWithTimeout(`/api/reports/budget?fiscalYear=${fiscalYear}&month=${month}`, {
          timeout: 30000,
        }),
        fetchWithTimeout(
          `/api/reports/budget?action=detailed&fiscalYear=${fiscalYear}&month=${month}`,
          { timeout: 30000 }
        ),
      ])

      if (varianceResult.status === 'fulfilled') {
        const varianceData = await varianceResult.value.json()
        setBudgetVsActual(varianceData.budgetVsActual)
        setVariance(varianceData.variance)
      } else {
        if (varianceResult.reason instanceof FetchTimeoutError) {
          toast.error('差異データの取得がタイムアウトしました')
        } else {
          console.error('Failed to fetch variance:', varianceResult.reason)
        }
      }

      if (budgetsResult.status === 'fulfilled') {
        const budgetsData = await budgetsResult.value.json()
        setBudgets(budgetsData.budgets || [])
      } else {
        if (budgetsResult.reason instanceof FetchTimeoutError) {
          toast.error('予算一覧の取得がタイムアウトしました')
        } else {
          console.error('Failed to fetch budgets:', budgetsResult.reason)
        }
      }

      if (detailedResult.status === 'fulfilled') {
        const detailedData = await detailedResult.value.json()
        setDetailedBudget(detailedData)
      } else {
        if (detailedResult.reason instanceof FetchTimeoutError) {
          toast.error('詳細データの取得がタイムアウトしました')
        } else {
          console.error('Failed to fetch detailed budget:', detailedResult.reason)
        }
      }
    } catch (error) {
      console.error('Failed to fetch budget:', error)
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = () => {
    setEditingBudget(null)
    setFormOpen(true)
  }

  const handleEdit = (budget: BudgetRecord) => {
    setEditingBudget(budget)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetchWithTimeout(`/api/reports/budget?id=${deleteTarget.id}`, {
        method: 'DELETE',
        timeout: 30000,
      })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('予算を削除しました')
      fetchData()
    } catch (error) {
      console.error('Failed to delete budget:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('削除に失敗しました')
      }
    } finally {
      setDeleteTarget(null)
    }
  }

  const chartData =
    budgetVsActual?.items.slice(0, 8).map((item) => ({
      name:
        item.accountName.length > 6 ? item.accountName.substring(0, 6) + '...' : item.accountName,
      budget: item.budgetAmount,
      actual: item.actualAmount,
      variance: item.variance,
    })) || []

  const getStatusBadge = (status: 'good' | 'warning' | 'bad') => {
    switch (status) {
      case 'good':
        return <Badge className="bg-green-100 text-green-800">良好</Badge>
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">注意</Badge>
      case 'bad':
        return <Badge className="bg-red-100 text-red-800">要改善</Badge>
    }
  }

  if (loading) {
    return (
      <AppLayout title="予実管理">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-32 rounded bg-gray-200"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="予実管理">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(parseInt(e.target.value))}
          className="focus:border-primary-500 focus:ring-primary-500 rounded-md border-gray-300 shadow-sm"
        >
          {[2022, 2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>
              {y}年度
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="focus:border-primary-500 focus:ring-primary-500 rounded-md border-gray-300 shadow-sm"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <Button onClick={handleCreate} size="sm">
            <Plus className="mr-1 h-4 w-4" />
            新規登録
          </Button>
          <Button onClick={() => setCSVOpen(true)} variant="outline" size="sm">
            <Upload className="mr-1 h-4 w-4" />
            CSVアップロード
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stage" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stage">段階損益レベル</TabsTrigger>
          <TabsTrigger value="account">勘定科目レベル</TabsTrigger>
          <TabsTrigger value="chart">グラフ</TabsTrigger>
          <TabsTrigger value="list">予算一覧</TabsTrigger>
        </TabsList>

        <TabsContent value="stage">
          {detailedBudget && (
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-medium text-gray-900">段階損益レベル比較</h3>
                <p className="text-sm text-gray-500">各段階ごとの予実比較を表示</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        段階
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        予算
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        実績
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        差異
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        達成率
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                        状態
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {detailedBudget.stageLevel.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {item.stage}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-600">
                          {formatCurrency(item.budget)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(item.actual)}
                        </td>
                        <td
                          className={`px-6 py-4 text-right text-sm font-medium ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {item.variance >= 0 ? '+' : ''}
                          {formatCurrency(item.variance)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-600">
                          {item.rate.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-center">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="account">
          {detailedBudget && (
            <div className="overflow-hidden rounded-lg bg-white shadow">
              <div className="border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-medium text-gray-900">勘定科目レベル比較</h3>
                <p className="text-sm text-gray-500">各勘定科目ごとの予実比較を表示</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        コード
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        勘定科目名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                        区分
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        予算
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        実績
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        差異
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                        達成率
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                        状態
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {detailedBudget.accountLevel.map((item) => (
                      <tr key={item.code}>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.code}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.category === 'revenue'
                            ? '収益'
                            : item.category === 'cost_of_sales'
                              ? '原価'
                              : '販管費'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-600">
                          {formatCurrency(item.budget)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(item.actual)}
                        </td>
                        <td
                          className={`px-6 py-4 text-right text-sm font-medium ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {item.variance >= 0 ? '+' : ''}
                          {formatCurrency(item.variance)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-600">
                          {item.rate.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-center">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chart">
          {budgetVsActual && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">予実対比グラフ</h3>
                <BudgetVsActualHorizontalChart data={chartData} height={300} />
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">重要差異分析</h3>
                {variance && variance.significantVariances.length > 0 ? (
                  <div className="space-y-3">
                    {variance.significantVariances.slice(0, 5).map((v, i) => (
                      <div
                        key={i}
                        className={`rounded-lg p-3 ${v.type === 'over' ? 'bg-green-50' : 'bg-red-50'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{v.accountName}</span>
                          <span
                            className={`text-sm font-bold ${v.type === 'over' ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {v.variancePercent > 0 ? '+' : ''}
                            {formatPercent(v.variancePercent)}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          予算: {formatCurrency(v.budget)} → 実績: {formatCurrency(v.actual)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">大きな差異はありません</div>
                )}
              </div>

              <div className="lg:col-span-2">
                <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-2 text-sm font-medium text-gray-500">売上高</h3>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatCurrency(budgetVsActual.totals.revenue.actual)}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          予算 {formatCurrency(budgetVsActual.totals.revenue.budget)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center">
                      <div
                        className={`text-sm font-medium ${budgetVsActual.totals.revenue.rate >= 100 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        達成率 {formatPercent(budgetVsActual.totals.revenue.rate)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-2 text-sm font-medium text-gray-500">経費</h3>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatCurrency(budgetVsActual.totals.expenses.actual)}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          予算 {formatCurrency(budgetVsActual.totals.expenses.budget)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center">
                      <div
                        className={`text-sm font-medium ${budgetVsActual.totals.expenses.rate <= 100 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        使用率 {formatPercent(budgetVsActual.totals.expenses.rate)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-2 text-sm font-medium text-gray-500">営業利益</h3>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatCurrency(budgetVsActual.totals.operatingIncome.actual)}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          予算 {formatCurrency(budgetVsActual.totals.operatingIncome.budget)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center">
                      <div
                        className={`text-sm font-medium ${budgetVsActual.totals.operatingIncome.rate >= 100 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        達成率 {formatPercent(budgetVsActual.totals.operatingIncome.rate)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list">
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-medium text-gray-900">
                予算一覧（{fiscalYear}年度 {month}月）
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      勘定科目コード
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      勘定科目名
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      予算金額
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      部門
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {budgets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    budgets.map((budget) => (
                      <tr key={budget.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">{budget.accountCode}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{budget.accountName}</td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                          {formatCurrency(budget.amount)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {budget.departmentId || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(budget)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(budget)}
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
          </div>
        </TabsContent>
      </Tabs>

      <BudgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editingBudget}
        fiscalYear={fiscalYear}
        month={month}
        onSuccess={fetchData}
      />

      <CSVUpload
        open={csvOpen}
        onOpenChange={setCSVOpen}
        fiscalYear={fiscalYear}
        onSuccess={fetchData}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予算の削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.accountName}」の予算を削除しますか？ この操作は取り消せません。
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
