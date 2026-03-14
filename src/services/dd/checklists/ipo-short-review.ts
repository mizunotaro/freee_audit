import type { DDChecklistItemDefinition } from '../types'

export const IPO_SHORT_REVIEW_CHECKLIST: DDChecklistItemDefinition[] = [
  // ========================================
  // 収益認識
  // ========================================
  {
    code: 'REV-001',
    category: 'REVENUE_RECOGNITION',
    title: '売上計上基準の文書化',
    titleEn: 'Revenue Recognition Policy Documentation',
    description: '売上計上基準が明確に文書化され、一貫して適用されているか',
    descriptionEn:
      'Whether revenue recognition policy is clearly documented and consistently applied',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['journals', 'account_items', 'contracts'],
    validationRules: [
      { type: 'COMPLETENESS', field: 'policy_document', required: true },
      { type: 'CONSISTENCY', field: 'recognition_timing', tolerance: 0 },
    ],
    aiCheckPrompt: `売上計上基準を分析してください。
1. 商品販売/サービス提供の計上タイミング基準を確認
2. 長期工事の進行基準/完工基準の適用状況
3. 返品権、キャンセル権のある売上の扱い
4. 売上値引・返品の引当金計上状況
5. 前受金から売上への振替の適時性`,
    relatedStandards: ['ASBJ Statement No.29', 'IFRS 15', 'ASC 606'],
    guidance:
      '収益認識に関する会計基準（ASBJ Statement No.29）に基づき、企業の実態に即した計上基準が設定されているか確認する。',
  },
  {
    code: 'REV-002',
    category: 'REVENUE_RECOGNITION',
    title: '進行基準の進捗度算定の妥当性',
    titleEn: 'Progress Measurement Reasonableness (Percentage of Completion)',
    description: '進行基準適用時の進捗度算定方法が妥当であるか',
    severity: 'HIGH',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['journals', 'contracts', 'progress_reports'],
    validationRules: [
      { type: 'CALCULATION', field: 'progress_rate', method: 'COST_TO_COST_OR_OUTPUT' },
      { type: 'COMPARISON', field: 'estimated_vs_actual_cost', tolerance: 0.1 },
    ],
    aiCheckPrompt: `進行基準の適用状況を分析してください。
1. 進捗度の算定方法（原価比例法/出来高法）の妥当性
2. 総見積原価の改訂履歴とその理由
3. 工事損失引当金の計上状況
4. 進捗度の客観的な証拠（第三者確認等）`,
    relatedStandards: ['ASBJ Statement No.15', 'IFRS 15'],
    guidance: '進捗度の算定は、客観的かつ検証可能な方法で行われている必要がある。',
  },
  {
    code: 'REV-003',
    category: 'REVENUE_RECOGNITION',
    title: '売上値引・返品の適正処理',
    titleEn: 'Sales Returns and Allowances Treatment',
    description: '売上値引・返品が適切に見積られ、引当金が計上されているか',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'returns_history', 'allowances'],
    validationRules: [
      { type: 'HISTORICAL_RATIO', field: 'returns_rate', lookback: 3, tolerance: 0.05 },
      { type: 'ACCRUAL', field: 'allowance_balance', comparison: 'VS_ACTUAL' },
    ],
    aiCheckPrompt: `売上値引・返品の処理を分析してください。
1. 過去3年間の返品率・値引率のトレンド
2. 返品引当金の期首残高と実際の返品の対比
3. 期末時点の返品見込の妥当性
4. 特定の顧客・製品への集中リスク`,
    relatedStandards: ['ASBJ Statement No.29'],
    guidance: '返品率が高い場合や季節変動がある場合、適切な引当金計上が必要。',
  },

  // ========================================
  // 売掛金
  // ========================================
  {
    code: 'AR-001',
    category: 'ACCOUNTS_RECEIVABLE',
    title: '売掛金の回収可能性評価',
    titleEn: 'Accounts Receivable Collectability Assessment',
    description: '売掛金の年齢調べと回収可能性が評価されているか',
    severity: 'CRITICAL',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'payments', 'aging_report'],
    validationRules: [
      {
        type: 'AGING',
        field: 'receivables',
        buckets: ['0-30', '31-60', '61-90', '91-180', '180+'],
      },
      { type: 'RATIO', field: 'bad_debt_ratio', threshold: 0.02 },
      { type: 'TREND', field: 'dso', lookback: 12 },
    ],
    aiCheckPrompt: `売掛金の回収可能性を分析してください。
1. 年齢調べの作成と長期滞留債権の特定
2. 顧客別の与信評価と回収実績
3. 貸倒引当金の計算方法と妥当性
4. 回収遅延の原因分析（業況、紛争等）
5. 特定顧客への集中度リスク`,
    relatedStandards: ['ASBJ Statement No.10'],
    guidance: '貸倒引当金は、過去の貸倒実績と回収可能性を勘案して計算する。',
  },
  {
    code: 'AR-002',
    category: 'ACCOUNTS_RECEIVABLE',
    title: '貸倒引当金の適正性',
    titleEn: 'Allowance for Doubtful Accounts Adequacy',
    description: '貸倒引当金が回収不能見込額を適切に反映しているか',
    severity: 'CRITICAL',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'allowance', 'write_offs'],
    validationRules: [
      { type: 'ACTUAL_VS_ESTIMATED', field: 'write_offs', lookback: 3 },
      { type: 'COVERAGE_RATIO', field: 'allowance_to_ar', min: 0.01, max: 0.1 },
    ],
    aiCheckPrompt: `貸倒引当金の適正性を分析してください。
1. 過去3年間の貸倒実績と引当金計上の対比
2. 貸倒償却の基準と実際の適用状況
3. 税法基準と実質的評価の差異
4. 債権償却特別勘定の活用状況`,
    relatedStandards: ['ASBJ Statement No.10', 'Tax Law Article 52'],
    guidance: '税法基準だけでなく、実質的な回収可能性に基づく評価が必要。',
  },

  // ========================================
  // 棚卸資産
  // ========================================
  {
    code: 'INV-001',
    category: 'INVENTORY',
    title: '棚卸資産評価方法の継続性',
    titleEn: 'Inventory Valuation Method Consistency',
    description: '棚卸資産の評価方法が継続的に適用されているか',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'inventory', 'accounting_policies'],
    validationRules: [
      { type: 'POLICY_CHANGE', field: 'valuation_method', required: true },
      { type: 'COMPARABILITY', field: 'cost_flow_assumption' },
    ],
    aiCheckPrompt: `棚卸資産評価方法を分析してください。
1. 評価方法（原価法/低価法）と原価の算定方法（先入先出法等）
2. 評価方法の変更履歴と正当な理由
3. 事業セグメント間での評価方法の統一性
4. 期末評価損の計上基準と実績`,
    relatedStandards: ['ASBJ Statement No.9'],
    guidance: '評価方法の変更は、正当な理由があり、開示されている場合のみ認められる。',
  },
  {
    code: 'INV-002',
    category: 'INVENTORY',
    title: '棚卸資産評価損の計上',
    titleEn: 'Inventory Write-down Recognition',
    description: '簿価切り下げが必要な棚卸資産に評価損が計上されているか',
    severity: 'CRITICAL',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'inventory', 'write_downs', 'sales_data'],
    validationRules: [
      { type: 'COMPARISON', field: 'book_vs_net_realizable', tolerance: 0 },
      { type: 'SLOW_MOVING', field: 'turnover_days', threshold: 180 },
      { type: 'OBSOLESCENCE', field: 'aging' },
    ],
    aiCheckPrompt: `棚卸資産評価損の計上状況を分析してください。
1. 正味実現可能価額（NRV）との比較
2. 流動化期間の長期化している品目
3. 陳腐化・型遅れリスクのある品目
4. 評価損計上の基準と実際の適用状況
5. 棚卸資産回転率のトレンド分析`,
    relatedStandards: ['ASBJ Statement No.9'],
    guidance: '簿価切り下げが必要な場合は、即時に評価損を計上する。',
  },
  {
    code: 'INV-003',
    category: 'INVENTORY',
    title: '実地棚卸の実施と確認',
    titleEn: 'Physical Inventory Count Implementation',
    description: '実地棚卸が適切に実施され、帳簿棚卸と照合されているか',
    severity: 'HIGH',
    checkType: 'MANUAL',
    dataSource: ['inventory_count', 'adjustments'],
    validationRules: [
      { type: 'FREQUENCY', field: 'count_date', annual: true },
      { type: 'VARIANCE', field: 'count_vs_book', tolerance: 0.02 },
    ],
    aiCheckPrompt: `実地棚卸の実施状況を評価してください。
1. 棚卸実施日、実施方法（一斉/循環）
2. 棚卸担当者の独立性と訓練状況
3. 帳簿棚卸との差異とその原因分析
4. 差異調整の承認プロセス
5. 前年度との比較と継続的な問題の特定`,
    relatedStandards: ['ASBJ Statement No.9'],
    guidance: '実地棚卸は、棚卸資産の存在確認と評価の基礎となる重要な手続。',
  },

  // ========================================
  // 固定資産
  // ========================================
  {
    code: 'FA-001',
    category: 'FIXED_ASSETS',
    title: '減価償却方法の妥当性',
    titleEn: 'Depreciation Method Appropriateness',
    description: '減価償却方法が資産の経済的耐用年数を反映しているか',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'fixed_assets', 'depreciation_policy'],
    validationRules: [
      { type: 'ECONOMIC_LIFE', field: 'useful_life', comparison: 'VS_INDUSTRY' },
      { type: 'SALVAGE_VALUE', field: 'residual_value', max: 0.1 },
      { type: 'METHOD_CONSISTENCY', field: 'depreciation_method' },
    ],
    aiCheckPrompt: `減価償却方法を分析してください。
1. 資産カテゴリ別の償却方法（定額法/定率法）
2. 耐用年数の設定根拠と業界比較
3. 残存価額の設定と税法との整合性
4. 償却方法の変更履歴と影響額
5. 税務償却と会計償却の差異分析`,
    relatedStandards: ['ASBJ Statement No.6', 'Tax Law Article 31'],
    guidance: '減価償却は、資産の経済的便益の消費パターンを反映すべき。',
  },
  {
    code: 'FA-002',
    category: 'FIXED_ASSETS',
    title: '減損テストの実施',
    titleEn: 'Impairment Test Implementation',
    description: '減損の兆候がある固定資産に対して減損テストが実施されているか',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['fixed_assets', 'cash_flow_projections', 'market_data'],
    validationRules: [
      {
        type: 'INDICATOR_CHECK',
        field: 'impairment_indicators',
        categories: ['EXTERNAL', 'INTERNAL'],
      },
      { type: 'RECOVERABILITY', field: 'carrying_vs_recoverable' },
    ],
    aiCheckPrompt: `減損テストの必要性を分析してください。
1. 減損の兆候（市場価値下落、使用状況の変更等）
2. キャッシュ生成単位（CGU）の特定
3. 回収可能価額（使用価値/正味売却価額）の算定
4. 減損損失の計上と開示
5. 減損反転の可能性（IFRSの場合）`,
    relatedStandards: ['ASBJ Statement No.6', 'IAS 36'],
    guidance: '減損の兆候がある場合は、直ちに減損テストを実施する。',
  },

  // ========================================
  // 繰延資産
  // ========================================
  {
    code: 'DA-001',
    category: 'DEFERRED_ASSETS',
    title: '試験研究費の資産計上基準',
    titleEn: 'R&D Costs Capitalization Criteria',
    description: '試験研究費が適切に費用処理または資産計上されているか',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['journals', 'r_and_d', 'projects'],
    validationRules: [
      {
        type: 'CRITERIA_CHECK',
        field: 'capitalization',
        criteria: ['FUTURE_BENEFITS', 'MEASURABILITY'],
      },
      { type: 'AMORTIZATION', field: 'period', max: 20 },
    ],
    aiCheckPrompt: `試験研究費の処理を分析してください。
1. 研究費と開発費の区分基準
2. 資産計上の条件（将来収益、測定可能性）
3. 償却期間と方法の妥当性
4. 税務上の処理（即時償却）との差異
5. IFRS/US GAAPとの差異（コンバージョン時）`,
    relatedStandards: ['ASBJ Statement No.7', 'IAS 38', 'ASC 730'],
    guidance: 'JGAAPでは選択適用可能、IFRSでは開発費の資産計上が原則。',
  },
  {
    code: 'DA-002',
    category: 'DEFERRED_ASSETS',
    title: 'ソフトウェアの資産計上',
    titleEn: 'Software Development Costs Capitalization',
    description: 'ソフトウェア開発費が適切に処理されているか',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'software_assets', 'projects'],
    validationRules: [
      { type: 'CATEGORY', field: 'software_type', values: ['FOR_SALE', 'INTERNAL_USE'] },
      { type: 'CAPITALIZATION_START', field: 'stage', value: 'DEVELOPMENT' },
      { type: 'AMORTIZATION', field: 'method', value: 'STRAIGHT_LINE' },
    ],
    aiCheckPrompt: `ソフトウェア開発費の処理を分析してください。
1. 販売用/内部利用の区分と計上基準の違い
2. 概念実証完了後の資産計上開始時期
3. 償却期間（5年法/予想耐用年数）
4. 保守費用と資産計上額の区分
5. 未完成ソフトウェアの進捗度評価`,
    relatedStandards: ['ASBJ Practical Solution No.28', 'ASC 350-40'],
    guidance: '内部利用ソフトウェアは、アプリケーション開発段階の費用を資産計上。',
  },

  // ========================================
  // 引当金
  // ========================================
  {
    code: 'ALL-001',
    category: 'ALLOWANCES',
    title: '賞与引当金の計上',
    titleEn: 'Bonus Accrual',
    description: '賞与引当金が支給見込額に基づき適切に計上されているか',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'payroll', 'bonus_accrual'],
    validationRules: [
      { type: 'ACCRUAL_RATIO', field: 'accrued_vs_paid', lookback: 3, tolerance: 0.05 },
      { type: 'TIMING', field: 'fiscal_year_match' },
    ],
    aiCheckPrompt: `賞与引当金を分析してください。
1. 過去の支給実績と引当計上の対比
2. 支給対象期間と計上期間の整合性
3. 使用人賞与と役員賞与の区分
4. 税務調整の必要性`,
    relatedStandards: ['ASBJ Statement No.13'],
    guidance: '当該事業年度に属する支給見込額を計上する。',
  },
  {
    code: 'ALL-002',
    category: 'ALLOWANCES',
    title: '退職給付引当金の適正性',
    titleEn: 'Retirement Benefit Accrual Adequacy',
    description: '退職給付引当金が精算主義で計上されているか',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['journals', 'retirement_benefits', 'actuarial_report'],
    validationRules: [
      { type: 'ACTUARIAL', field: 'calculation_method', value: 'PROJECTED_UNIT_CREDIT' },
      { type: 'DISCOUNT_RATE', field: 'rate', comparison: 'VS_MARKET' },
      { type: 'FUNDING_STATUS', field: 'overfunded_or_underfunded' },
    ],
    aiCheckPrompt: `退職給付引当金を分析してください。
1. 精算数学的計算の前提（割引率、期待運用収益率）
2. 過去の損益分析とその処理方法
3. 未認識項目の開示
4. 年金資産の存在と評価
5. IFRS/US GAAPとの差異`,
    relatedStandards: ['ASBJ Statement No.16', 'IAS 19', 'ASC 715'],
    guidance: '退職給付債務の現在価値を、信頼性のある見積りに基づき計算する。',
  },
  {
    code: 'ALL-003',
    category: 'ALLOWANCES',
    title: '製品保証引当金',
    titleEn: 'Product Warranty Accrual',
    description: '製品保証に係る引当金が適切に計上されているか',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'warranty_claims', 'sales'],
    validationRules: [
      { type: 'HISTORICAL_RATIO', field: 'claims_rate', lookback: 3 },
      { type: 'ACCRUAL_ADEQUACY', field: 'accrued_vs_actual' },
    ],
    aiCheckPrompt: `製品保証引当金を分析してください。
1. 過去の保証請求実績と引当計上の対比
2. 保証期間と製品カテゴリ別の分析
3. 大規模リコール等の偶発事象
4. 引当金の計算方法の妥当性`,
    relatedStandards: ['ASBJ Statement No.13'],
    guidance: '過去の実績に基づき、合理的に見積もった金額を計上する。',
  },

  // ========================================
  // リース
  // ========================================
  {
    code: 'LEA-001',
    category: 'LEASES',
    title: 'リース取引の分類',
    titleEn: 'Lease Classification',
    description: 'リース取引がファイナンス/オペレーティングに適切に分類されているか',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'leases', 'contracts'],
    validationRules: [
      { type: 'OWNERSHIP_TRANSFER', field: 'ownership_transfer' },
      { type: 'BARGAIN_PURCHASE', field: 'purchase_option' },
      { type: 'LEASE_TERM', field: 'lease_term_ratio', threshold: 0.75 },
      { type: 'PRESENT_VALUE', field: 'pv_ratio', threshold: 0.9 },
    ],
    aiCheckPrompt: `リース取引の分類を分析してください。
1. 所有権移転フリーキャッシュフロー判定
2. 割安購入選択権の有無
3. リース期間の経済的耐用年数に対する割合
4. リース料現在価値の公正価値に対する割合
5. 特殊仕様資産の判定`,
    relatedStandards: ['ASBJ Statement No.13', 'IFRS 16', 'ASC 842'],
    guidance: 'JGAAPではフルペイアウトリースのオンバランス化IFRS16では全リースのオンバランス化',
  },

  // ========================================
  // 関連当事者
  // ========================================
  {
    code: 'RP-001',
    category: 'RELATED_PARTY',
    title: '関連当事者の特定',
    titleEn: 'Related Party Identification',
    description: '関連当事者が完全に特定されているか',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['shareholders', 'directors', 'subsidiaries', 'associates'],
    validationRules: [
      { type: 'OWNERSHIP', field: 'voting_rights', threshold: 0.2 },
      { type: 'CONTROL', field: 'significant_influence' },
      { type: 'KEY_MANAGEMENT', field: 'directors_and_officers' },
    ],
    aiCheckPrompt: `関連当事者を特定してください。
1. 親会社・子会社・関連会社
2. 役員・主要株主（10%以上)
3. 役員の近親者
4. 実質的な支配力を持つ者
5. 共同支配企業・関連企業`,
    relatedStandards: ['ASBJ Statement No.11', 'IAS 24'],
    guidance: '関連当事者の範囲は、支配力・影響力の観点から包括的に特定する。',
  },
  {
    code: 'RP-002',
    category: 'RELATED_PARTY',
    title: '関連当事者取引の価格の妥当性',
    titleEn: 'Related Party Transaction Pricing',
    description: '関連当事者との取引価格が独立当事者間価格と乖離していないか',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['journals', 'related_party_transactions', 'market_prices'],
    validationRules: [
      { type: 'COMPARABLE', field: 'price', comparison: 'VS_MARKET', tolerance: 0.1 },
      { type: 'DISCLOSURE', field: 'transaction_details', required: true },
    ],
    aiCheckPrompt: `関連当事者取引の価格を分析してください。
1. 類似取引（独立当事者間）との価格比較
2. 取引条件（支払条件、数量等)の相違
3. 移転価格税制の観点からの分析
4. 利益操作のリスク評価`,
    relatedStandards: ['ASBJ Statement No.11', 'IAS 24', 'Transfer Pricing Guidelines'],
    guidance: '関連当事者取引は独立当事者間の通常の条件と大きく異ならないことが望ましい。',
  },

  // ========================================
  // 税務
  // ========================================
  {
    code: 'TAX-001',
    category: 'TAX',
    title: '法人税申告と帳簿の整合性',
    titleEn: 'Corporate Tax Return vs Books Consistency',
    description: '法人税申告書と会計帳簿の間の差異が適切に分析されているか',
    severity: 'CRITICAL',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'tax_returns', 'tax_effect'],
    validationRules: [
      { type: 'RECONCILIATION', field: 'book_vs_tax_income' },
      { type: 'TIMING_DIFFERENCES', field: 'permanent_vs_temporary' },
    ],
    aiCheckPrompt: `法人税申告と帳簿の整合性を分析してください。
1. 税引前当期純利益と課税所得の調整表
2. 永久差異（交際費等）と一時差異の区分
3. 税務調査の指摘事項と対応状況
4. 申告調整の継続性と妥当性`,
    relatedStandards: ['Corporate Tax Law', 'ASBJ Statement No.28'],
    guidance: '申告調整の内容を理解し、税効果会計に反映する。',
  },
  {
    code: 'TAX-002',
    category: 'TAX',
    title: '繰延税金資産の回収可能性',
    titleEn: 'Deferred Tax Asset Recoverability',
    description: '繰延税金資産が回収可能であると判断できるか',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['tax_effect', 'future_profits', 'tax_planning'],
    validationRules: [
      { type: 'FUTURE_PROFITABILITY', field: 'forecasted_income', years: 5 },
      { type: 'SCHEDULING', field: 'reversal_pattern' },
      { type: 'VALUATION_ALLOWANCE', field: 'adequacy' },
    ],
    aiCheckPrompt: `繰延税金資産の回収可能性を分析してください。
1. 一時差異の解消スケジュール
2. 将来の課税所得見込み
3. 税額控除の繰越期間
4. 税務計画の利用可能性
5. 評価性引当金の必要性判定`,
    relatedStandards: ['ASBJ Statement No.28', 'IAS 12'],
    guidance: '「実現可能性が高い」場合を除き、評価性引当金を計上する。',
  },

  // ========================================
  // 偶発事象
  // ========================================
  {
    code: 'CON-001',
    category: 'CONTINGENCIES',
    title: '訴訟・係争中の事項',
    titleEn: 'Litigation and Pending Claims',
    description: '訴訟・係争中の事項が適切に開示されているか',
    severity: 'CRITICAL',
    checkType: 'MANUAL',
    dataSource: ['legal_matters', 'litigation'],
    validationRules: [
      { type: 'DISCLOSURE', field: 'nature_and_amount' },
      { type: 'PROVISION', field: 'probable_loss' },
    ],
    aiCheckPrompt: `訴訟・係争中の事項を分析してください。
1. 係争中の訴訟の一覧と状況
2. 敗訴可能性と損失見込額の範囲
3. 弁護士意見の入手状況
4. 訴訟費用の処理方法
5. 開示の必要性と内容`,
    relatedStandards: ['ASBJ Statement No.13', 'IAS 37'],
    guidance: '損失の発生が予測される場合、引当金を計上または注記する。',
  },
  {
    code: 'CON-002',
    category: 'CONTINGENCIES',
    title: '債務保証',
    titleEn: 'Guarantees and Indemnifications',
    description: '債務保証等の偶発債務が開示されているか',
    severity: 'HIGH',
    checkType: 'MANUAL',
    dataSource: ['guarantees', 'indemnifications'],
    validationRules: [
      { type: 'IDENTIFICATION', field: 'all_guarantees' },
      { type: 'DISCLOSURE', field: 'maximum_exposure' },
    ],
    aiCheckPrompt: `債務保証を分析してください。
1. 保証債務の一覧（金額、相手先、期限）
2. 主債務者の信用状況
3. 代位弁済の可能性
4. 求償権の行使可能性
5. 開示の適切性`,
    relatedStandards: ['ASBJ Statement No.13'],
    guidance: '偶発債務は、金額が重要な場合注記する。',
  },

  // ========================================
  // 後発事象
  // ========================================
  {
    code: 'SUB-001',
    category: 'SUBSEQUENT_EVENTS',
    title: '決算日後の重要事象',
    titleEn: 'Significant Subsequent Events',
    description: '決算日後の重要事象が適切に処理・開示されているか',
    severity: 'HIGH',
    checkType: 'MANUAL',
    dataSource: ['subsequent_events'],
    validationRules: [
      { type: 'CUTOFF', field: 'event_date', comparison: 'VS_REPORTING_DATE' },
      { type: 'CLASSIFICATION', field: 'adjusting_vs_non_adjusting' },
    ],
    aiCheckPrompt: `決算日後の重要事象を分析してください。
1. 決算日から報告日までの重要事象
2. 調整事象（決算日存在の証拠）と非調整事象の区分
3. 財務諸表への調整または注記
4. M&A、株式発行、重大な損失等`,
    relatedStandards: ['ASBJ Statement No.24', 'IAS 10'],
    guidance: '決算日以前に存在した状況に影響を与える事象は調整する。',
  },

  // ========================================
  // 内部統制
  // ========================================
  {
    code: 'IC-001',
    category: 'INTERNAL_CONTROLS',
    title: '内部統制の整備・運用状況',
    titleEn: 'Internal Control System',
    description: '財務報告に係る内部統制が整備・運用されているか',
    severity: 'HIGH',
    checkType: 'MANUAL',
    dataSource: ['internal_controls', 'process_documentation'],
    validationRules: [
      { type: 'DOCUMENTATION', field: 'control_activities' },
      { type: 'TESTING', field: 'operating_effectiveness' },
    ],
    aiCheckPrompt: `内部統制を評価してください。
1. 財務報告プロセスの文書化
2. 不正リスクの評価
3. 重要な不具合の特定状況
4. 是正措置の実施状況`,
    relatedStandards: ['J-SOX', 'COSO Framework'],
    guidance: 'IPO時には内部統制報告書の提出が求められる。',
  },

  // ========================================
  // 開示
  // ========================================
  {
    code: 'DIS-001',
    category: 'DISCLOSURES',
    title: '会計方針の開示',
    titleEn: 'Accounting Policies Disclosure',
    description: '重要な会計方針が適切に開示されているか',
    severity: 'HIGH',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['notes', 'accounting_policies'],
    validationRules: [
      { type: 'COMPLETENESS', field: 'material_policies' },
      { type: 'CLARITY', field: 'description' },
    ],
    aiCheckPrompt: `会計方針の開示を分析してください。
1. 重要な会計方針の網羅性
2. 判断の多い領域（収益認識等）の説明
3. 会計基準の変更とその影響
4. 開示の明瞭性`,
    relatedStandards: ['ASBJ Statement No.10'],
    guidance: '重要な会計方針は、財務諸表の利用者が理解できるよう開示する。',
  },
]
