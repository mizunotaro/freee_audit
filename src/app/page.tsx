import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">freee_audit</h1>
            <span className="text-sm text-gray-500">会計監査・レポートシステム</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-4xl font-bold text-gray-900">
            月次決算資料・経営指標ダッシュボード
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            BS/PL/CFの自動生成、資金繰り分析、予実管理、経営KPIの可視化を一元管理
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/reports/monthly"
            className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">月次決算資料</h3>
            <p className="text-sm text-gray-500">BS/PL/CF、Runway分析を縦配置で表示</p>
          </Link>

          <Link
            href="/reports/cashflow"
            className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">資金繰り表</h3>
            <p className="text-sm text-gray-500">月次CF推移、Runway/Burn Rate分析</p>
          </Link>

          <Link
            href="/reports/budget"
            className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">予実管理</h3>
            <p className="text-sm text-gray-500">予算対実績の対比、差異分析</p>
          </Link>

          <Link
            href="/reports/kpi"
            className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <svg
                className="h-6 w-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">経営指標</h3>
            <p className="text-sm text-gray-500">ROE/ROA、流動比率等のKPIダッシュボード</p>
          </Link>
        </div>

        <div className="mt-12 rounded-xl bg-white p-8 shadow-lg">
          <h3 className="mb-6 text-xl font-semibold text-gray-900">実装済み機能（Phase 3-4）</h3>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <h4 className="mb-3 font-medium text-gray-900">キャッシュフロー計算</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  間接法CF計算（BS/PL差分から）
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  資金繰り表（現金ベース月次）
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  Runway/Burn Rate計算
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  シナリオ分析（楽観/現実/悲観）
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-medium text-gray-900">経営指標（KPI）</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  収益性: ROE, ROA, ROS, 売上総利益率
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  安全性: 流動比率, D/E比率, 自己資本比率
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  効率性: 総資産回転率等
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  CF: FCF, FCFマージン
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 font-medium text-gray-900">予算管理・レポート</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  予算CRUD操作
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  CSVインポート/テンプレート
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  予実対比計算・差異分析
                </li>
                <li className="flex items-center">
                  <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                  月次決算資料生成
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
