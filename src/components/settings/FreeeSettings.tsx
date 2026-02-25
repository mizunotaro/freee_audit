'use client'

import { useState, useEffect, useCallback } from 'react'

interface ConnectionStatus {
  connected: boolean
  companyId?: number
  companyName?: string
  expiresAt?: string
  lastSyncAt?: string
}

export function FreeeSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/freee/companies')
      if (response.ok) {
        const data = await response.json()
        setStatus({
          connected: data.companies?.length > 0,
          companyName: data.companies?.[0]?.display_name || data.companies?.[0]?.name,
          companyId: data.companies?.[0]?.id,
        })
      }
    } catch (err) {
      console.error('Failed to check status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()

    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('connected') === 'true') {
      setSuccess('freeeとの連携が完了しました')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (urlParams.get('error')) {
      setError(urlParams.get('error') || '認証エラーが発生しました')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [checkStatus])

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      window.location.href = '/api/freee/auth'
    } catch (err) {
      setError('接続に失敗しました')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('freeeとの連携を解除しますか？')) return

    try {
      setLoading(true)
      const response = await fetch('/api/freee/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        setStatus({ connected: false })
        setSuccess('連携を解除しました')
      } else {
        setError('連携解除に失敗しました')
      }
    } catch (err) {
      setError('連携解除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/freee/companies')
      if (response.ok) {
        const data = await response.json()
        setSuccess(`接続テスト成功: ${data.companies?.length || 0}件の事業所を取得`)
      } else {
        setError('接続テストに失敗しました')
      }
    } catch (err) {
      setError('接続テストに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-32 rounded bg-gray-200"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-6 text-2xl font-bold">freee連携設定</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          {success}
          <button
            onClick={() => setSuccess(null)}
            className="ml-2 text-green-500 hover:text-green-700"
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-6 rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">接続状態</h3>
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              status?.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {status?.connected ? '接続済み' : '未接続'}
          </span>
        </div>

        {status?.connected && (
          <div className="mb-4 space-y-2 text-sm text-gray-600">
            {status.companyName && (
              <p>
                事業所名: <span className="font-medium text-gray-900">{status.companyName}</span>
              </p>
            )}
            {status.companyId && (
              <p>
                事業所ID: <span className="font-mono">{status.companyId}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {status?.connected ? (
            <>
              <button
                onClick={handleTest}
                disabled={loading}
                className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
              >
                接続テスト
              </button>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50"
              >
                連携解除
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="bg-primary-500 hover:bg-primary-600 rounded px-4 py-2 text-white disabled:opacity-50"
            >
              {connecting ? '接続中...' : 'freeeと連携する'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 p-6">
        <h3 className="mb-4 text-lg font-semibold">モックモード</h3>
        <p className="mb-2 text-sm text-gray-600">
          現在の状態:
          <span
            className={`ml-2 rounded px-2 py-1 text-xs ${
              process.env.NODE_ENV === 'development'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {process.env.NODE_ENV === 'development' ? '開発環境（モック有効）' : '本番環境'}
          </span>
        </p>
        <p className="text-xs text-gray-500">
          freee API認証情報が設定されていない場合、モックデータが返されます。
        </p>
      </div>
    </div>
  )
}
