import type { DisclosureCategory, DisclosureSection } from '@/types/conversion'
import type { DisclosureTemplate, DisclosureTemplateContext } from './usgaap'

export const IFRS_DISCLOSURE_TEMPLATES: Record<string, DisclosureTemplate> = {
  significant_accounting_policies: {
    category: 'significant_accounting_policies',
    title: '重要な会計方針',
    titleEn: 'Significant Accounting Policies',
    generateContent: (ctx) => `## 基礎となる会計方針

当社の財務諸表は、国際財務報告基準（IFRS）に準拠して作成されております。
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
${ctx.standardReferences || 'IAS 1、IAS 8等'}`,
    generateContentEn: (ctx) => `## Basis of Accounting

The accompanying financial statements have been prepared in conformity with International Financial Reporting Standards (IFRS).
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
${ctx.standardReferences || 'IAS 1, IAS 8, etc.'}`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '基礎となる会計方針',
        titleEn: 'Basis of Accounting',
        content: `当社の財務諸表は、国際財務報告基準（IFRS）に準拠して作成されております。元の財務諸表は日本基準（JGAAP）に準拠して作成されており、本変換は${ctx.periodStart}から${ctx.periodEnd}までの期間について実施しております。`,
        contentEn: `The accompanying financial statements have been prepared in conformity with International Financial Reporting Standards (IFRS). The original financial statements were prepared in conformity with Japanese GAAP (JGAAP), and this conversion covers the period from ${ctx.periodStart} to ${ctx.periodEnd}.`,
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'IAS 1', title: 'Presentation of Financial Statements', source: 'IFRS' },
      {
        referenceNumber: 'IAS 8',
        title: 'Accounting Policies, Changes in Accounting Estimates and Errors',
        source: 'IFRS',
      },
    ],
  },

  basis_of_conversion: {
    category: 'basis_of_conversion',
    title: '変換の基礎',
    titleEn: 'Basis of Conversion',
    generateContent: (ctx) => `## 変換の概要

${ctx.companyName}（以下「当社」）は、日本基準（JGAAP）に基づき作成された財務諸表をIFRSに変換いたしました。

## 変換期間

${ctx.periodStart}から${ctx.periodEnd}まで

## 変換の範囲

本変換には以下の財務諸表が含まれます：
- 財政状態計算書
- 包括利益計算書
- 株主資本変動計算書
- キャッシュフロー計算書

## 変換の方法

変換は、日本基準とIFRSとの会計基準の差異を分析し、必要な調整仕訳を計上することにより実施しております。`,
    generateContentEn: (ctx) => `## Overview of Conversion

${ctx.companyName} (the "Company") has converted its financial statements prepared in accordance with Japanese GAAP (JGAAP) to IFRS.

## Conversion Period

From ${ctx.periodStart} to ${ctx.periodEnd}

## Scope of Conversion

The conversion includes the following financial statements:
- Statement of Financial Position
- Statement of Comprehensive Income
- Statement of Changes in Equity
- Statement of Cash Flows

## Conversion Method

The conversion was performed by analyzing the differences between Japanese GAAP and IFRS, and recording necessary adjusting entries.`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '変換の概要',
        titleEn: 'Overview of Conversion',
        content: `${ctx.companyName}（以下「当社」）は、日本基準（JGAAP）に基づき作成された財務諸表をIFRSに変換いたしました。`,
        contentEn: `${ctx.companyName} (the "Company") has converted its financial statements prepared in accordance with Japanese GAAP (JGAAP) to IFRS.`,
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'IFRS 1', title: 'First-time Adoption of IFRS', source: 'IFRS' },
      {
        referenceNumber: 'IAS 21',
        title: 'The Effects of Changes in Foreign Exchange Rates',
        source: 'IFRS',
      },
    ],
  },

  standard_differences: {
    category: 'standard_differences',
    title: '会計基準の主な差異',
    titleEn: 'Significant Differences in Accounting Standards',
    generateContent: (ctx) => `## JGAAPとIFRSの主な差異

本変換において、以下の会計基準の差異が重要な影響を与えております：

${ctx.differenceSections || '主な差異については、各開示事項を参照ください。'}

### 影響額の概要

| 項目 | JGAAP | IFRS | 差異 |
|------|-------|------|------|
${ctx.differenceTable || '| データなし | - | - | - |'}`,
    generateContentEn: (ctx) => `## Significant Differences between JGAAP and IFRS

In this conversion, the following accounting standard differences have had a material impact:

${ctx.differenceSections || 'Please refer to each disclosure item for significant differences.'}

### Summary of Impact

| Item | JGAAP | IFRS | Difference |
|------|-------|------|------------|
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
        referenceNumber: 'IAS 8',
        title: 'Accounting Policies, Changes in Accounting Estimates and Errors',
        source: 'IFRS',
      },
    ],
  },

  adjusting_entries: {
    category: 'adjusting_entries',
    title: '調整仕訳の開示',
    titleEn: 'Disclosure of Adjusting Entries',
    generateContent: (ctx) => `## 調整仕訳の概要

IFRSへの変換にあたり、以下の調整仕訳が計上されております：

${ctx.adjustmentDetails || '調整仕訳の詳細については、別紙調整仕訳一覧を参照ください。'}

### 調整の影響

| 項目 | 調整前 | 調整後 | 影響額 |
|------|--------|--------|--------|
${ctx.impactTable || '| データなし | - | - | - |'}

### 会計基準参照

${ctx.references || 'IAS 8等'}`,
    generateContentEn: (ctx) => `## Overview of Adjusting Entries

The following adjusting entries have been recorded for the conversion to IFRS:

${ctx.adjustmentDetails || 'Please refer to the attached list of adjusting entries for details.'}

### Impact of Adjustments

| Item | Before Adjustment | After Adjustment | Impact |
|------|-------------------|------------------|--------|
${ctx.impactTable || '| No data | - | - | - |'}

### Accounting Standard References

${ctx.references || 'IAS 8, etc.'}`,
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
        referenceNumber: 'IAS 8',
        title: 'Accounting Policies, Changes in Accounting Estimates and Errors',
        source: 'IFRS',
      },
    ],
  },

  fair_value_measurement: {
    category: 'fair_value_measurement',
    title: '公正価値測定',
    titleEn: 'Fair Value Measurement',
    generateContent: (ctx) => `## 公正価値測定

当社は、IFRS 13に基づき、公正価値で測定・開示する資産及び負債について、以下の通り開示しております。

### 公正価値の定義

公正価値とは、測定日において、市場参加者間の秩序ある取引において、資産を売却するために受け取るであろう価格、又は負債を移転するために支払うであろう価格をいいます。

### 公正価値階層

公正価値の測定は、以下の3つのレベルから成る公正価値階層に基づき分類されております：

- **レベル1**: 同一の資産又は負債の活発な市場での相場価格
- **レベル2**: レベル1の価格以外の、資産又は負債について直接的又は間接的に観察可能なインプット
- **レベル3**: 観察可能な市場データに基づかない、資産又は負債についてのインプット

${ctx.fairValueHierarchy || ''}`,
    generateContentEn: (ctx) => `## Fair Value Measurement

The Company discloses assets and liabilities measured and disclosed at fair value in accordance with IFRS 13 as follows.

### Definition of Fair Value

Fair value is the price that would be received to sell an asset or paid to transfer a liability in an orderly transaction between market participants at the measurement date.

### Fair Value Hierarchy

Fair value measurements are classified based on the following three-level fair value hierarchy:

- **Level 1**: Quoted prices in active markets for identical assets or liabilities
- **Level 2**: Inputs other than Level 1 prices that are observable directly or indirectly for the asset or liability
- **Level 3**: Unobservable inputs for the asset or liability not based on observable market data

${ctx.fairValueHierarchy || ''}`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '公正価値の定義',
        titleEn: 'Definition of Fair Value',
        content:
          '公正価値とは、測定日において、市場参加者間の秩序ある取引において、資産を売却するために受け取るであろう価格、又は負債を移転するために支払うであろう価格をいいます。',
        contentEn:
          'Fair value is the price that would be received to sell an asset or paid to transfer a liability in an orderly transaction between market participants at the measurement date.',
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'IFRS 13', title: 'Fair Value Measurement', source: 'IFRS' },
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

${ctx.foreignCurrencyDetails || '外国事業の財務諸表は、資産及び負債については決算日の為替相場で、収益及び費用については期間中の平均為替相場で日本円に換算しており、これによって生じた換算差額は、その他の包括利益に計上しております。'}

### 金融商品の外貨建取引

外貨建の金融商品は、認識時に取引日の為替相場で円に換算しております。`,
    generateContentEn: (ctx) => `## Foreign Currency Translation

### Functional Currency

The Company's functional currency is the Japanese Yen.

### Translation Method

${ctx.foreignCurrencyDetails || 'The financial statements of foreign operations are translated into Japanese Yen using the exchange rate at the balance sheet date for assets and liabilities, and the average exchange rate for the period for revenues and expenses. The resulting translation differences are recorded in other comprehensive income.'}

### Foreign Currency Transactions

Foreign currency denominated financial instruments are translated into Yen at the exchange rate on the transaction date at initial recognition.`,
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
      {
        referenceNumber: 'IAS 21',
        title: 'The Effects of Changes in Foreign Exchange Rates',
        source: 'IFRS',
      },
    ],
  },

  segment_information: {
    category: 'segment_information',
    title: 'セグメント情報',
    titleEn: 'Segment Information',
    generateContent: (ctx) => `## セグメント情報

### 報告セグメント

${ctx.segmentDetails || '当社の報告セグメントは、主要な意思決定者が業績を評価し、資源配分を決定するために使用する内部報告に基づき構成されております。'}

### セグメントの識別

事業セグメントは、独立した財務情報が入手可能であり、主要な意思決定者が資源配分の決定及び業績評価のために定期的に検討する構成要素として識別されております。`,
    generateContentEn: (ctx) => `## Segment Information

### Reportable Segments

${ctx.segmentDetails || "The Company's reportable segments are organized based on internal reports that are used by the chief operating decision maker for the purpose of allocating resources and assessing performance."}

### Identification of Segments

Operating segments are identified as components for which discrete financial information is available and which are regularly reviewed by the chief operating decision maker for resource allocation decisions and performance assessment.`,
    generateSections: (ctx) => [
      {
        id: 'sec-1',
        title: '報告セグメント',
        titleEn: 'Reportable Segments',
        content:
          ctx.segmentDetails ||
          '当社の報告セグメントは、主要な意思決定者が業績を評価し、資源配分を決定するために使用する内部報告に基づき構成されております。',
        contentEn:
          ctx.segmentDetails ||
          "The Company's reportable segments are organized based on internal reports that are used by the chief operating decision maker for the purpose of allocating resources and assessing performance.",
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'IFRS 8', title: 'Operating Segments', source: 'IFRS' },
    ],
  },

  related_party: {
    category: 'related_party',
    title: '関連当事者',
    titleEn: 'Related Party Disclosures',
    generateContent: (_ctx) => `## 関連当事者の開示

### 関連当事者の範囲

関連当事者には、以下が含まれます：
- 親会社
- 子会社
- 関連企業
- 共同支配企業
- 役員及び主要な経営幹部
- 役員及び主要な経営幹部の近親者

### 取引の開示

関連当事者との取引については、取引の性質及び金額を開示しております。`,
    generateContentEn: (_ctx) => `## Related Party Disclosures

### Scope of Related Parties

Related parties include:
- Parent company
- Subsidiaries
- Associates
- Jointly controlled entities
- Key management personnel
- Close family members of key management personnel

### Disclosure of Transactions

Transactions with related parties are disclosed with the nature and amounts of the transactions.`,
    generateSections: () => [
      {
        id: 'sec-1',
        title: '関連当事者の範囲',
        titleEn: 'Scope of Related Parties',
        content:
          '関連当事者には、親会社、子会社、関連企業、共同支配企業、役員及び主要な経営幹部、並びにその近親者が含まれます。',
        contentEn:
          'Related parties include parent company, subsidiaries, associates, jointly controlled entities, key management personnel, and their close family members.',
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'IAS 24', title: 'Related Party Disclosures', source: 'IFRS' },
    ],
  },

  subsequent_events: {
    category: 'subsequent_events',
    title: '後発事象',
    titleEn: 'Events After the Reporting Period',
    generateContent: (_ctx) => `## 報告期間後の事象

### 評価期間

当社は、財務諸表の発行日までの期間における報告期間後の事象を評価しております。

### 事象の分類

- **調整事象**: 報告日に既に存在していた条件を示す事象
- **非調整事象**: 報告日以降に発生した条件を示す事象`,
    generateContentEn: (_ctx) => `## Events After the Reporting Period

### Evaluation Period

The Company evaluates events after the reporting period through the date the financial statements are issued.

### Classification of Events

- **Adjusting events**: Events that provide evidence of conditions that existed at the end of the reporting period
- **Non-adjusting events**: Events that are indicative of conditions that arose after the reporting period`,
    generateSections: () => [
      {
        id: 'sec-1',
        title: '事象の分類',
        titleEn: 'Classification of Events',
        content:
          '調整事象は報告日に既に存在していた条件を示す事象であり、非調整事象は報告日以降に発生した条件を示す事象であります。',
        contentEn:
          'Adjusting events provide evidence of conditions that existed at the end of the reporting period, while non-adjusting events are indicative of conditions that arose after the reporting period.',
        order: 1,
      },
    ],
    standardReferences: [
      { referenceNumber: 'IAS 10', title: 'Events After the Reporting Period', source: 'IFRS' },
    ],
  },

  commitments_contingencies: {
    category: 'commitments_contingencies',
    title: 'コミットメント及び偶発事象',
    titleEn: 'Commitments and Contingencies',
    generateContent: (_ctx) => `## コミットメント及び偶発事象

### 条件付き資産

条件付き資産とは、過去の事象に起因し、その存在が完全に企業の支配下にない1つ以上の不確実な将来の事象の発生によってのみ確認される可能性がある資産をいいます。

### 条件付き負債

条件付き負債とは、過去の事象に起因する、以下のいずれかを満たす潜在的義務をいいます：
- 企業の支配下にない1つ以上の将来の事象の発生・不発生によって確認されるかどうかが確定しない義務
- 金額が合理的に見積もれない義務

### 引当金

引当金は、過去の事象に起因する現在の義務であって、履行のために資源の流出が見込まれ、かつ金額が信頼性をもって見積もれる場合に認識されます。`,
    generateContentEn: (_ctx) => `## Commitments and Contingencies

### Contingent Assets

A contingent asset is a possible asset that arises from past events and whose existence will be confirmed only by the occurrence or non-occurrence of one or more uncertain future events not wholly within the control of the entity.

### Contingent Liabilities

A contingent liability is a possible obligation that arises from past events and whose existence will be confirmed only by the occurrence or non-occurrence of one or more uncertain future events not wholly within the control of the entity, or a present obligation that arises from past events but is not recognized because it is not probable that an outflow of resources will be required or the amount cannot be measured with sufficient reliability.

### Provisions

A provision is recognized when there is a present obligation as a result of a past event, it is probable that an outflow of resources will be required to settle the obligation, and a reliable estimate can be made of the amount of the obligation.`,
    generateSections: () => [
      {
        id: 'sec-1',
        title: '条件付き負債',
        titleEn: 'Contingent Liabilities',
        content:
          '条件付き負債とは、過去の事象に起因する潜在的義務又は現在の義務であって、履行のために資源の流出が見込まれない又は金額が合理的に見積もれないものをいいます。',
        contentEn:
          'A contingent liability is a possible obligation or a present obligation that is not recognized because it is not probable that an outflow of resources will be required or the amount cannot be measured with sufficient reliability.',
        order: 1,
      },
    ],
    standardReferences: [
      {
        referenceNumber: 'IAS 37',
        title: 'Provisions, Contingent Liabilities and Contingent Assets',
        source: 'IFRS',
      },
    ],
  },
}

export function getIFRSTemplate(category: string): DisclosureTemplate | undefined {
  return IFRS_DISCLOSURE_TEMPLATES[category]
}

export function getIFRSCategories(): string[] {
  return Object.keys(IFRS_DISCLOSURE_TEMPLATES)
}
