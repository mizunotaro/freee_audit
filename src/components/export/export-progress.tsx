'use client'

import { ExportProgress as ExportProgressType } from '@/services/export'

interface ExportProgressProps {
  progress: ExportProgressType
  className?: string
}

export function ExportProgress({ progress, className = '' }: ExportProgressProps) {
  const getStatusColor = () => {
    switch (progress.status) {
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'processing':
        return 'bg-blue-500'
      default:
        return 'bg-gray-300'
    }
  }

  const getStatusText = () => {
    switch (progress.status) {
      case 'pending':
        return '待機中...'
      case 'processing':
        return '処理中...'
      case 'completed':
        return '完了'
      case 'failed':
        return 'エラー'
      default:
        return ''
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {progress.message || getStatusText()}
        </span>
        <span className="text-sm text-gray-500">{Math.round(progress.progress)}%</span>
      </div>

      <div className="h-2.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      {progress.status === 'failed' && progress.error && (
        <p className="mt-2 text-sm text-red-600">{progress.error}</p>
      )}

      {progress.status === 'completed' && progress.result && (
        <div className="mt-3 rounded-md bg-green-50 p-3">
          <p className="text-sm font-medium text-green-700">ダウンロード準備完了</p>
          <p className="mt-1 text-xs text-green-600">
            ファイルサイズ: {(progress.result.fileSize / 1024).toFixed(1)} KB
          </p>
          <p className="text-xs text-green-600">
            有効期限: {progress.result.expiresAt.toLocaleString('ja-JP')}
          </p>
        </div>
      )}
    </div>
  )
}

interface ExportProgressOverlayProps {
  isVisible: boolean
  progress: ExportProgressType
  onClose?: () => void
}

export function ExportProgressOverlay({
  isVisible,
  progress,
  onClose,
}: ExportProgressOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">
          {progress.status === 'completed' ? 'エクスポート完了' : 'エクスポート中'}
        </h3>

        <ExportProgress progress={progress} />

        {(progress.status === 'completed' || progress.status === 'failed') && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {progress.status === 'completed' && progress.result ? (
              <a href={progress.result.downloadUrl} download>
                ダウンロード
              </a>
            ) : (
              '閉じる'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default ExportProgress
