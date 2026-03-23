import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { sanitizeHtml, sanitizePlainText } from '@/lib/utils/html-sanitize'
import type {
  BusinessReportData,
  KeidanrenBusinessReport,
  ReportTemplateType,
} from '@/types/reports/business'

const TIMEOUT_MS = 60000

export async function POST(request: NextRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { templateType, data, format } = body as {
      templateType: ReportTemplateType
      data: BusinessReportData | KeidanrenBusinessReport
      format: 'pdf' | 'html' | 'word'
    }

    if (!data) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    const companyName = 'companyName' in data ? data.companyName : ''
    const fiscalYear = 'fiscalYear' in data ? data.fiscalYear : new Date().getFullYear()
    const safeCompanyName = sanitizePlainText(companyName)
    const safeFiscalYear = String(fiscalYear)

    if (format === 'html') {
      const html = generateHTML(templateType, data, safeCompanyName, safeFiscalYear)
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="business_report_${templateType}.html"`,
        },
      })
    }

    return NextResponse.json({ error: 'Only HTML format is supported currently' }, { status: 400 })
  } catch (error) {
    console.error('Error exporting report:', error)
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 })
  } finally {
    clearTimeout(timeoutId)
  }
}

function generateHTML(
  templateType: ReportTemplateType,
  data: BusinessReportData | KeidanrenBusinessReport,
  companyName: string,
  fiscalYear: string
): string {
  if (templateType === 'simple') {
    const simpleData = data as BusinessReportData
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${companyName} 事業報告書 ${fiscalYear}年度</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
    h2 { margin-top: 30px; border-left: 4px solid #333; padding-left: 10px; }
    p { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${companyName}<br>事業報告書<br>${fiscalYear}年度</h1>
  <h2>1. 事業の概要</h2>
  <p>${sanitizeHtml(simpleData.businessOverview)}</p>
  <h2>2. 経営環境</h2>
  <p>${sanitizeHtml(simpleData.businessEnvironment)}</p>
  <h2>3. 経営方針</h2>
  <p>${sanitizeHtml(simpleData.managementPolicy)}</p>
  <h2>4. 課題とリスク</h2>
  <p>${sanitizeHtml(simpleData.issuesAndRisks)}</p>
  <h2>5. 財務ハイライト</h2>
  <p>${sanitizeHtml(simpleData.financialHighlights)}</p>
  <h2>6. 研究開発活動</h2>
  <p>${sanitizeHtml(simpleData.researchAndDevelopment)}</p>
  <h2>7. 企業統治</h2>
  <p>${sanitizeHtml(simpleData.corporateGovernance)}</p>
</body>
</html>`
  }

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${companyName} 事業報告書 ${fiscalYear}年度</title>
  <style>
    body { font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 30px; }
    .cover { text-align: center; padding: 100px 0; page-break-after: always; }
    h1 { font-size: 24pt; margin-bottom: 30px; }
    h2 { font-size: 14pt; margin-top: 40px; border-bottom: 1px solid #333; }
    h3 { font-size: 12pt; margin-top: 25px; }
    p { white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 9pt; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${companyName}</h1>
    <div style="font-size: 16pt;">事 業 報 告 書</div>
    <div style="margin-top: 20px;">${fiscalYear}年度</div>
  </div>
  <h2>第1 株式会社の現況に関する事項</h2>
  <p>[内容を入力してください]</p>
  <h2>第2 株式に関する事項</h2>
  <p>[内容を入力してください]</p>
  <h2>第3 新株予約権等に関する事項</h2>
  <p>[内容を入力してください]</p>
  <h2>第4 会社役員に関する事項</h2>
  <p>[内容を入力してください]</p>
  <h2>第5 会計監査人に関する事項</h2>
  <p>[内容を入力してください]</p>
  <h2>第6 業務の適正を確保するための体制等</h2>
  <p>[内容を入力してください]</p>
  <h2>第7 株式会社の支配に関する基本方針</h2>
  <p>[内容を入力してください]</p>
  <h2>第8 特定完全子会社に関する事項</h2>
  <p>[内容を入力してください]</p>
  <h2>第9 親会社等との間の取引</h2>
  <p>[内容を入力してください]</p>
  <h2>第10 株式会社の状況に関する重要な事項</h2>
  <p>[内容を入力してください]</p>
  <div style="margin-top: 60px; text-align: center;">以上</div>
</body>
</html>`
}
