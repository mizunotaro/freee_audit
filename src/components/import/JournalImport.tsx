'use client'

import { useState, useCallback, useRef } from 'react'

interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
  totalRows?: number
}

export function JournalImport() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [updateExisting, setUpdateExisting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setError('CSVファイルを選択してください')
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('ファイルサイズは10MB以下にしてください')
        return
      }
      setFile(selectedFile)
      setError(null)
      setResult(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      if (!droppedFile.name.toLowerCase().endsWith('.csv')) {
        setError('CSVファイルを選択してください')
        return
      }
      setFile(droppedFile)
      setError(null)
      setResult(null)
    }
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('skipDuplicates', String(skipDuplicates))
    formData.append('updateExisting', String(updateExisting))

    try {
      const response = await fetch('/api/import/journals', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        if (data.success && data.imported > 0) {
          setFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }
      } else {
        setError(data.error || 'インポートに失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    }
  }

  const handleDownloadTemplate = async () => {
    window.location.href = '/api/import/journals?action=template'
  }

  const handleClear = () => {
    setFile(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-6">
      <h2 className="mb-6 text-2xl font-bold">仕訳データインポート</h2>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="mb-2 font-semibold text-blue-800">スターター・スタンダードプランの方へ</h3>
        <p className="text-sm text-blue-700">
          API接続ができない場合や、freeeからエクスポートした仕訳データがある場合は、
          この機能を使ってCSVファイルをアップロードすることで監査システムをご利用いただけます。
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {result && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <h4 className="mb-2 font-semibold text-green-800">インポート結果</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">処理件数:</span>
              <span className="ml-2 font-medium">{result.totalRows || 0}件</span>
            </div>
            <div>
              <span className="text-gray-600">インポート成功:</span>
              <span className="ml-2 font-medium text-green-600">{result.imported}件</span>
            </div>
            <div>
              <span className="text-gray-600">スキップ:</span>
              <span className="ml-2 font-medium text-yellow-600">{result.skipped}件</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-red-600">エラー ({result.errors.length}件):</p>
              <ul className="mt-1 max-h-32 overflow-auto text-xs text-red-500">
                {result.errors.slice(0, 10).map((err, idx) => (
                  <li key={idx}>
                    行{err.row}: {err.message}
                  </li>
                ))}
                {result.errors.length > 10 && <li>...他 {result.errors.length - 10}件</li>}
              </ul>
            </div>
          )}
          <button
            onClick={() => setResult(null)}
            className="mt-2 text-sm text-green-600 hover:text-green-700"
          >
            閉じる
          </button>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`mb-6 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          file ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          {file ? (
            <div>
              <p className="text-lg font-medium text-green-700">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-lg font-medium text-gray-600">
                CSVファイルをドラッグ＆ドロップ
              </p>
              <p className="text-sm text-gray-500">または クリックしてファイルを選択</p>
            </div>
          )}
        </label>
      </div>

      <div className="mb-6 rounded-lg bg-gray-50 p-4">
        <h4 className="mb-3 font-medium">インポートオプション</h4>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">重複データをスキップする</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">既存データを更新する</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="rounded bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {uploading ? 'インポート中...' : 'インポート実行'}
        </button>
        {file && (
          <button
            onClick={handleClear}
            className="rounded border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-100"
          >
            クリア
          </button>
        )}
        <button
          onClick={handleDownloadTemplate}
          className="rounded border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-100"
        >
          テンプレートダウンロード
        </button>
      </div>

      <div className="mt-8 rounded-lg bg-gray-50 p-4">
        <h3 className="mb-3 font-semibold">CSVファイル形式</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="px-3 py-2 text-left">ヘッダー名</th>
                <th className="px-3 py-2 text-left">必須</th>
                <th className="px-3 py-2 text-left">説明</th>
                <th className="px-3 py-2 text-left">例</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2 font-mono">日付</td>
                <td className="px-3 py-2 text-red-600">必須</td>
                <td className="px-3 py-2">伝票日付 (YYYY-MM-DD)</td>
                <td className="px-3 py-2 font-mono">2024-01-15</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">摘要</td>
                <td className="px-3 py-2 text-red-600">必須</td>
                <td className="px-3 py-2">取引の説明</td>
                <td className="px-3 py-2 font-mono">売上計上</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">借方科目</td>
                <td className="px-3 py-2 text-red-600">必須</td>
                <td className="px-3 py-2">借方勘定科目名</td>
                <td className="px-3 py-2 font-mono">普通預金</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">貸方科目</td>
                <td className="px-3 py-2 text-red-600">必須</td>
                <td className="px-3 py-2">貸方勘定科目名</td>
                <td className="px-3 py-2 font-mono">売上高</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">金額</td>
                <td className="px-3 py-2 text-red-600">必須</td>
                <td className="px-3 py-2">取引金額（税込）</td>
                <td className="px-3 py-2 font-mono">110000</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">税額</td>
                <td className="px-3 py-2 text-gray-500">任意</td>
                <td className="px-3 py-2">消費税額</td>
                <td className="px-3 py-2 font-mono">10000</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono">税区分</td>
                <td className="px-3 py-2 text-gray-500">任意</td>
                <td className="px-3 py-2">消費税区分</td>
                <td className="px-3 py-2 font-mono">課税10%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
