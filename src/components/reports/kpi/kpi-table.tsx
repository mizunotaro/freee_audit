'use client'

import type { KPIReportData, KPIStartup, KPIVC, KPIBank } from '@/types/reports/kpi'

type KPIReportDataKpis = KPIReportData['kpis']

type BenchmarkItem = {
  kpi: string
  value: number
  benchmark: number
  status: 'good' | 'warning' | 'bad'
  description: string
}
type AdviceItem = {
  category: string
  kpiName: string
  currentValue: number
  targetValue: number | string
  status: 'good' | 'warning' | 'critical'
  advice: string
  actionItems: string[]
}

interface KPITableProps {
  benchmarks: BenchmarkItem[]
  advice?: AdviceItem[]
  kpis: KPIReportDataKpis
}
export function KPITable({ benchmarks, advice, kpis }: KPITableProps) {
  return (
    <>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">KPIベンチマーク</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  KPI
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  実績値
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  目標値
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  説明
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {benchmarks.map((b: BenchmarkItem, i: number) => (
                <tr key={i}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{b.kpi}</td>
                  <td className="px-6 py-4 text-right text-sm">
                    {typeof b.value === 'number' ? b.value.toFixed(1) : b.value}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">{b.benchmark}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        b.status === 'good'
                          ? 'bg-green-100 text-green-800'
                          : b.status === 'warning'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {b.status === 'good' ? '良好' : b.status === 'warning' ? '注意' : '要改善'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{b.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {kpis.startup && <StartupMetrics startup={kpis.startup} />}
      {kpis.vc && <VCMetrics vc={kpis.vc} />}
      {kpis.bank && <BankMetrics bank={kpis.bank} />}
      {advice && advice.length > 0 && <AdviceSection advice={advice} />}
    </>
  )
}
function StartupMetrics({ startup }: { startup: KPIStartup }) {
  return (
    <div className="mt-8 rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">スタートアップ企業向け指標</h3>
      <div className="mb-4 text-sm text-gray-500">投資家や創業期企業が重視する成長・効率指標</div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-purple-50 p-4">
          <div className="text-sm text-purple-600">Burn Rate</div>
          <div className="text-2xl font-bold text-purple-700">
            ¥{startup.burnRate.toLocaleString()}/月
          </div>
        </div>
        <div className="rounded-lg bg-purple-50 p-4">
          <div className="text-sm text-purple-600">Runway</div>
          <div
            className={`text-2xl font-bold ${startup.runwayMonths >= 12 ? 'text-green-600' : startup.runwayMonths >= 6 ? 'text-yellow-600' : 'text-red-600'}`}
          >
            {startup.runwayMonths}ヶ月
          </div>
        </div>
        <div className="rounded-lg bg-purple-50 p-4">
          <div className="text-sm text-purple-600">MRR</div>
          <div className="text-2xl font-bold text-purple-700">¥{startup.mrr.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-purple-50 p-4">
          <div className="text-sm text-purple-600">ARR</div>
          <div className="text-2xl font-bold text-purple-700">¥{startup.arr.toLocaleString()}</div>
        </div>
      </div>
      {startup.cac !== null && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-600">CAC（顧客獲得単価）</div>
            <div className="text-xl font-bold text-gray-900">¥{startup.cac!.toLocaleString()}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-600">LTV（顧客生涯価値）</div>
            <div className="text-xl font-bold text-gray-900">
              {startup.ltv ? `¥${startup.ltv.toLocaleString()}` : '-'}
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="text-sm text-gray-600">LTV/CAC比率</div>
            <div
              className={`text-xl font-bold ${startup.ltvCacRatio && startup.ltvCacRatio >= 3 ? 'text-green-600' : 'text-yellow-600'}`}
            >
              {startup.ltvCacRatio ? startup.ltvCacRatio.toFixed(1) : '-'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function VCMetrics({ vc }: { vc: KPIVC }) {
  return (
    <div className="mt-8 rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">VC/CVC投資家視点指標</h3>
      <div className="mb-4 text-sm text-gray-500">
        ベンチャーキャピタル・CVCが評価する成長性指標
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="text-sm text-blue-600">成長率（YoY）</div>
          <div
            className={`text-2xl font-bold ${vc.growthRate >= 20 ? 'text-green-600' : 'text-gray-900'}`}
          >
            {vc.growthRate.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="text-sm text-blue-600">粗利益率</div>
          <div className="text-2xl font-bold text-blue-700">{vc.grossMargin.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="text-sm text-blue-600">Rule of 40</div>
          <div
            className={`text-2xl font-bold ${vc.ruleOf40 >= 40 ? 'text-green-600' : 'text-yellow-600'}`}
          >
            {vc.ruleOf40.toFixed(1)}
          </div>
        </div>
        {vc.revenueMultiple !== null && (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="text-sm text-blue-600">Revenue Multiple</div>
            <div className="text-2xl font-bold text-blue-700">{vc.revenueMultiple.toFixed(1)}x</div>
          </div>
        )}
      </div>
      {vc.magicNumber !== null && (
        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <div className="text-sm text-gray-600">Magic Number（SaaS効率性指標）</div>
          <div className="flex items-baseline">
            <span
              className={`text-xl font-bold ${vc.magicNumber >= 0.75 ? 'text-green-600' : 'text-yellow-600'}`}
            >
              {vc.magicNumber.toFixed(2)}
            </span>
            <span className="ml-2 text-sm text-gray-500">
              {vc.magicNumber >= 0.75
                ? '（効率的: 拡大投資可能）'
                : vc.magicNumber >= 0.5
                  ? '（改善余地あり）'
                  : '（非効率: モデル見直し必要）'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
function BankMetrics({ bank }: { bank: KPIBank }) {
  return (
    <div className="mt-8 rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">銀行融資視点指標</h3>
      <div className="mb-4 text-sm text-gray-500">金融機関が融資審査で重視する信用評価指標</div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-green-50 p-4">
          <div className="text-sm text-green-600">DSCR（債務償還カバー比率）</div>
          <div
            className={`text-2xl font-bold ${bank.dscr >= 1.2 ? 'text-green-700' : 'text-red-600'}`}
          >
            {bank.dscr.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">目標: 1.2以上</div>
        </div>
        <div className="rounded-lg bg-green-50 p-4">
          <div className="text-sm text-green-600">利息カバレッジ比率</div>
          <div
            className={`text-2xl font-bold ${bank.interestCoverageRatio >= 3 ? 'text-green-700' : 'text-yellow-600'}`}
          >
            {bank.interestCoverageRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">目標: 3以上</div>
        </div>
        <div className="rounded-lg bg-green-50 p-4">
          <div className="text-sm text-green-600">D/E比率</div>
          <div
            className={`text-2xl font-bold ${bank.debtToEquityRatio <= 1 ? 'text-green-700' : 'text-yellow-600'}`}
          >
            {bank.debtToEquityRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">目標: 1以下</div>
        </div>
        <div className="rounded-lg bg-green-50 p-4">
          <div className="text-sm text-green-600">借入金依存度</div>
          <div
            className={`text-2xl font-bold ${bank.debtServiceRatio <= 50 ? 'text-green-700' : 'text-yellow-600'}`}
          >
            {bank.debtServiceRatio.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">目標: 50%以下</div>
        </div>
      </div>
    </div>
  )
}
function AdviceSection({ advice }: { advice: AdviceItem[] }) {
  return (
    <div className="mt-8 rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">コントロールアドバイス</h3>
      <div className="mb-4 text-sm text-gray-500">現在のKPIに基づく改善提案とアクションプラン</div>
      <div className="space-y-4">
        {advice.map((item: AdviceItem, idx: number) => (
          <div
            key={idx}
            className={`rounded-lg border p-4 ${
              item.status === 'critical'
                ? 'border-red-200 bg-red-50'
                : item.status === 'warning'
                  ? 'border-yellow-200 bg-yellow-50'
                  : 'border-green-200 bg-green-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.category === 'startup'
                        ? 'bg-purple-100 text-purple-800'
                        : item.category === 'vc'
                          ? 'bg-blue-100 text-blue-800'
                          : item.category === 'bank'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {item.category === 'startup'
                      ? 'スタートアップ'
                      : item.category === 'vc'
                        ? 'VC視点'
                        : item.category === 'bank'
                          ? '銀行視点'
                          : '一般'}
                  </span>
                  <span className="font-medium text-gray-900">{item.kpiName}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{item.advice}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">現在値</div>
                <div className="font-bold text-gray-900">
                  {typeof item.currentValue === 'number'
                    ? item.currentValue.toFixed(1)
                    : item.currentValue}
                </div>
                <div className="text-xs text-gray-500">目標: {item.targetValue}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-500">推奨アクション:</div>
              <ul className="mt-1 list-inside list-disc text-sm text-gray-600">
                {item.actionItems.map((action: string, actionIdx: number) => (
                  <li key={actionIdx}>{action}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
