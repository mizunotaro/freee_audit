'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SubsidyProject {
  id: string
  projectCode: string
  projectName: string
  subsidyType: string
  status: string
}

interface SubsidyJournal {
  id: string
  date: string
  workerName: string
  amedHours: number
  totalHours: number
  activityText: string
  status: string
}

export default function SubsidyPage() {
  const [projects, setProjects] = useState<SubsidyProject[]>([])
  const [journals, setJournals] = useState<SubsidyJournal[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      const res = await fetch('/api/subsidy')
      const data = await res.json()
      if (data.success) setProjects(data.data)
    } catch {
      setError('プロジェクト一覧の取得に失敗しました')
    }
  }

  async function fetchJournals(projectId: string, year: number, month: number) {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/subsidy/journals?projectId=${projectId}&year=${year}&month=${month}`
      )
      const data = await res.json()
      if (data.success) setJournals(data.data)
    } catch {
      setError('業務日誌の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">補助金管理</h1>
        <p className="text-muted-foreground">
          AMED/NEDO補助金プロジェクトの管理・業務日誌・収支管理
        </p>
      </div>

      {error && <div className="rounded bg-destructive/15 px-4 py-3 text-destructive">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>プロジェクト数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{projects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>アクティブ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {projects.filter((p) => p.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>今月の日誌</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{journals.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>補助金プロジェクト一覧</CardTitle>
          <CardDescription>登録済みの補助金プロジェクト</CardDescription>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-muted-foreground">プロジェクトが登録されていません</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`cursor-pointer rounded border p-3 hover:bg-accent ${selectedProject === p.id ? 'border-primary bg-accent' : ''}`}
                  onClick={() => {
                    setSelectedProject(p.id)
                    const now = new Date()
                    fetchJournals(p.id, now.getFullYear(), now.getMonth() + 1)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{p.projectName}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{p.projectCode}</span>
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-xs ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle>業務日誌</CardTitle>
            <CardDescription>選択中プロジェクトの作業記録</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>読み込み中...</p>
            ) : journals.length === 0 ? (
              <p className="text-muted-foreground">今月の業務日誌はありません</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">日付</th>
                    <th className="py-2 text-left">作業者</th>
                    <th className="py-2 text-right">AMED時間</th>
                    <th className="py-2 text-right">全体時間</th>
                    <th className="py-2 text-left">作業内容</th>
                    <th className="py-2 text-left">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.map((j) => (
                    <tr key={j.id} className="border-b">
                      <td className="py-2">{new Date(j.date).toLocaleDateString('ja-JP')}</td>
                      <td className="py-2">{j.workerName}</td>
                      <td className="py-2 text-right">{j.amedHours}h</td>
                      <td className="py-2 text-right">{j.totalHours}h</td>
                      <td className="max-w-xs truncate py-2">{j.activityText}</td>
                      <td className="py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs ${j.status === 'draft' ? 'bg-yellow-100' : 'bg-green-100'}`}
                        >
                          {j.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
