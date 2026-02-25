'use client'

import {
  MonthlyReportData,
  BalanceSheetData,
  ProfitLossData,
  CashFlowData,
  KPIData,
  AccountItem,
} from '@/services/export'
import { formatCurrency, Currency } from '@/services/currency'

interface MonthlyReportTemplateProps {
  data: MonthlyReportData
  language: 'ja' | 'en' | 'dual'
  currency: Currency
  exchangeRate?: number
}

export function MonthlyReportTemplate({
  data,
  language,
  currency,
  exchangeRate,
}: MonthlyReportTemplateProps) {
  const lang = language === 'dual' ? 'ja' : language

  return (
    <div className="bg-white p-8 print:p-0" id="monthly-report">
      <ReportHeader
        title={lang === 'en' ? 'Monthly Report' : '月次レポート'}
        period={`${data.fiscalYear}/${String(data.month).padStart(2, '0')}`}
        language={lang}
      />

      <section className="mb-8">
        <h2 className="mb-4 border-b pb-2 text-lg font-bold">
          {lang === 'en' ? 'Executive Summary' : 'エグゼクティブサマリー'}
        </h2>
        <SummarySection
          highlights={data.summary.highlights}
          issues={data.summary.issues}
          goals={data.summary.nextMonthGoals}
          language={lang}
        />
      </section>

      <section className="mb-8">
        <BalanceSheetSection
          data={data.balanceSheet}
          language={lang}
          currency={currency}
          exchangeRate={exchangeRate}
        />
      </section>

      <section className="mb-8">
        <ProfitLossSection
          data={data.profitLoss}
          language={lang}
          currency={currency}
          exchangeRate={exchangeRate}
        />
      </section>

      <section className="mb-8">
        <CashFlowSection
          data={data.cashFlow}
          language={lang}
          currency={currency}
          exchangeRate={exchangeRate}
        />
      </section>

      <section className="mb-8">
        <KPISection data={data.kpi} language={lang} />
      </section>

      <ReportFooter language={lang} />
    </div>
  )
}

interface ReportHeaderProps {
  title: string
  period: string
  language: 'ja' | 'en'
}

function ReportHeader({ title, period, language }: ReportHeaderProps) {
  return (
    <header className="mb-8 border-b-2 border-gray-800 pb-4 text-center">
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      <p className="text-lg text-gray-600">{period}</p>
      <p className="mt-2 text-sm text-gray-500">
        {language === 'en' ? 'Generated' : '作成日'}:{' '}
        {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'ja-JP')}
      </p>
    </header>
  )
}

interface SummarySectionProps {
  highlights: string[]
  issues: string[]
  goals: string[]
  language: 'ja' | 'en'
}

function SummarySection({ highlights, issues, goals, language }: SummarySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded bg-green-50 p-4">
        <h3 className="mb-2 font-semibold text-green-800">
          {language === 'en' ? 'Highlights' : 'ハイライト'}
        </h3>
        <ul className="space-y-1 text-sm text-green-700">
          {highlights.map((item, i) => (
            <li key={i}>• {item}</li>
          ))}
        </ul>
      </div>

      <div className="rounded bg-yellow-50 p-4">
        <h3 className="mb-2 font-semibold text-yellow-800">
          {language === 'en' ? 'Issues' : '課題'}
        </h3>
        <ul className="space-y-1 text-sm text-yellow-700">
          {issues.map((item, i) => (
            <li key={i}>• {item}</li>
          ))}
        </ul>
      </div>

      <div className="rounded bg-blue-50 p-4">
        <h3 className="mb-2 font-semibold text-blue-800">
          {language === 'en' ? 'Next Month Goals' : '来月の目標'}
        </h3>
        <ul className="space-y-1 text-sm text-blue-700">
          {goals.map((item, i) => (
            <li key={i}>• {item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface BalanceSheetSectionProps {
  data: BalanceSheetData
  language: 'ja' | 'en'
  currency: Currency
  exchangeRate?: number
}

function BalanceSheetSection({ data, language, currency, exchangeRate }: BalanceSheetSectionProps) {
  return (
    <div>
      <h2 className="mb-4 border-b pb-2 text-lg font-bold">
        {language === 'en' ? 'Balance Sheet' : '貸借対照表'}
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        {language === 'en' ? 'As of' : '基準日'}:{' '}
        {data.asOfDate.toLocaleDateString(language === 'en' ? 'en-US' : 'ja-JP')}
      </p>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h3 className="mb-2 font-semibold">{language === 'en' ? 'Assets' : '資産の部'}</h3>
          <AccountTable
            items={data.assets.current}
            total={data.assets.total}
            language={language}
            currency={currency}
            exchangeRate={exchangeRate}
          />
        </div>

        <div>
          <h3 className="mb-2 font-semibold">
            {language === 'en' ? 'Liabilities & Equity' : '負債・純資産'}
          </h3>
          <AccountTable
            items={[...data.liabilities.current, ...data.equity.items]}
            total={data.liabilities.total + data.equity.total}
            language={language}
            currency={currency}
            exchangeRate={exchangeRate}
          />
        </div>
      </div>
    </div>
  )
}

interface ProfitLossSectionProps {
  data: ProfitLossData
  language: 'ja' | 'en'
  currency: Currency
  exchangeRate?: number
}

function ProfitLossSection({
  data,
  language,
  currency,
  exchangeRate: _exchangeRate,
}: ProfitLossSectionProps) {
  const format = (amount: number) =>
    formatCurrency(amount, currency, language === 'en' ? 'en' : 'ja')

  return (
    <div>
      <h2 className="mb-4 border-b pb-2 text-lg font-bold">
        {language === 'en' ? 'Profit and Loss Statement' : '損益計算書'}
      </h2>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2">{language === 'en' ? 'Revenue' : '売上高'}</td>
            <td className="py-2 text-right">{format(data.revenue)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">{language === 'en' ? 'Cost of Sales' : '売上原価'}</td>
            <td className="py-2 text-right">{format(data.costOfSales)}</td>
          </tr>
          <tr className="border-b bg-gray-50">
            <td className="py-2 font-semibold">
              {language === 'en' ? 'Gross Profit' : '売上総利益'}
            </td>
            <td className="py-2 text-right font-semibold">{format(data.grossProfit)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">{language === 'en' ? 'SG&A Expenses' : '販管費'}</td>
            <td className="py-2 text-right">
              {format(data.sgaExpenses.reduce((sum, e) => sum + e.amount, 0))}
            </td>
          </tr>
          <tr className="border-b bg-gray-50">
            <td className="py-2 font-semibold">
              {language === 'en' ? 'Operating Income' : '営業利益'}
            </td>
            <td className="py-2 text-right font-semibold">{format(data.operatingIncome)}</td>
          </tr>
          <tr className="border-b bg-blue-50">
            <td className="py-2 font-bold">{language === 'en' ? 'Net Income' : '当期純利益'}</td>
            <td className="py-2 text-right font-bold">{format(data.netIncome)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

interface CashFlowSectionProps {
  data: CashFlowData
  language: 'ja' | 'en'
  currency: Currency
  exchangeRate?: number
}

function CashFlowSection({
  data,
  language,
  currency,
  exchangeRate: _exchangeRate,
}: CashFlowSectionProps) {
  const format = (amount: number) =>
    formatCurrency(amount, currency, language === 'en' ? 'en' : 'ja')

  return (
    <div>
      <h2 className="mb-4 border-b pb-2 text-lg font-bold">
        {language === 'en' ? 'Cash Flow Statement' : 'キャッシュフロー計算書'}
      </h2>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b bg-gray-50">
            <td className="py-2 font-semibold">
              {language === 'en' ? 'Operating Cash Flow' : '営業CF'}
            </td>
            <td className="py-2 text-right font-semibold">
              {format(data.operatingActivities.netCashFromOperating)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2">{language === 'en' ? 'Investing Cash Flow' : '投資CF'}</td>
            <td className="py-2 text-right">
              {format(data.investingActivities.netCashFromInvesting)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-2">{language === 'en' ? 'Financing Cash Flow' : '財務CF'}</td>
            <td className="py-2 text-right">
              {format(data.financingActivities.netCashFromFinancing)}
            </td>
          </tr>
          <tr className="border-b bg-blue-50">
            <td className="py-2 font-bold">
              {language === 'en' ? 'Net Change in Cash' : '現金増減'}
            </td>
            <td className="py-2 text-right font-bold">{format(data.netChangeInCash)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2">{language === 'en' ? 'Beginning Cash' : '期首現金'}</td>
            <td className="py-2 text-right">{format(data.beginningCash)}</td>
          </tr>
          <tr className="bg-green-50">
            <td className="py-2 font-bold">{language === 'en' ? 'Ending Cash' : '期末現金'}</td>
            <td className="py-2 text-right font-bold">{format(data.endingCash)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

interface KPISectionProps {
  data: KPIData
  language: 'ja' | 'en'
}

function KPISection({ data, language }: KPISectionProps) {
  const allKPIs = [
    ...data.profitability,
    ...data.efficiency,
    ...data.safety,
    ...data.growth,
    ...data.cashFlow,
  ]

  return (
    <div>
      <h2 className="mb-4 border-b pb-2 text-lg font-bold">
        {language === 'en' ? 'Key Performance Indicators' : '経営指標'}
      </h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {allKPIs.slice(0, 8).map((kpi, i) => (
          <div key={i} className="rounded bg-gray-50 p-3 text-center">
            <p className="mb-1 text-xs text-gray-500">{kpi.name}</p>
            <p className="text-lg font-bold">
              {kpi.value.toFixed(1)}
              {kpi.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface AccountTableProps {
  items: AccountItem[]
  total: number
  language: 'ja' | 'en'
  currency: Currency
  exchangeRate?: number
}

function AccountTable({ items, total, language, currency }: AccountTableProps) {
  const format = (amount: number) =>
    formatCurrency(amount, currency, language === 'en' ? 'en' : 'ja')

  return (
    <table className="w-full text-sm">
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="border-b">
            <td className="py-1">{item.name}</td>
            <td className="py-1 text-right">{format(item.amount)}</td>
          </tr>
        ))}
        <tr className="bg-gray-50">
          <td className="py-2 font-semibold">{language === 'en' ? 'Total' : '合計'}</td>
          <td className="py-2 text-right font-semibold">{format(total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

interface ReportFooterProps {
  language: 'ja' | 'en'
}

function ReportFooter({ language }: ReportFooterProps) {
  return (
    <footer className="mt-8 border-t pt-4 text-center text-xs text-gray-500">
      <p>
        {language === 'en'
          ? 'This report was generated by freee_audit system.'
          : 'このレポートはfreee_auditシステムにより生成されました。'}
      </p>
    </footer>
  )
}

export default MonthlyReportTemplate
