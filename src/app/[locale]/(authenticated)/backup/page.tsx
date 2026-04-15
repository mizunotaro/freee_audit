'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface BackupRecord {
  id: string
  backupType: string
  fileName: string
  fileSize: number
  status: string
  createdAt: string
}

export default function BackupPage() {
  const [history, setHistory] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    try {
      const res = await fetch('/api/backup')
      const data = await res.json()
      if (data.success) setHistory(data.data)
    } finally {
      setLoading(false)
    }
  }

  async function createBackup(type: string) {
    setCreating(true)
    try {
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupType: type, destination: 'local' }),
      })
      const data = await res.json()
      if (data.success) {
        alert(`バックアップ完了: ${data.data.fileName}`)
        fetchHistory()
      }
    } finally {
      setCreating(false)
    }
  }

  async function exportData(format: string) {
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'export',
        format,
        tables: [
          'journals',
          'monthlyBalances',
          'subsidyProjects',
          'procurementCases',
          'shareholderRecords',
        ],
      }),
    })
    const data = await res.json()
    if (data.success) alert(`エクスポート完了: ${data.data.files.length}ファイル`)
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">バックアップ・エクスポート</h1>
          <p className="text-muted-foreground">
            データベースのバックアップ・データエクスポート・インポート
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => createBackup('full')} disabled={creating}>
            {creating ? '作成中...' : 'フルバックアップ'}
          </Button>
          <Button variant="outline" onClick={() => exportData('json')}>
            JSON出力
          </Button>
          <Button variant="outline" onClick={() => exportData('csv')}>
            CSV出力
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>バックアップ数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{history.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>最新バックアップ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {history[0] ? new Date(history[0].createdAt).toLocaleString('ja-JP') : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>合計サイズ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {formatSize(history.reduce((s, h) => s + h.fileSize, 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>バックアップ履歴</CardTitle>
          <CardDescription>直近50件のバックアップ</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>読み込み中...</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground">バックアップ履歴がありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">日時</th>
                  <th className="py-2 text-left">種別</th>
                  <th className="py-2 text-left">ファイル名</th>
                  <th className="py-2 text-right">サイズ</th>
                  <th className="py-2 text-center">状態</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="py-2">{new Date(h.createdAt).toLocaleString('ja-JP')}</td>
                    <td className="py-2">{h.backupType}</td>
                    <td className="py-2 font-mono text-xs">{h.fileName}</td>
                    <td className="py-2 text-right">{formatSize(h.fileSize)}</td>
                    <td className="py-2 text-center">
                      <span
                        className={`rounded px-2 py-1 text-xs ${h.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
