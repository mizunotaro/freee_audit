import type { DisclosureCategory, DisclosureSection, DisclosureTable } from '@/types/conversion'

export interface DisclosureTemplateContext {
  targetStandard: string
  periodStart: string
  periodEnd: string
  companyName: string
  adjustmentsPresent: boolean
  adjustmentList?: string
  standardReferences?: string
  differenceSections?: string
  differenceTable?: string
  adjustmentDetails?: string
  impactTable?: string
  references?: string
  comparativeInfo?: string
  measurementMethods?: string
  fairValueHierarchy?: string
  segmentDetails?: string
  foreignCurrencyDetails?: string
}

export interface DisclosureTemplate {
  category: DisclosureCategory
  title: string
  titleEn: string
  generateContent: (ctx: DisclosureTemplateContext) => string
  generateContentEn: (ctx: DisclosureTemplateContext) => string
  generateSections: (ctx: DisclosureTemplateContext) => DisclosureSection[]
  standardReferences: Array<{ referenceNumber: string; title: string; source: string }>
}

export const USGAAP_DISCLOSURE_TEMPLATES: Record<string, DisclosureTemplate> = {
  significant_accounting_policies: {
    category: 'significant_accounting_policies',
    title: '重要な会計方針',
    titleEn: 'Significant Accounting Policies',
    generateContent: (ctx) => `## 基礎となる会計基準

当社の財務諸表は、${ctx.targetStandard}に準拠して作成されております。
元の財務諸表は日本基準（JGAAP）に準拠して作成されており、
本変換は${ctx.periodStart}から${ctx.periodEnd}までの期間について実施しております。

## 変換の方法

変換は以下の方法で実施しております：
1. 動定科目マッピング
2. 会計処理の差異調整
3. 開示要件の適用

${
  ctx.adjustmentsPresent
    ? `## 主な調整事項

以下の調整仕訳が計上されております：
${ctx.adjustmentList || ''}
`
    : ''
}

## 参照基準
${ctx.standardReferences || 'ASC 235、ASC 250等'}`,
    generateContentEn: (ctx) => `## Basis of Accounting

The accompanying financial statements have been prepared in conformity with ${ctx.targetStandard}.
The original financial statements were prepared in conformity with Japanese GAAP (JGAAP),
and this conversion covers the period from ${ctx.periodStart} to ${ctx.periodEnd}.

## Conversion Method

The conversion was performed using the following methods:
1. Account mapping
2. Accounting treatment difference adjustments
3. Application of disclosure requirements

${
  ctx.adjustmentsPresent
    ? `## Significant Adjustments

The following adjusting entries have been recorded:
${ctx.adjustmentList || ''}
`
    : ''
}

## Reference Standards
${ctx.standardReferences || 'ASC 235, ASC 250, etc.'}`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '基礎となる会計基準',
        titleEn: 'Basis of Accounting',
        content: `当社の財務諸表は、${ctx.targetStandard}に準拠して作成されております。元の財務諸表は日本基準（JGAAP）に準拠して作成されており、本変換は${ctx.periodStart}から${ctx.periodEnd}までの期間について実施しております。`,
        contentEn: `The accompanying financial statements have been prepared in conformity with ${ctx.targetStandard}. The original financial statements were prepared in conformity with Japanese GAAP (JGAAP), and this conversion covers the period from ${ctx.periodStart} to ${ctx.periodEnd}.`,
        order: 1,
      },
      {
        id: 'sec-2',
        title: '変換の方法',
        titleEn: 'Conversion Method',
        content: `変換は以下の方法で実施しております：\n1. 動定科目マッピング\n2. 会計処理の差異調整\n3. 開示要件の適用`,
        contentEn: `The conversion was performed using the following methods:\n1. Account mapping\n2. Accounting treatment difference adjustments\n3. Application of disclosure requirements`,
        order: 2,
      },
    ],
    standardReferences: [
      { referenceNumber: 'ASC 235', title: 'Notes to Financial Statements', source: 'USGAAP' },
      {
        referenceNumber: 'ASC 250',
        title: 'Accounting Changes and Error Corrections',
        source: 'USGAAP',
      },
    ],
  },

  basis_of_conversion: {
    category: 'basis_of_conversion',
    title: '変換の基礎',
    titleEn: 'Basis of Conversion',
    generateContent: (ctx) => `## 変換の概要

${ctx.companyName}（以下「当社」）は、日本基準（JGAAP）に基づき作成された財務諸表を${ctx.targetStandard}に変換いたしました。

## 変換期間

${ctx.periodStart}から${ctx.periodEnd}まで

## 変換の範囲

本変換には以下の財務諸表が含まれます：
- 貸借対照表
- 損益計算書
- キャッシュフロー計算書
- 株主資本等変動計算書

## 変換の方法

変換は、日本基準と${ctx.targetStandard}との会計基準の差異を分析し、必要な調整仕訳を計上することにより実施しております。`,
    generateContentEn: (ctx) => `## Overview of Conversion

${ctx.companyName} (the "Company") has converted its financial statements prepared in accordance with Japanese GAAP (JGAAP) to ${ctx.targetStandard}.

## Conversion Period

From ${ctx.periodStart} to ${ctx.periodEnd}

## Scope of Conversion

The conversion includes the following financial statements:
- Balance Sheet
- Statement of Income
- Statement of Cash Flows
- Statement of Changes in Equity

## Conversion Method

The conversion was performed by analyzing the differences between Japanese GAAP and ${ctx.targetStandard}, and recording necessary adjusting entries.`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '変換の概要',
        titleEn: 'Overview of Conversion',
        content: `${ctx.companyName}（以下「当社」）は、日本基準（JGAAP）に基づき作成された財務諸表を${ctx.targetStandard}に変換いたしました。`,
        contentEn: `${ctx.companyName} (the "Company") has converted its financial statements prepared in accordance with Japanese GAAP (JGAAP) to ${ctx.targetStandard}.`,
        order: 1,
      },
      {
        id: 'sec-2',
        title: '変換期間',
        titleEn: 'Conversion Period',
        content: `${ctx.periodStart}から${ctx.periodEnd}まで`,
        contentEn: `From ${ctx.periodStart} to ${ctx.periodEnd}`,
        order: 2,
      },
    ],
    standardReferences: [
      { referenceNumber: 'ASC 810', title: 'Consolidation', source: 'USGAAP' },
      { referenceNumber: 'ASC 830', title: 'Foreign Currency Matters', source: 'USGAAP' },
    ],
  },

  standard_differences: {
    category: 'standard_differences',
    title: '会計基準の主な差異',
    titleEn: 'Significant Differences in Accounting Standards',
    generateContent: (ctx) => `## JGAAPと${ctx.targetStandard}の主な差異

本変換において、以下の会計基準の差異が重要な影響を与えております：

${ctx.differenceSections || '主な差異については、各開示事項を参照ください。'}

### 影響額の概要

| 項目 | JGAAP | ${ctx.targetStandard} | 差異 |
|------|-------|----------------------|------|
${ctx.differenceTable || '| データなし | - | - | - |'}`,
    generateContentEn: (ctx) => `## Significant Differences between JGAAP and ${ctx.targetStandard}

In this conversion, the following accounting standard differences have had a material impact:

${ctx.differenceSections || 'Please refer to each disclosure item for significant differences.'}

### Summary of Impact

| Item | JGAAP | ${ctx.targetStandard} | Difference |
|------|-------|----------------------|------------|
${ctx.differenceTable || '| No data | - | - | - |'}`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '主な差異',
        titleEn: 'Significant Differences',
        content: ctx.differenceSections || '主な差異については、各開示事項を参照ください。',
        contentEn:
          ctx.differenceSections ||
          'Please refer to each disclosure item for significant differences.',
        order: 1,
      },
    ],
    standardReferences: [
      {
        referenceNumber: 'ASC 250',
        title: 'Accounting Changes and Error Corrections',
        source: 'USGAAP',
      },
    ],
  },

  adjusting_entries: {
    category: 'adjusting_entries',
    title: '調整仕訳の開示',
    titleEn: 'Disclosure of Adjusting Entries',
    generateContent: (ctx) => `## 調整仕訳の概要

${ctx.targetStandard}への変換にあたり、以下の調整仕訳が計上されております：

${ctx.adjustmentDetails || '調整仕訳の詳細については、別紙調整仕訳一覧を参照ください。'}

### 調整の影響

| 項目 | 調整前 | 調整後 | 影響額 |
|------|--------|--------|--------|
${ctx.impactTable || '| データなし | - | - | - |'}

### 会計基準参照

${ctx.references || 'ASC 250等'}`,
    generateContentEn: (ctx) => `## Overview of Adjusting Entries

The following adjusting entries have been recorded for the conversion to ${ctx.targetStandard}:

${ctx.adjustmentDetails || 'Please refer to the attached list of adjusting entries for details.'}

### Impact of Adjustments

| Item | Before Adjustment | After Adjustment | Impact |
|------|-------------------|------------------|--------|
${ctx.impactTable || '| No data | - | - | - |'}

### Accounting Standard References

${ctx.references || 'ASC 250, etc.'}`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '調整仕訳の概要',
        titleEn: 'Overview of Adjusting Entries',
        content:
          ctx.adjustmentDetails || '調整仕訳の詳細については、別紙調整仕訳一覧を参照ください。',
        contentEn:
          ctx.adjustmentDetails ||
          'Please refer to the attached list of adjusting entries for details.',
        order: 1,
      },
    ],
    standardReferences: [
      {
        referenceNumber: 'ASC 250',
        title: 'Accounting Changes and Error Corrections',
        source: 'USGAAP',
      },
    ],
  },

  fair_value_measurement: {
    category: 'fair_value_measurement',
    title: '公正価値測定',
    titleEn: 'Fair Value Measurement',
    generateContent: (ctx) => `## 公正価値測定

当社は、${ctx.targetStandard}に基づき、公正価値で測定・開示する資産及び負債について、以下の通り開示しております。

### 公正価値階層

公正価値の測定は、以下の3つのレベルから成る公正価値階層に基づき分類されております：

- **レベル1**: 同一の資産又は負債の活発な市場での相場価格
- **レベル2**: レベル1の価格以外の、資産又は負債について直接的又は間接的に観察可能なインプット
- **レベル3**: 観察可能な市場データに基づかない、資産又は負債についてのインプット

${ctx.fairValueHierarchy || ''}

### 測定技法

${ctx.measurementMethods || '公正価値の測定には、市場アプローチ、コストアプローチ、インカムアプローチ等の技法が使用されております。'}`,
    generateContentEn: (ctx) => `## Fair Value Measurement

The Company discloses assets and liabilities measured and disclosed at fair value in accordance with ${ctx.targetStandard} as follows.

### Fair Value Hierarchy

Fair value measurements are classified based on the following three-level fair value hierarchy:

- **Level 1**: Quoted prices in active markets for identical assets or liabilities
- **Level 2**: Inputs other than Level 1 prices that are observable directly or indirectly for the asset or liability
- **Level 3**: Unobservable inputs for the asset or liability not based on observable market data

${ctx.fairValueHierarchy || ''}

### Valuation Techniques

${ctx.measurementMethods || 'Valuation techniques such as the market approach, cost approach, and income approach are used to measure fair value.'}`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '公正価値階層',
        titleEn: 'Fair Value Hierarchy',
        content: `公正価値の測定は、以下の3つのレベルから成る公正価値階層に基づき分類されております：\n- レベル1: 同一の資産又は負債の活発な市場での相場価格\n- レベル2: レベル1の価格以外の、資産又は負債について直接的又は間接的に観察可能なインプット\n- レベル3: 観察可能な市場データに基づかない、資産又は負債についてのインプット`,
        contentEn: `Fair value measurements are classified based on the following three-level fair value hierarchy:\n- Level 1: Quoted prices in active markets for identical assets or liabilities\n- Level 2: Inputs other than Level 1 prices that are observable directly or indirectly for the asset or liability\n- Level 3: Unobservable inputs for the asset or liability not based on observable market data`,
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'ASC 820', title: 'Fair Value Measurement', source: 'USGAAP' },
    ],
  },

  foreign_currency: {
    category: 'foreign_currency',
    title: '外貨換算',
    titleEn: 'Foreign Currency Translation',
    generateContent: (ctx) => `## 外貨換算

### 機能通貨

当社の機能通貨は日本円であります。

### 外貨換算の方法

${ctx.foreignCurrencyDetails || '外国子会社の財務諸表は、資産及び負債については決算日の為替相場で、収益及び費用については期間中の平均為替相場で日本円に換算しており、これによって生じた換算調整勘定は、純資産のその他の包括利益に計上しております。'}`,
    generateContentEn: (ctx) => `## Foreign Currency Translation

### Functional Currency

The Company's functional currency is the Japanese Yen.

### Translation Method

${ctx.foreignCurrencyDetails || 'The financial statements of foreign subsidiaries are translated into Japanese Yen using the exchange rate at the balance sheet date for assets and liabilities, and the average exchange rate for the period for revenues and expenses. The resulting translation adjustments are recorded in other comprehensive income within equity.'}`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '機能通貨',
        titleEn: 'Functional Currency',
        content: '当社の機能通貨は日本円であります。',
        contentEn: "The Company's functional currency is the Japanese Yen.",
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'ASC 830', title: 'Foreign Currency Matters', source: 'USGAAP' },
    ],
  },

  segment_information: {
    category: 'segment_information',
    title: 'セグメント情報',
    titleEn: 'Segment Information',
    generateContent: (ctx) => `## セグメント情報

### 報告セグメント

${ctx.segmentDetails || '当社の報告セグメントは、事業の性質に基づき構成されております。各セグメントの業績は、事業の意思決定者である代表取締役社長が業績を評価するために使用する方法と一貫した方法で評価されております。'}

### セグメント業績の評価

各セグメントの業績は、営業利益に基づき評価されております。`,
    generateContentEn: (ctx) => `## Segment Information

### Reportable Segments

${ctx.segmentDetails || "The Company's reportable segments are organized based on the nature of the business. The performance of each segment is evaluated in a manner consistent with the method used by the chief operating decision maker, the President and CEO, to assess performance."}

### Evaluation of Segment Performance

The performance of each segment is evaluated based on operating income.`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '報告セグメント',
        titleEn: 'Reportable Segments',
        content:
          ctx.segmentDetails || '当社の報告セグメントは、事業の性質に基づき構成されております。',
        contentEn:
          ctx.segmentDetails ||
          "The Company's reportable segments are organized based on the nature of the business.",
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'ASC 280', title: 'Segment Reporting', source: 'USGAAP' },
    ],
  },

  related_party: {
    category: 'related_party',
    title: '関連当事者',
    titleEn: 'Related Party Transactions',
    generateContent: (_ctx) => `## 関連当事者取引

### 関連当事者の範囲

関連当事者は、親会社、子会社、関連会社、役員、主要株主等を含みます。

### 取引の概要

関連当事者との取引は、通常の商取引条件と同様の条件で実施されております。`,
    generateContentEn: (_ctx) => `## Related Party Transactions

### Scope of Related Parties

Related parties include parent companies, subsidiaries, affiliates, officers, major shareholders, etc.

### Overview of Transactions

Transactions with related parties are conducted on terms equivalent to those of ordinary commercial transactions.`,
    generateSections: () => [
      {
        id: 'sec-1',
        title: '関連当事者の範囲',
        titleEn: 'Scope of Related Parties',
        content: '関連当事者は、親会社、子会社、関連会社、役員、主要株主等を含みます。',
        contentEn:
          'Related parties include parent companies, subsidiaries, affiliates, officers, major shareholders, etc.',
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'ASC 850', title: 'Related Party Disclosures', source: 'USGAAP' },
    ],
  },

  subsequent_events: {
    category: 'subsequent_events',
    title: '後発事象',
    titleEn: 'Subsequent Events',
    generateContent: (_ctx) => `## 後発事象

### 評価期間

当社は、財務諸表発行日までの期間における後発事象を評価しております。

### 後発事象の分類

- **認識すべき後発事象**: 財務諸表に反映する事象
- **開示すべき後発事象**: 財務諸表の注記で開示する事象`,
    generateContentEn: (_ctx) => `## Subsequent Events

### Evaluation Period

The Company evaluates subsequent events through the date the financial statements are issued.

### Classification of Subsequent Events

- **Recognized subsequent events**: Events reflected in the financial statements
- **Disclosed subsequent events**: Events disclosed in the notes to the financial statements`,
    generateSections: () => [
      {
        id: 'sec-1',
        title: '評価期間',
        titleEn: 'Evaluation Period',
        content: '当社は、財務諸表発行日までの期間における後発事象を評価しております。',
        contentEn:
          'The Company evaluates subsequent events through the date the financial statements are issued.',
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'ASC 855', title: 'Subsequent Events', source: 'USGAAP' },
    ],
  },

  commitments_contingencies: {
    category: 'commitments_contingencies',
    title: 'コミットメント及び偶発事象',
    titleEn: 'Commitments and Contingencies',
    generateContent: (_ctx) => `## コミットメント及び偶発事象

### コミットメント

当社は、将来の事業運営に関連するコミットメントを有している場合がございます。

### 偶発事象

偶発事象とは、過去の事象に起因し、その最終的な結果が現在は不確実であり、将来の事象の発生・不発生によって確定する事象をいいます。

### 引当金の認識

損失の発生が見込まれ、かつその金額が合理的に見積もれる場合には、引当金を計上しております。`,
    generateContentEn: (_ctx) => `## Commitments and Contingencies

### Commitments

The Company may have commitments related to future business operations.

### Contingencies

A contingency is an existing condition, situation, or set of circumstances involving uncertainty as to possible gain or loss that will ultimately be resolved when one or more future events occur or fail to occur.

### Recognition of Provisions

Provisions are recognized when a loss is probable and the amount can be reasonably estimated.`,
    generateSections: () => [
      {
        id: 'sec-1',
        title: '偶発事象',
        titleEn: 'Contingencies',
        content:
          '偶発事象とは、過去の事象に起因し、その最終的な結果が現在は不確実であり、将来の事象の発生・不発生によって確定する事象をいいます。',
        contentEn:
          'A contingency is an existing condition, situation, or set of circumstances involving uncertainty as to possible gain or loss that will ultimately be resolved when one or more future events occur or fail to occur.',
        order: 1,
      },
    ],
    standardReferences: [{ referenceNumber: 'ASC 450', title: 'Contingencies', source: 'USGAAP' }],
  },
}

export function getUSGAAPTemplate(category: string): DisclosureTemplate | undefined {
  return USGAAP_DISCLOSURE_TEMPLATES[category]
}

export function getUSGAAPCategories(): string[] {
  return Object.keys(USGAAP_DISCLOSURE_TEMPLATES)
}
