import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { sanitizeHtml, sanitizePlainText } from '@/lib/utils/html-sanitize'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      fiscalYear,
      companyName,
      businessOverview,
      businessEnvironment,
      managementPolicy,
      issuesAndRisks,
      financialHighlights,
      researchAndDevelopment,
      corporateGovernance,
    } = body

    const safeFiscalYear = sanitizePlainText(String(fiscalYear))
    const html = generateHTML({
      fiscalYear,
      companyName,
      businessOverview,
      businessEnvironment,
      managementPolicy,
      issuesAndRisks,
      financialHighlights,
      researchAndDevelopment,
      corporateGovernance,
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="business_report_${safeFiscalYear}.html"`,
      },
    })
  } catch (error) {
    console.error('Error exporting report:', error)
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 })
  }
}

function generateHTML(data: {
  fiscalYear: number
  companyName: string
  businessOverview: string
  businessEnvironment: string
  managementPolicy: string
  issuesAndRisks: string
  financialHighlights: string
  researchAndDevelopment: string
  corporateGovernance: string
}): string {
  const safeCompanyName = sanitizeHtml(data.companyName)
  const safeFiscalYear = String(data.fiscalYear)
  const safeBusinessOverview = sanitizeHtml(data.businessOverview)
  const safeBusinessEnvironment = sanitizeHtml(data.businessEnvironment)
  const safeManagementPolicy = sanitizeHtml(data.managementPolicy)
  const safeIssuesAndRisks = sanitizeHtml(data.issuesAndRisks)
  const safeFinancialHighlights = sanitizeHtml(data.financialHighlights)
  const safeResearchAndDevelopment = sanitizeHtml(data.researchAndDevelopment)
  const safeCorporateGovernance = sanitizeHtml(data.corporateGovernance)

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeCompanyName} 事業報告書 ${safeFiscalYear}年度</title>
  <style>
    body {
      font-family: "游ゴシック", "Yu Gothic", sans-serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 {
      text-align: center;
      font-size: 24px;
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    h2 {
      font-size: 18px;
      margin-top: 30px;
      margin-bottom: 15px;
      border-left: 4px solid #333;
      padding-left: 10px;
    }
    p {
      white-space: pre-wrap;
      margin-bottom: 15px;
    }
    .section {
      margin-bottom: 30px;
    }
    @media print {
      body { padding: 0; }
      h2 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <h1>${safeCompanyName}<br>事業報告書<br>${safeFiscalYear}年度</h1>

  <div class="section">
    <h2>1. 事業の概要</h2>
    <p>${safeBusinessOverview}</p>
  </div>

  <div class="section">
    <h2>2. 経営環境</h2>
    <p>${safeBusinessEnvironment}</p>
  </div>

  <div class="section">
    <h2>3. 経営方針</h2>
    <p>${safeManagementPolicy}</p>
  </div>

  <div class="section">
    <h2>4. 課題とリスク</h2>
    <p>${safeIssuesAndRisks}</p>
  </div>

  <div class="section">
    <h2>5. 財務ハイライト</h2>
    <p>${safeFinancialHighlights}</p>
  </div>

  <div class="section">
    <h2>6. 研究開発活動</h2>
    <p>${safeResearchAndDevelopment}</p>
  </div>

  <div class="section">
    <h2>7. 企業統治</h2>
    <p>${safeCorporateGovernance}</p>
  </div>
</body>
</html>
`
}
