'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CalendarDays,
  Plus,
  CheckCircle,
  Clock,
  Users,
  FileText,
  Trash2,
  Sparkles,
} from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

interface AgendaItem {
  id: string
  title: string
  description?: string
  category: string
  decisionType: string
  requiredByLaw: boolean
  legalBasis?: string
  aiAnalysis?: string
  resolution?: string
  resolutionStatus: string
}

interface BoardMeeting {
  id: string
  meetingDate: string
  meetingType: string
  status: string
  minutes?: string
  agendaItems?: AgendaItem[]
}

const meetingTypeLabels: Record<string, string> = {
  regular: '定時取締役会',
  extraordinary: '臨時取締役会',
}

const categoryLabels: Record<string, string> = {
  financial: '財務',
  business: '事業',
  governance: 'ガバナンス',
  audit: '監査',
  other: 'その他',
}

const decisionTypeLabels: Record<string, string> = {
  resolution: '決議事項',
  report: '報告事項',
  discussion: '協議事項',
}

const statusColors: Record<string, string> = {
  SCHEDULED: 'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  COMPLETED: 'bg-green-500',
}

const statusLabels: Record<string, string> = {
  SCHEDULED: '予定',
  IN_PROGRESS: '進行中',
  COMPLETED: '完了',
}

const resolutionStatusColors: Record<string, string> = {
  PENDING: 'bg-gray-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
}

const resolutionStatusLabels: Record<string, string> = {
  PENDING: '未決',
  APPROVED: '承認',
  REJECTED: '否決',
}

export default function BoardPage() {
  const [meetings, setMeetings] = useState<BoardMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMeeting, setSelectedMeeting] = useState<BoardMeeting | null>(null)
  const [isAddMeetingOpen, setIsAddMeetingOpen] = useState(false)
  const [isAddAgendaOpen, setIsAddAgendaOpen] = useState(false)
  const [companyId, setCompanyId] = useState<string>('')

  const [meetingForm, setMeetingForm] = useState({
    meetingDate: '',
    meetingType: 'regular',
  })

  const [agendaForm, setAgendaForm] = useState({
    title: '',
    description: '',
    category: 'financial',
    decisionType: 'resolution',
    requiredByLaw: false,
    legalBasis: '',
  })

  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId')
    if (storedCompanyId) {
      setCompanyId(storedCompanyId)
    }
  }, [])

  const fetchMeetings = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/board/meetings?companyId=${companyId}`)
      const data = await res.json()
      setMeetings(data)
    } catch (error) {
      console.error('Error fetching board meetings:', error)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const handleAddMeeting = async () => {
    if (!companyId) return

    try {
      const res = await fetch('/api/board/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          meetingDate: meetingForm.meetingDate,
          meetingType: meetingForm.meetingType,
        }),
      })

      if (res.ok) {
        await fetchMeetings()
        setIsAddMeetingOpen(false)
        setMeetingForm({ meetingDate: '', meetingType: 'regular' })
      }
    } catch (error) {
      console.error('Error adding board meeting:', error)
    }
  }

  const handleAddAgendaItem = async () => {
    if (!selectedMeeting) return

    try {
      const res = await fetch(`/api/board/meetings/${selectedMeeting.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agendaForm),
      })

      if (res.ok) {
        await fetchMeetings()
        setIsAddAgendaOpen(false)
        setAgendaForm({
          title: '',
          description: '',
          category: 'financial',
          decisionType: 'resolution',
          requiredByLaw: false,
          legalBasis: '',
        })
      }
    } catch (error) {
      console.error('Error adding agenda item:', error)
    }
  }

  const handleGenerateDefault = async (meetingId: string) => {
    const fiscalYear = new Date().getFullYear()

    try {
      const res = await fetch(`/api/board/meetings/${meetingId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYear }),
      })

      if (res.ok) {
        await fetchMeetings()
      }
    } catch (error) {
      console.error('Error generating default agenda items:', error)
    }
  }

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('この取締役会を削除しますか？')) return

    try {
      const res = await fetch(`/api/board/meetings/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchMeetings()
        setSelectedMeeting(null)
      }
    } catch (error) {
      console.error('Error deleting board meeting:', error)
    }
  }

  const handleDeleteAgendaItem = async (id: string) => {
    if (!confirm('この議題を削除しますか？')) return

    try {
      const res = await fetch(`/api/board/items/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchMeetings()
      }
    } catch (error) {
      console.error('Error deleting agenda item:', error)
    }
  }

  const handleAnalyzeAgenda = async (itemId: string) => {
    const companyInfo = {
      name: 'Company',
      fiscalYearEnd: 12,
      hasInvestors: true,
    }

    try {
      const res = await fetch(`/api/board/items/${itemId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyInfo }),
      })

      if (res.ok) {
        await fetchMeetings()
      }
    } catch (error) {
      console.error('Error analyzing agenda item:', error)
    }
  }

  const handleUpdateResolution = async (itemId: string, status: string) => {
    try {
      const res = await fetch(`/api/board/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionStatus: status }),
      })

      if (res.ok) {
        await fetchMeetings()
      }
    } catch (error) {
      console.error('Error updating resolution:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">取締役会議題管理</h1>
          <p className="text-muted-foreground">取締役会の議題と決議を管理</p>
        </div>
        <Dialog open={isAddMeetingOpen} onOpenChange={setIsAddMeetingOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              取締役会を追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>取締役会を追加</DialogTitle>
              <DialogDescription>新しい取締役会をスケジュールします</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="meetingDate" className="text-right">
                  開催日
                </Label>
                <Input
                  id="meetingDate"
                  type="date"
                  value={meetingForm.meetingDate}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="meetingType" className="text-right">
                  種別
                </Label>
                <Select
                  value={meetingForm.meetingType}
                  onValueChange={(v) => setMeetingForm({ ...meetingForm, meetingType: v })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">定時取締役会</SelectItem>
                    <SelectItem value="extraordinary">臨時取締役会</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddMeeting}>追加</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">予定</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter((m) => m.status === 'SCHEDULED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter((m) => m.status === 'IN_PROGRESS').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">完了</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {meetings.filter((m) => m.status === 'COMPLETED').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>取締役会一覧</CardTitle>
            <CardDescription>クリックして議題を表示</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">読み込み中...</div>
            ) : meetings.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                取締役会がありません。「取締役会を追加」ボタンをクリックしてください。
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>開催日</TableHead>
                    <TableHead>種別</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>議題数</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((meeting) => (
                    <TableRow
                      key={meeting.id}
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => setSelectedMeeting(meeting)}
                    >
                      <TableCell>{formatDate(meeting.meetingDate)}</TableCell>
                      <TableCell>{meetingTypeLabels[meeting.meetingType]}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[meeting.status]}>
                          {statusLabels[meeting.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{meeting.agendaItems?.length || 0}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteMeeting(meeting.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedMeeting ? formatDate(selectedMeeting.meetingDate) : '議題一覧'}
                </CardTitle>
                <CardDescription>
                  {selectedMeeting
                    ? meetingTypeLabels[selectedMeeting.meetingType]
                    : '取締役会を選択してください'}
                </CardDescription>
              </div>
              {selectedMeeting && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateDefault(selectedMeeting.id)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    デフォルト生成
                  </Button>
                  <Dialog open={isAddAgendaOpen} onOpenChange={setIsAddAgendaOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        議題追加
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>議題を追加</DialogTitle>
                        <DialogDescription>新しい議題を追加します</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="title" className="text-right">
                            タイトル
                          </Label>
                          <Input
                            id="title"
                            value={agendaForm.title}
                            onChange={(e) =>
                              setAgendaForm({ ...agendaForm, title: e.target.value })
                            }
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="category" className="text-right">
                            カテゴリ
                          </Label>
                          <Select
                            value={agendaForm.category}
                            onValueChange={(v) => setAgendaForm({ ...agendaForm, category: v })}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="financial">財務</SelectItem>
                              <SelectItem value="business">事業</SelectItem>
                              <SelectItem value="governance">ガバナンス</SelectItem>
                              <SelectItem value="audit">監査</SelectItem>
                              <SelectItem value="other">その他</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="decisionType" className="text-right">
                            決議種別
                          </Label>
                          <Select
                            value={agendaForm.decisionType}
                            onValueChange={(v) => setAgendaForm({ ...agendaForm, decisionType: v })}
                          >
                            <SelectTrigger className="col-span-3">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="resolution">決議事項</SelectItem>
                              <SelectItem value="report">報告事項</SelectItem>
                              <SelectItem value="discussion">協議事項</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right">法的要件</Label>
                          <div className="col-span-3 flex items-center space-x-2">
                            <Checkbox
                              id="requiredByLaw"
                              checked={agendaForm.requiredByLaw}
                              onCheckedChange={(checked) =>
                                setAgendaForm({ ...agendaForm, requiredByLaw: checked as boolean })
                              }
                            />
                            <label htmlFor="requiredByLaw" className="text-sm">
                              法的に必要な議題
                            </label>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="legalBasis" className="text-right">
                            法的根拠
                          </Label>
                          <Input
                            id="legalBasis"
                            value={agendaForm.legalBasis}
                            onChange={(e) =>
                              setAgendaForm({ ...agendaForm, legalBasis: e.target.value })
                            }
                            className="col-span-3"
                            placeholder="例: 会社法第436条"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="description" className="text-right">
                            説明
                          </Label>
                          <Textarea
                            id="description"
                            value={agendaForm.description}
                            onChange={(e) =>
                              setAgendaForm({ ...agendaForm, description: e.target.value })
                            }
                            className="col-span-3"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddAgendaItem}>追加</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedMeeting ? (
              <div className="py-8 text-center text-muted-foreground">
                左側のリストから取締役会を選択してください
              </div>
            ) : !selectedMeeting.agendaItems || selectedMeeting.agendaItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                議題がありません。「デフォルト生成」または「議題追加」をクリックしてください。
              </div>
            ) : (
              <div className="space-y-4">
                {selectedMeeting.agendaItems.map((item) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{item.title}</CardTitle>
                          <CardDescription>
                            {categoryLabels[item.category]} •{' '}
                            {decisionTypeLabels[item.decisionType]}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={resolutionStatusColors[item.resolutionStatus]}>
                            {resolutionStatusLabels[item.resolutionStatus]}
                          </Badge>
                          {item.requiredByLaw && <Badge variant="outline">法的要件</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {item.description && <p className="mb-2 text-sm">{item.description}</p>}
                      {item.legalBasis && (
                        <p className="mb-2 text-xs text-muted-foreground">
                          法的根拠: {item.legalBasis}
                        </p>
                      )}
                      {item.aiAnalysis && (
                        <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                          <pre className="whitespace-pre-wrap">{item.aiAnalysis}</pre>
                        </div>
                      )}
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAnalyzeAgenda(item.id)}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          AI分析
                        </Button>
                        {item.resolutionStatus === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateResolution(item.id, 'APPROVED')}
                            >
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateResolution(item.id, 'REJECTED')}
                            >
                              否決
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteAgendaItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
