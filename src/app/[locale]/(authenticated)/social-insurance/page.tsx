'use client'

import Link from 'next/link'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, CheckCircle, Clock, AlertTriangle, Shield, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface Schedule {
  id: string
  insuranceType: string
  taskName: string
  dueDate: string
  completedDate?: string
  status: string
  notes?: string
}

interface Payment {
  id: string
  insuranceType: string
  year: number
  month: number
  expectedAmount: number
  actualAmount: number
  dueDate: string
  paymentDate?: string
  status: string
  notes?: string
}

const insuranceTypeLabels: Record<string, string> = {
  health: '健康保険',
  pension: '厚生年金保険',
  employment: '雇用保険',
  work_accident: '労災保険',
  care: '介護保険',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  COMPLETED: 'bg-green-500',
  OVERDUE: 'bg-red-500',
  paid: 'bg-green-500',
  partial: 'bg-orange-500',
  missing: 'bg-red-500',
}

const statusLabels: Record<string, string> = {
  PENDING: '未処理',
  COMPLETED: '完了',
  OVERDUE: '期限超過',
  paid: '納付済み',
  partial: '一部納付',
  pending: '未納付',
  missing: '未納付',
  overdue: '期限超過',
}

export default function SocialInsurancePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string>('')
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false)
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false)

  const [scheduleForm, setScheduleForm] = useState({
    insuranceType: 'health',
    taskName: '',
    dueDate: '',
    notes: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    insuranceType: 'health',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    expectedAmount: '',
    actualAmount: '',
    dueDate: '',
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
      const [schedulesRes, paymentsRes] = await Promise.all([
        fetch(`/api/social-insurance/schedules?companyId=${companyId}`),
        fetch(`/api/social-insurance/payments?companyId=${companyId}`),
      ])
      if (schedulesRes.ok) {
        setSchedules(await schedulesRes.json())
      }
      if (paymentsRes.ok) {
        setPayments(await paymentsRes.json())
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

  const handleAddSchedule = async () => {
    if (!companyId) return
    try {
      const res = await fetch('/api/social-insurance/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...scheduleForm,
        }),
      })
      if (res.ok) {
        toast.success('スケジュールを追加しました')
        setIsAddScheduleOpen(false)
        setScheduleForm({ insuranceType: 'health', taskName: '', dueDate: '', notes: '' })
        fetchData()
      }
    } catch {
      toast.error('スケジュールの追加に失敗しました')
    }
  }

  const handleCompleteSchedule = async (id: string) => {
    try {
      const res = await fetch(`/api/social-insurance/schedules/${id}/complete`, {
        method: 'PUT',
      })
      if (res.ok) {
        toast.success('スケジュールを完了しました')
        fetchData()
      }
    } catch {
      toast.error('完了処理に失敗しました')
    }
  }

  const handleAddPayment = async () => {
    if (!companyId) return
    try {
      const res = await fetch('/api/social-insurance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...paymentForm,
          expectedAmount: parseFloat(paymentForm.expectedAmount),
          actualAmount: parseFloat(paymentForm.actualAmount),
        }),
      })
      if (res.ok) {
        toast.success('納付記録を追加しました')
        setIsAddPaymentOpen(false)
        setPaymentForm({
          insuranceType: 'health',
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          expectedAmount: '',
          actualAmount: '',
          dueDate: '',
          notes: '',
        })
        fetchData()
      }
    } catch {
      toast.error('納付記録の追加に失敗しました')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP')
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  const pendingCount = schedules.filter((s) => s.status === 'PENDING').length
  const overdueCount = schedules.filter((s) => s.status === 'OVERDUE').length
  const completedCount = schedules.filter((s) => s.status === 'COMPLETED').length

  return (
    <div className="container mx-auto space-y-6 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        トップページに戻る
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Shield className="h-8 w-8" />
            社会保険管理
          </h1>
          <p className="text-muted-foreground">社会保険手続きと納付状況の管理</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未処理</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">期限超過</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の納付額</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(
                payments
                  .filter(
                    (p) =>
                      p.year === new Date().getFullYear() && p.month === new Date().getMonth() + 1
                  )
                  .reduce((sum, p) => sum + p.actualAmount, 0)
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedules">スケジュール</TabsTrigger>
          <TabsTrigger value="payments">納付状況</TabsTrigger>
        </TabsList>

        <TabsContent value="schedules">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>手続きスケジュール</CardTitle>
                  <CardDescription>社会保険手続きの期限管理</CardDescription>
                </div>
                <Dialog open={isAddScheduleOpen} onOpenChange={setIsAddScheduleOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      追加
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>スケジュール追加</DialogTitle>
                      <DialogDescription>新しい社会保険手続きを追加します</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>保険種別</Label>
                        <Select
                          value={scheduleForm.insuranceType}
                          onValueChange={(v) =>
                            setScheduleForm({ ...scheduleForm, insuranceType: v })
                          }
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(insuranceTypeLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>手続き名</Label>
                        <Input
                          className="col-span-3"
                          value={scheduleForm.taskName}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, taskName: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>期限日</Label>
                        <Input
                          type="date"
                          className="col-span-3"
                          value={scheduleForm.dueDate}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, dueDate: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>メモ</Label>
                        <Input
                          className="col-span-3"
                          value={scheduleForm.notes}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddSchedule}>追加</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">読み込み中...</div>
              ) : schedules.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  スケジュールがありません
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>保険種別</TableHead>
                      <TableHead>手続き名</TableHead>
                      <TableHead>期限日</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell>{insuranceTypeLabels[schedule.insuranceType]}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{schedule.taskName}</div>
                            {schedule.notes && (
                              <div className="text-sm text-muted-foreground">{schedule.notes}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(schedule.dueDate)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[schedule.status]}>
                            {statusLabels[schedule.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {schedule.status === 'PENDING' && (
                            <Button size="sm" onClick={() => handleCompleteSchedule(schedule.id)}>
                              完了
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>納付状況一覧</CardTitle>
                  <CardDescription>社会保険料の納付状況</CardDescription>
                </div>
                <Dialog open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      納付記録
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>納付記録追加</DialogTitle>
                      <DialogDescription>社会保険料の納付記録を追加します</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>保険種別</Label>
                        <Select
                          value={paymentForm.insuranceType}
                          onValueChange={(v) =>
                            setPaymentForm({ ...paymentForm, insuranceType: v })
                          }
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(insuranceTypeLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>年月</Label>
                        <div className="col-span-3 flex gap-2">
                          <Input
                            type="number"
                            value={paymentForm.year}
                            onChange={(e) =>
                              setPaymentForm({ ...paymentForm, year: parseInt(e.target.value) })
                            }
                            className="w-24"
                          />
                          <span className="flex items-center">年</span>
                          <Input
                            type="number"
                            value={paymentForm.month}
                            onChange={(e) =>
                              setPaymentForm({ ...paymentForm, month: parseInt(e.target.value) })
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
                          value={paymentForm.expectedAmount}
                          onChange={(e) =>
                            setPaymentForm({ ...paymentForm, expectedAmount: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>納付額</Label>
                        <Input
                          type="number"
                          className="col-span-3"
                          value={paymentForm.actualAmount}
                          onChange={(e) =>
                            setPaymentForm({ ...paymentForm, actualAmount: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label>納期限</Label>
                        <Input
                          type="date"
                          className="col-span-3"
                          value={paymentForm.dueDate}
                          onChange={(e) =>
                            setPaymentForm({ ...paymentForm, dueDate: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddPayment}>追加</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">読み込み中...</div>
              ) : payments.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">納付記録がありません</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>保険種別</TableHead>
                      <TableHead>年月</TableHead>
                      <TableHead>予定額</TableHead>
                      <TableHead>納付額</TableHead>
                      <TableHead>差異</TableHead>
                      <TableHead>ステータス</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{insuranceTypeLabels[payment.insuranceType]}</TableCell>
                        <TableCell>
                          {payment.year}年{payment.month}月
                        </TableCell>
                        <TableCell>{formatAmount(payment.expectedAmount)}</TableCell>
                        <TableCell>{formatAmount(payment.actualAmount)}</TableCell>
                        <TableCell
                          className={
                            payment.actualAmount - payment.expectedAmount < 0 ? 'text-red-600' : ''
                          }
                        >
                          {formatAmount(payment.actualAmount - payment.expectedAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[payment.status] || 'bg-gray-500'}>
                            {statusLabels[payment.status] || payment.status}
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
