'use client'

import Link from 'next/link'

export function KPIPageHeader() {
  return (
    <header className="bg-white shadow">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">経営指標ダッシュボード</h1>
          <nav className="flex space-x-4">
            <Link href="/reports/monthly" className="text-gray-500 hover:text-gray-700">
              月次レポート
            </Link>
            <Link href="/reports/cashflow" className="text-gray-500 hover:text-gray-700">
              資金繰り表
            </Link>
            <Link href="/reports/budget" className="text-gray-500 hover:text-gray-700">
              予実管理
            </Link>
            <Link href="/reports/kpi" className="text-primary-600 font-medium">
              経営指標
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
