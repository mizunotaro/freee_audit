import type { DDChecklistItemDefinition } from '../types'

export const MA_FINANCIAL_DD_CHECKLIST: readonly DDChecklistItemDefinition[] = [
  // ========================================
  // 財務諸表の品質・整合性
  // ========================================
  {
    code: 'MA-FIN-001',
    category: 'REVENUE_RECOGNITION',
    title: '収益認識ポリシーの分析',
    titleEn: 'Revenue Recognition Policy Analysis',
    description: '収益認識基準の適切性と一貫性、M&A後の影響分析',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['journals', 'revenue_contracts', 'accounting_policies'],
    validationRules: [
      { type: 'POLICY_CHANGE', field: 'revenue_policy', required: true },
      { type: 'COMPARABILITY', field: 'recognition_timing' },
    ],
    aiCheckPrompt: `収益認識ポリシーを分析し、M&Aにおけるリスクを評価してください。
1. 収益認識基準（JGAAP/IFRS/US GAAP）の特定
2. 認識タイミング（出荷基準/検収基準/権利確定基準等）
3. 複合要素契約の処理（商品+サービス等）
4. 期間配分の処理（サブスクリプション等）
5. 買収後の会計基準統一における影響`,
    relatedStandards: ['ASBJ Statement No.29', 'IFRS 15', 'ASC 606'],
    guidance: '収益認識は財務諸表の最重要項目。買収後の統合で変更の可能性を評価。',
  },
  {
    code: 'MA-FIN-002',
    category: 'ACCOUNTS_RECEIVABLE',
    title: '売掛金の実在性と回収可能性',
    titleEn: 'AR Existence and Collectability',
    description: '売掛金の実在性確認、年齢調べ、回収可能性評価',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'ar_aging', 'customer_master', 'collections'],
    validationRules: [
      {
        type: 'AGING',
        field: 'receivables',
        buckets: ['0-30', '31-60', '61-90', '91-180', '180+'],
      },
      { type: 'RATIO', field: 'bad_debt_ratio', threshold: 0.02 },
      { type: 'TREND', field: 'dso', lookback: 12 },
    ],
    aiCheckPrompt: `売掛金の品質を分析し、回収リスクを評価してください。
1. 年齢調べの作成と長期滞留債権の特定
2. 顧客集中度（トップ10顧客の構成比）
3. 関連当事者からの売掛金の分離
4. 過去の貸倒実績と引当金の適正性
5. 売掛金回転期間(DSO)の推移`,
    relatedStandards: ['ASBJ Statement No.10'],
    guidance: 'M&Aでは売掛金の実在性と回収可能性が買収価格に直結。',
  },
  {
    code: 'MA-FIN-003',
    category: 'INVENTORY',
    title: '棚卸資産の評価と回転効率',
    titleEn: 'Inventory Valuation and Turnover',
    description: '棚卸資産の評価方法、滞留在庫、評価損の適正性',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'inventory', 'inventory_counts'],
    validationRules: [
      { type: 'METHOD_CONSISTENCY', field: 'valuation_method' },
      { type: 'SLOW_MOVING', field: 'inventory_aging', threshold: 180 },
      { type: 'RATIO', field: 'inventory_turnover', min: 2 },
    ],
    aiCheckPrompt: `棚卸資産を分析し、評価リスクを特定してください。
1. 評価方法（原価法/低価法）の確認
2. 滞留在庫の特定と評価損の必要性
3. 棚卸資産回転期間(DIO)の推移
4. 実地棚卸の実施状況と差異分析
5. 製品ミックス変化の影響`,
    relatedStandards: ['ASBJ Statement No.9'],
    guidance: '棚卸資産の過大計上は買収価格を過大にするリスクあり。',
  },

  // ========================================
  // 財務調整項目（EBITDA正規化）
  // ========================================
  {
    code: 'MA-NORM-001',
    category: 'PRO_FORMA',
    title: 'EBITDA正規化調整項目の特定',
    titleEn: 'EBITDA Normalization Adjustments',
    description: '非経常項目、所有者報酬、関連当事者取引の正規化',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['journals', 'trial_balance', 'related_party_transactions'],
    validationRules: [
      { type: 'NORMALIZATION', field: 'non_recurring_items' },
      { type: 'EBITDA_ADJUSTMENT', field: 'owner_compensation' },
      { type: 'RELATED_PARTY', field: 'related_transactions', required: true },
    ],
    aiCheckPrompt: `EBITDA正規化調整項目を特定してください。
1. 非経常損益（固定資産売却益、訴訟費用等）
2. 所有者報酬の市場価格との乖離
3. 関連当事者取引の通常価格からの乖離
4. 賃借料の市場価格との比較
5. 経営者給与・賞与の正規化`,
    relatedStandards: ['Valuation Standards', 'IVS'],
    guidance: '正規化EBITDAは企業価値評価の基礎。過度な調整は避ける。',
  },
  {
    code: 'MA-NORM-002',
    category: 'PRO_FORMA',
    title: 'プロフォーマ財務諸表の作成',
    titleEn: 'Pro Forma Financial Statements',
    description: '買収後の統合効果を反映したプロフォーマ財務諸表',
    severity: 'HIGH',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['financial_statements', 'synergy_estimates', 'integration_plan'],
    validationRules: [
      { type: 'PRO_FORMA', field: 'combined_statements' },
      { type: 'SYNERGIES', field: 'cost_synergies' },
      { type: 'SYNERGIES', field: 'revenue_synergies' },
    ],
    aiCheckPrompt: `プロフォーマ財務諸表の妥当性を分析してください。
1. 買収後の統合費用の見積もり
2. コストシナジーの実現可能性とタイミング
3. 売上シナジーの保守的見積もり
4. 統合リスクと遅延の考慮
5. 財務構造の変化（負債、資本）`,
    relatedStandards: ['IFRS 3', 'ASC 805'],
    guidance: 'プロフォーマは投資家情報開示にも使用。保守的な前提を推奨。',
  },

  // ========================================
  // 運転資本分析
  // ========================================
  {
    code: 'MA-WC-001',
    category: 'WORKING_CAPITAL',
    title: '運転資本サイクルの分析',
    titleEn: 'Working Capital Cycle Analysis',
    description: 'キャッシュコンバージョンサイクル、季節変動の分析',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['journals', 'balance_sheet', 'cash_flow'],
    validationRules: [
      { type: 'SEASONALITY', field: 'working_capital' },
      { type: 'RATIO', field: 'cash_conversion_cycle' },
      { type: 'TREND', field: 'nwc_to_revenue', lookback: 12 },
    ],
    aiCheckPrompt: `運転資本サイクルを分析してください。
1. キャッシュコンバージョンサイクル(CCC)の計算
   CCC = DSO + DIO - DPO
2. 季節変動パターンの特定
3. 業界ベンチマークとの比較
4. 過不足運転資本の算定
5. 買収時の運転資本調整条項への影響`,
    relatedStandards: ['Valuation Best Practices'],
    guidance: '運転資本は買収価格調整の主要項目。季節調整が重要。',
  },

  // ========================================
  // シナジー評価
  // ========================================
  {
    code: 'MA-SYN-001',
    category: 'SYNERGIES',
    title: 'コストシナジーの実現可能性評価',
    titleEn: 'Cost Synergy Realizability Assessment',
    description: '統合によるコスト削減効果の妥当性とリスク評価',
    severity: 'HIGH',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['cost_structure', 'headcount', 'facilities', 'procurement'],
    validationRules: [
      { type: 'VARIANCE', field: 'cost_savings', tolerance: 0.2 },
      { type: 'TIMING', field: 'realization_period' },
      { type: 'DOCUMENTATION', field: 'synergy_sources', required: true },
    ],
    aiCheckPrompt: `コストシナジーの実現可能性を評価してください。
1. 人件費削減：重複部門、管理職層の統合
2. 調達シナジー：購買力強化、ベンダー統合
3. 施設統合：拠点集約、賃料削減
4. IT・システム統合コストと削減効果
5. 実現リスクとタイムラインの現実性`,
    relatedStandards: ['Valuation Standards'],
    guidance: 'コストシナジーは80%程度の実現率を想定。楽観的見積もりを避ける。',
  },
  {
    code: 'MA-SYN-002',
    category: 'SYNERGIES',
    title: '売上シナジーの保守的評価',
    titleEn: 'Revenue Synergy Conservative Assessment',
    description: 'クロスセル、市場拡大等の売上シナジーの保守的評価',
    severity: 'MEDIUM',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['sales_data', 'customer_base', 'market_analysis'],
    validationRules: [
      { type: 'TREND', field: 'cross_sell_potential' },
      { type: 'MARKET_RATE', field: 'market_share_impact' },
    ],
    aiCheckPrompt: `売上シナジーの保守的評価を行ってください。
1. クロスセル機会の特定と実現確率
2. 新規市場への参入効果
3. ブランド統合による価格プレミアム
4. 顧客基盤の拡大効果
5. 実現までのタイムラグの考慮`,
    relatedStandards: ['Valuation Standards'],
    guidance: '売上シナジーは不確実性が高く、評価には50%程度のディスカウント推奨。',
  },

  // ========================================
  // 買収価格配分（PPA）
  // ========================================
  {
    code: 'MA-PPA-001',
    category: 'PURCHASE_PRICE_ALLOCATION',
    title: '識別資産・負債の特定',
    titleEn: 'Identification of Assets and Liabilities',
    description: '取得時の資産・負債の網羅的特定と公正価値評価',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['balance_sheet', 'contracts', 'intellectual_property', 'customer_lists'],
    validationRules: [
      { type: 'IDENTIFICATION', field: 'intangible_assets' },
      { type: 'VALUATION', field: 'fair_value' },
      { type: 'DISCLOSURE', field: 'ppa_methodology', required: true },
    ],
    aiCheckPrompt: `PPAに必要な識別資産・負備を特定してください。
1. 顧客関連資産（顧客リスト、顧客関係）
2. 技術関連資産（特許、ノウハウ、ソフトウェア）
3. 契約関連資産（有利な契約、ライセンス）
4. マーク・トレードネーム
5. 未認識負債（未払退職給付、環境負債等）`,
    relatedStandards: ['IFRS 3', 'ASC 805', 'ASBJ Statement No.21'],
    guidance: 'PPAは買収完了後1年以内に完了。詳細な公正価値評価が必要。',
  },
  {
    code: 'MA-PPA-002',
    category: 'GOODWILL',
    title: 'のれんの計算と減損リスク',
    titleEn: 'Goodwill Calculation and Impairment Risk',
    description: 'のれんの金額算定と将来の減損リスク評価',
    severity: 'HIGH',
    checkType: 'AUTOMATED',
    dataSource: ['purchase_price', 'net_assets', 'ppp_analysis'],
    validationRules: [
      { type: 'GOODWILL', field: 'goodwill_amount' },
      { type: 'RATIO', field: 'goodwill_to_purchase_price', threshold: 0.5 },
      { type: 'RECOVERABILITY', field: 'cash_generating_unit' },
    ],
    aiCheckPrompt: `のれんの計算と減損リスクを評価してください。
1. のれん = 取得原価 - 取得純資産の公正価値
2. のれんの構成要素（シナジー、成長、不可識別資産）
3. 買収価格に対するのれんの比率
4. 減損テストの基礎となるCGUの特定
5. 減損リスクのシナリオ分析`,
    relatedStandards: ['IFRS 3', 'IAS 36', 'ASBJ Statement No.21'],
    guidance: 'のれん比率が高い場合、将来の減損リスクに注意。',
  },

  // ========================================
  // 税務DD関連
  // ========================================
  {
    code: 'MA-TAX-001',
    category: 'TAX',
    title: '税務リスクと未納税額の評価',
    titleEn: 'Tax Risks and Unpaid Taxes Assessment',
    description: '過去の申告内容、税務調査履歴、未納税額の確認',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['tax_returns', 'tax_audit_history', 'tax_provisions'],
    validationRules: [
      { type: 'AUDIT_HISTORY', field: 'tax_audits', lookback: 5 },
      { type: 'EXPOSURE', field: 'tax_contingencies' },
      { type: 'COMPLETENESS', field: 'tax_filings' },
    ],
    aiCheckPrompt: `税務リスクを包括的に評価してください。
1. 過去5年間の税務調査履歴と指摘事項
2. 未申告・過少申告のリスク
3. 移転価格税制の対応状況
4. 税効果会計の適正性
5. 買収に伴う税務リスクの売主への転嫁可能性`,
    relatedStandards: ['Tax Law', 'IAS 12'],
    guidance: '税務リスクは表明・保証条項、エスクロー条項で保護を検討。',
  },

  // ========================================
  // 内部統制・不正リスク
  // ========================================
  {
    code: 'MA-IC-001',
    category: 'INTERNAL_CONTROLS',
    title: '内部統制の有効性評価',
    titleEn: 'Internal Controls Effectiveness Assessment',
    description: '財務報告に係る内部統制の有効性と不備の特定',
    severity: 'HIGH',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['internal_audit_reports', 'control_documentation', 'audit_findings'],
    validationRules: [
      { type: 'TESTING', field: 'key_controls' },
      { type: 'DOCUMENTATION', field: 'control_procedures' },
      { type: 'FREQUENCY', field: 'control_exceptions' },
    ],
    aiCheckPrompt: `内部統制の有効性を評価してください。
1. 財務報告プロセスの主要な統制
2. 不正防止・発見統制の有効性
3. IT統制の整備状況
4. 過去の内部統制不備と是正状況
5. 統合後の内部統制の強化必要性`,
    relatedStandards: ['J-SOX', 'COSO Framework'],
    guidance: '内部統制の不備は買収後のコスト増要因。',
  },
  {
    code: 'MA-IC-002',
    category: 'INTERNAL_CONTROLS',
    title: '不正リスクの評価',
    titleEn: 'Fraud Risk Assessment',
    description: '財務諸表の不正、資産の横領等のリスク評価',
    severity: 'CRITICAL',
    checkType: 'MANUAL',
    dataSource: ['whistleblower_reports', 'audit_findings', 'management_inquiry'],
    validationRules: [
      { type: 'INDICATOR_CHECK', field: 'fraud_indicators' },
      { type: 'DOCUMENTATION', field: 'fraud_risk_assessment' },
    ],
    aiCheckPrompt: `不正リスクを評価してください。
1. 不正の動機・機会・正当化の分析
2. 売上計上の不正リスク（飛ばし、仮装売上等）
3. 経費の不正リスク（経費の私的流用等）
4. 関連当事者との不適切な取引
5. 内部通報制度からの情報`,
    relatedStandards: ['SAS No.99', 'Fraud Risk Management'],
    guidance: '不正リスクはDDの最重要項目。経営者へのヒアリングが必須。',
  },

  // ========================================
  // 偶発事象・訴訟
  // ========================================
  {
    code: 'MA-CONT-001',
    category: 'CONTINGENCIES',
    title: '訴訟・法的紛争の評価',
    titleEn: 'Litigation and Legal Disputes Assessment',
    description: '進行中の訴訟、法的紛争、規制当局からの指摘',
    severity: 'CRITICAL',
    checkType: 'MANUAL',
    dataSource: ['legal_matters', 'court_filings', 'regulatory_correspondence'],
    validationRules: [
      { type: 'IDENTIFICATION', field: 'legal_proceedings' },
      { type: 'EXPOSURE', field: 'potential_liabilities' },
      { type: 'DISCLOSURE', field: 'contingent_liabilities' },
    ],
    aiCheckPrompt: `訴訟・法的紛争を評価してください。
1. 進行中の訴訟とその見込み
2. 労働争議・解雇紛争
3. 知的財産権侵害の主張
4. 規制当局からの是正命令・制裁
5. 環境規制違反のリスク`,
    relatedStandards: ['ASBJ Statement No.15', 'IAS 37'],
    guidance: '訴訟リスクは表明・保証、エスクローで保護。法務専門家の意見必須。',
  },

  // ========================================
  // 後発事象
  // ========================================
  {
    code: 'MA-SUB-001',
    category: 'SUBSEQUENT_EVENTS',
    title: '後発事象の評価',
    titleEn: 'Subsequent Events Assessment',
    description: '決算日後の重要な出来事が財務諸表に適切に反映されているか',
    severity: 'HIGH',
    checkType: 'MANUAL',
    dataSource: ['board_minutes', 'subsequent_journals', 'management_inquiry'],
    validationRules: [
      { type: 'CUTOFF', field: 'subsequent_events' },
      { type: 'DISCLOSURE', field: 'material_events' },
    ],
    aiCheckPrompt: `後発事象を評価してください。
1. 決算日後の重要な取引・契約
2. 固定資産の売却・取得
3. 資本の変動（増資、自己株式取得等）
4. 災害・事故による損失
5. 買収後の事業環境の変化`,
    relatedStandards: ['ASBJ Statement No.24', 'IAS 10'],
    guidance: '後発事象は買収価格交渉に影響。直近のヒアリングが重要。',
  },

  // ========================================
  // 関連当事者取引
  // ========================================
  {
    code: 'MA-RP-001',
    category: 'RELATED_PARTY',
    title: '関連当事者取引の完全性と価格妥当性',
    titleEn: 'Related Party Transaction Completeness and Pricing',
    description: '関連当事者との取引が完全に開示され、公正な価格で行われているか',
    severity: 'CRITICAL',
    checkType: 'SEMI_AUTOMATED',
    dataSource: ['related_party_transactions', 'shareholders', 'directors', 'pricing_data'],
    validationRules: [
      { type: 'COMPLETENESS', field: 'related_parties' },
      { type: 'COMPARABLE', field: 'transaction_pricing', tolerance: 0.15 },
      { type: 'DISCLOSURE', field: 'transaction_details', required: true },
    ],
    aiCheckPrompt: `関連当事者取引を分析してください。
1. 関連当事者の完全な特定
2. 取引の種類（売上、仕入、賃借、借入等）
3. 取引価格の市場価格との比較
4. 買収後の継続性と正規化の必要性
5. 未収金・未払金の実在性`,
    relatedStandards: ['ASBJ Statement No.11', 'IAS 24'],
    guidance: '関連当事者取引は正規化EBITDAの調整項目。価格乖離は要調整。',
  },
]
