'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Clock, AlertTriangle, Calculator, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface PrepaidExpense {
  id: string
  accountCode: string
  accountName: string
  originalAmount: number
  remainingAmount: number
  startDate: string
  endDate: string
  totalMonths: number
  monthlyAmount: number
  status: string
  notes?: string
  amortizations?: Amortization[]
}

interface AccrualExpense {
  id: string
  accountCode: string
  accountName: string
  accrualYear: number
  accrualMonth: number
  expectedAmount: number
  actualAmount: number
  status: string
  notes?: string
}

interface Amortization {
  year: number
  month: number
  expectedAmount: number
  actualAmount: number
  status: string
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-blue-500',
  FULLY_AMORTIZED: 'bg-green-500',
  SUSPENDED: 'bg-gray-500',
  ACCRUED: 'bg-yellow-500',
  PAID: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  completed: 'bg-green-500',
  partial: 'bg-orange-500',
  missing: 'bg-red-500',
}

const statusLabels: Record<string, string> = {
  ACTIVE: '償却中',
  FULLY_AMORTIZED: '償却完了',
  SUSPENDED: '停止中',
  ACCRUED: '未払計上',
  PAID: '支払済み',
  OVERDUE: '期限超過',
  completed: '完了',
  partial: '一部',
  missing: '未処理',
}

export default function DeferredAccrualPage() {
  const [prepaidExpenses, setPrepaidExpenses] = useState<PrepaidExpense[]>([])
  const [accrualExpenses, setAccrualExpenses] = useState<AccrualExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string>('')
  const [isAddPrepaidOpen, setIsAddPrepaidOpen] = useState(false)
  const [isAddAccrualOpen, setIsAddAccrualOpen] = useState(false)

  const [prepaidForm, setPrepaidForm] = useState({
    accountCode: '',
    accountName: '',
    originalAmount: '',
    startDate: '',
    endDate: '',
    totalMonths: '',
    notes: '',
  })

  const [accrualForm, setAccrualForm] = useState({
    accountCode: '',
    accountName: '',
    accrualYear: new Date().getFullYear(),
    accrualMonth: new Date().getMonth() + 1,
    expectedAmount: '',
    actualAmount: '',
    notes: '',
  })

  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId')
    if (storedCompanyId) {
      setCompanyId(storedCompanyId)
    }
  }, [])

  const fetchData = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [prepaidRes, accrualRes] = await Promise.all([
        fetch(`/api/deferred-accrual/prepaid?companyId=${companyId}`),
        fetch(`/api/deferred-accrual/accrual?companyId=${companyId}`),
      ])
      if (prepaidRes.ok) {
        setPrepaidExpenses(await prepaidRes.json())
      }
      if (accrualRes.ok) {
        setAccrualExpenses(await accrualRes.json())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddPrepaid = async () => {
    if (!companyId) return
    try {
      const res = await fetch('/api/deferred-accrual/prepaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...prepaidForm,
          originalAmount: parseFloat(prepaidForm.originalAmount),
          totalMonths: parseInt(prepaidForm.totalMonths),
        }),
      })
      if (res.ok) {
        toast.success('前払費用を追加しました')
        setIsAddPrepaidOpen(false)
        setPrepaidForm({
          accountCode: '',
          accountName: '',
          originalAmount: '',
          startDate: '',
          endDate: '',
          totalMonths: '',
          notes: '',
        })
        fetchData()
      }
    } catch {
      toast.error('前払費用の追加に失敗しました')
    }
  }

  const handleAddAccrual = async () => {
    if (!companyId) return
    try {
      const res = await fetch('/api/deferred-accrual/accrual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...accrualForm,
          expectedAmount: parseFloat(accrualForm.expectedAmount),
          actualAmount: parseFloat(accrualForm.actualAmount),
        }),
      })
      if (res.ok) {
        toast.success('未払費用を追加しました')
        setIsAddAccrualOpen(false)
        setAccrualForm({
          accountCode: '',
          accountName: '',
          accrualYear: new Date().getFullYear(),
          accrualMonth: new Date().getMonth() + 1,
          expectedAmount: '',
          actualAmount: '',
          notes: '',
        })
        fetchData()
      }
    } catch {
      toast.error('未払費用の追加に失敗しました')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  const activePrepaidCount = prepaidExpenses.filter((p) => p.status === 'ACTIVE').length
  const totalRemainingAmount = prepaidExpenses.reduce((sum, p) => sum + p.remainingAmount, 0)
  const unpaidAccrualCount = accrualExpenses.filter((a) => a.status === 'ACCRUED').length
  const totalAccrualAmount = accrualExpenses
    .filter((a) => a.status === 'ACCRUED')
    .reduce((sum, a) => sum + a.expectedAmount, 0)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <a
        href="/"
        className="mb-4 inline-flex items-center text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        トップページに戻る
      </a>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Calculator className="h-8 w-8" />
            前払・未払費用管理
          </h1>
          <p className="text-muted-foreground">前払費用の償却と未払費用の管理</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">償却中</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePrepaidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">前払残高</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalRemainingAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未払計上</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unpaidAccrualCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未払合計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalAccrualAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="prepaid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prepaid">前払費用</TabsTrigger>
          <TabsTrigger value="accrual">未払費用</TabsTrigger>
        </TabsList>

        <TabsContent value="prepaid">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>前払費用一覧</CardTitle>
                  <CardDescription>複数月分の前払いを資産計上している費用</CardDescription>
                </div>
                <Dialog open={isAddPrepaidOpen} onOpenChange={setIsAddPrepaidOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>前払費用追加</DialogTitle>
                      <DialogDescription>新しい前払費用を追加します</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>勘定科目コード</Label>
                        <Input
                          className="col-span-3"
                          value={prepaidForm.accountCode}
                          onChange={(e) =>
                            setPrepaidForm({ ...prepaidForm, accountCode: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>勘定科目名</Label>
                        <Input
                          className="col-span-3"
                          value={prepaidForm.accountName}
                          onChange={(e) =>
                            setPrepaidForm({ ...prepaidForm, accountName: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>元本</Label>
                        <Input
                          type="number"
                          className="col-span-3"
                          value={prepaidForm.originalAmount}
                          onChange={(e) =>
                            setPrepaidForm({ ...prepaidForm, originalAmount: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>開始日</Label>
                        <Input
                          type="date"
                          className="col-span-3"
                          value={prepaidForm.startDate}
                          onChange={(e) =>
                            setPrepaidForm({ ...prepaidForm, startDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>終了日</Label>
                        <Input
                          type="date"
                          className="col-span-3"
                          value={prepaidForm.endDate}
                          onChange={(e) =>
                            setPrepaidForm({ ...prepaidForm, endDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>月数</Label>
                        <Input
                          type="number"
                          className="col-span-3"
                          value={prepaidForm.totalMonths}
                          onChange={(e) =>
                            setPrepaidForm({ ...prepaidForm, totalMonths: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>メモ</Label>
                        <Input
                          className="col-span-3"
                          value={prepaidForm.notes}
                          onChange={(e) =>
                            setPrepaidForm({ ...prepaidForm, notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddPrepaid}>追加</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">読み込み中...</div>
              ) : prepaidExpenses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">前払費用がありません</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>勘定科目</TableHead>
                      <TableHead>元本</TableHead>
                      <TableHead>残高</TableHead>
                      <TableHead>月額</TableHead>
                      <TableHead>期間</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prepaidExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{expense.accountName}</div>
                            <div className="text-sm text-muted-foreground">
                              {expense.accountCode}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatAmount(expense.originalAmount)}</TableCell>
                        <TableCell>{formatAmount(expense.remainingAmount)}</TableCell>
                        <TableCell>{formatAmount(expense.monthlyAmount)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(expense.startDate)} 〜 {formatDate(expense.endDate)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {expense.totalMonths}ヶ月
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[expense.status] || 'bg-gray-500'}>
                            {statusLabels[expense.status] || expense.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accrual">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>未払費用一覧</CardTitle>
                  <CardDescription>未払計上されている費用</CardDescription>
                </div>
                <Dialog open={isAddAccrualOpen} onOpenChange={setIsAddAccrualOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>未払費用追加</DialogTitle>
                      <DialogDescription>新しい未払費用を追加します</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>勘定科目コード</Label>
                        <Input
                          className="col-span-3"
                          value={accrualForm.accountCode}
                          onChange={(e) =>
                            setAccrualForm({ ...accrualForm, accountCode: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>勘定科目名</Label>
                        <Input
                          className="col-span-3"
                          value={accrualForm.accountName}
                          onChange={(e) =>
                            setAccrualForm({ ...accrualForm, accountName: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>計上年月</Label>
                        <div className="col-span-3 flex gap-2">
                          <Input
                            type="number"
                            value={accrualForm.accrualYear}
                            onChange={(e) =>
                              setAccrualForm({
                                ...accrualForm,
                                accrualYear: parseInt(e.target.value),
                              })
                            }
                            className="w-24"
                          />
                          <span className="flex items-center">年</span>
                          <Input
                            type="number"
                            value={accrualForm.accrualMonth}
                            onChange={(e) =>
                              setAccrualForm({
                                ...accrualForm,
                                accrualMonth: parseInt(e.target.value),
                              })
                            }
                            className="w-16"
                          />
                          <span className="flex items-center">月</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>予定額</Label>
                        <Input
                          type="number"
                          className="col-span-3"
                          value={accrualForm.expectedAmount}
                          onChange={(e) =>
                            setAccrualForm({ ...accrualForm, expectedAmount: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>実際額</Label>
                        <Input
                          type="number"
                          className="col-span-3"
                          value={accrualForm.actualAmount}
                          onChange={(e) =>
                            setAccrualForm({ ...accrualForm, actualAmount: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>メモ</Label>
                        <Input
                          className="col-span-3"
                          value={accrualForm.notes}
                          onChange={(e) =>
                            setAccrualForm({ ...accrualForm, notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddAccrual}>追加</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">読み込み中...</div>
              ) : accrualExpenses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">未払費用がありません</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>勘定科目</TableHead>
                      <TableHead>計上年月</TableHead>
                      <TableHead>予定額</TableHead>
                      <TableHead>実際額</TableHead>
                      <TableHead>差異</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accrualExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{expense.accountName}</div>
                            <div className="text-sm text-muted-foreground">
                              {expense.accountCode}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {expense.accrualYear}年{expense.accrualMonth}月
                        </TableCell>
                        <TableCell>{formatAmount(expense.expectedAmount)}</TableCell>
                        <TableCell>{formatAmount(expense.actualAmount)}</TableCell>
                        <TableCell
                          className={
                            expense.actualAmount - expense.expectedAmount < 0 ? 'text-red-600' : ''
                          }
                        >
                          {formatAmount(expense.actualAmount - expense.expectedAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[expense.status] || 'bg-gray-500'}>
                            {statusLabels[expense.status] || expense.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
