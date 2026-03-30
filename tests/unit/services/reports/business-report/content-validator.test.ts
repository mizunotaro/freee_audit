import {
  validateGeneratedContent,
  calculateConfidence,
  checkLegalTerminology,
  validateCompleteReport,
} from '@/services/reports/business-report/content-validator'

describe('validateGeneratedContent', () => {
  it('returns valid for well-formed content', () => {
    const content =
      '事業の内容について、当会社は主にITサービスを提供しております。会社の業績は好調です。'.repeat(
        3
      )
    const result = validateGeneratedContent('companyStatus.businessDescription', content)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('warns on short content', () => {
    const result = validateGeneratedContent('companyStatus.businessDescription', '短い')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('errors on content exceeding maxLength', () => {
    const longContent = 'a'.repeat(5001)
    const result = validateGeneratedContent('companyStatus.businessDescription', longContent)
    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('CONTENT_TOO_LONG')
  })

  it('warns on missing required keywords', () => {
    const content = 'a'.repeat(150)
    const result = validateGeneratedContent('companyStatus.businessDescription', content)
    const keywordWarnings = result.warnings.filter((w) => w.message.includes('必須キーワード'))
    expect(keywordWarnings.length).toBeGreaterThan(0)
  })

  it('warns on missing number patterns for businessPerformance', () => {
    const content = '売上高は前年同期比で増加しました。利益も改善しております。'.repeat(3)
    const result = validateGeneratedContent('companyStatus.businessPerformance', content)
    const numberWarnings = result.warnings.filter((w) => w.message.includes('数値データ'))
    expect(numberWarnings.length).toBeGreaterThan(0)
  })

  it('warns on many placeholders', () => {
    const content = '〇〇会社の〇〇事業について〇〇〇〇。'.repeat(3)
    const result = validateGeneratedContent('officers.directors', content)
    expect(result.warnings.some((w) => w.message.includes('プレースホルダー'))).toBe(true)
  })

  it('returns valid with warning for unknown section type', () => {
    const result = validateGeneratedContent('unknown.section' as any, 'test')
    expect(result.isValid).toBe(true)
    expect(result.warnings.length).toBe(1)
  })
})

describe('calculateConfidence', () => {
  it('returns high confidence for valid content with source data', () => {
    const content = '事業の内容について詳細な記載があります。会社の現況を説明します。'.repeat(5)
    const confidence = calculateConfidence('companyStatus.businessDescription', content, true)
    expect(confidence).toBeGreaterThan(0.5)
  })

  it('reduces confidence without source data', () => {
    const content = '事業の内容について詳細な記載があります。会社の現況を説明します。'.repeat(5)
    const withSource = calculateConfidence('companyStatus.businessDescription', content, true)
    const withoutSource = calculateConfidence('companyStatus.businessDescription', content, false)
    expect(withoutSource).toBeLessThan(withSource)
  })

  it('reduces confidence for short content', () => {
    const confidence = calculateConfidence('companyStatus.businessDescription', 'short', true)
    expect(confidence).toBeLessThan(0.7)
  })

  it('clamps confidence between 0 and 1', () => {
    const confidence = calculateConfidence('companyStatus.businessDescription', 'test', false)
    expect(confidence).toBeGreaterThanOrEqual(0)
    expect(confidence).toBeLessThanOrEqual(1)
  })
})

describe('checkLegalTerminology', () => {
  it('detects used legal terms', () => {
    const content = '取締役会において内部統制について審議し、コンプライアンスを遵守します。'
    const result = checkLegalTerminology(content)
    expect(result.used).toContain('取締役会')
    expect(result.used).toContain('内部統制')
    expect(result.used).toContain('コンプライアンス')
  })

  it('returns empty used array when no terms found', () => {
    const result = checkLegalTerminology('no legal terms here')
    expect(result.used).toHaveLength(0)
  })
})

describe('validateCompleteReport', () => {
  it('returns valid for complete report', () => {
    const sections: Record<string, string> = {
      'companyStatus.businessDescription': '事業の内容について詳細に記載しています。'.repeat(3),
      'companyStatus.businessPerformance': '売上高は前年同期比で増加しました。'.repeat(3),
      'companyStatus.financialSummary': '資産、負債、純資産の状況について報告します。'.repeat(3),
      'shares.totalShares': '発行済株式総数は100,000株です。'.repeat(3),
      'officers.directors': '取締役は以下の通りです。'.repeat(5),
      'officers.auditors': '監査役は以下の通りです。'.repeat(5),
      'auditor.info': '監査の実施状況について報告します。'.repeat(3),
      'internalControl.basicPolicy': '内部統制の基本方針について定めています。'.repeat(3),
    }
    const result = validateCompleteReport(sections)
    expect(result.isValid).toBe(true)
    expect(result.completeness).toBe(100)
    expect(result.missingSections).toHaveLength(0)
  })

  it('returns invalid for incomplete report', () => {
    const result = validateCompleteReport({})
    expect(result.isValid).toBe(false)
    expect(result.completeness).toBe(0)
    expect(result.missingSections.length).toBeGreaterThan(0)
  })

  it('counts partially filled sections', () => {
    const sections: Record<string, string> = {
      'companyStatus.businessDescription': 'a'.repeat(60),
    }
    const result = validateCompleteReport(sections)
    expect(result.isValid).toBe(false)
    expect(result.completeness).toBeGreaterThan(0)
    expect(result.completeness).toBeLessThan(100)
  })
})
