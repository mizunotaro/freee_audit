# アーキテクチャ設計

## レイヤー構成

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer (Pages)                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │/conversion/     │ │/conversion/     │ │/conversion/         ││
│  │projects         │ │mappings         │ │coa                  ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                      Components (React)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ProjectList  │ │MappingTable │ │COAImporter  │ │Progress    │ │
│  │             │ │             │ │             │ │Indicator   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                        API Layer (Routes)                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │/api/conversion/ │ │/api/conversion/ │ │/api/conversion/     ││
│  │projects        │ │mappings         │ │coa                  ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Services (Business Logic)                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │ConversionEngine │ │JournalConverter │ │AccountMapping       ││
│  │                 │ │                 │ │Service              ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘│
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │FSConverter      │ │Adjustment       │ │AIConversion         ││
│  │                 │ │Calculator       │ │Advisor              ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                       Data Layer (Prisma)                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │ConversionProject│ │AccountMapping   │ │ConversionResult     ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘│
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │ChartOfAccount   │ │COAItem          │ │ConversionAuditLog   ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## データフロー

```
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│  Source  │───>│   Mapping    │───>│ Conversion  │───>│   Export     │
│  Data    │    │   Process    │    │   Engine    │    │   Service    │
│ (JGAAP)  │    │              │    │             │    │              │
└──────────┘    └──────────────┘    └─────────────┘    └──────────────┘
     │                 │                   │                   │
     v                 v                   v                   v
┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ Journal  │    │ AI Mapping   │    │ Journal     │    │ Excel/CSV    │
│ Entries  │    │ Suggestions  │    │ Converter   │    │ PDF/JSON     │
│          │    │              │    │             │    │              │
└──────────┘    └──────────────┘    └─────────────┘    └──────────────┘
     │                 │                   │
     v                 v                   v
┌──────────┐    ┌──────────────┐    ┌─────────────┐
│ Financial│    │ Manual       │    │ Financial   │
│ Statements│   │ Approval     │    │ Statement   │
│          │    │ Workflow     │    │ Converter   │
└──────────┘    └──────────────┘    └─────────────┘
```

## 主要サービス

### 1. ConversionEngine

変換全体の統括管理。

**責務:**
- 変換プロセスのオーケストレーション
- マッピングバリデーション
- 進捗管理
- エラーハンドリング
- タイムアウト制御

**主要メソッド:**
```typescript
class ConversionEngine {
  execute(projectId: string, options?: ExecutionOptions): Promise<ConversionResult>
  getProgress(projectId: string): Promise<ConversionProgress>
  abort(projectId: string): Promise<void>
  dryRun(projectId: string): Promise<DryRunResult>
}
```

### 2. JournalConverter

仕訳変換。

**責務:**
- 仕訳データの勘定科目マッピング
- 金額計算（為替換算含む）
- 補助元帳の変換

**主要メソッド:**
```typescript
class JournalConverter {
  convert(entry: JournalEntry, mapping: AccountMapping): ConvertedJournal
  convertBatch(entries: JournalEntry[], mappings: Map<string, AccountMapping>): ConvertedJournal[]
}
```

### 3. FinancialStatementConverter

財務諸表変換。

**責務:**
- 貸借対照表（BS）変換
- 損益計算書（PL）変換
- キャッシュフロー計算書（CF）変換

**主要メソッド:**
```typescript
class FinancialStatementConverter {
  convertBalanceSheet(bs: BalanceSheet, mappings: AccountMapping[]): ConvertedBalanceSheet
  convertProfitLoss(pl: ProfitLoss, mappings: AccountMapping[]): ConvertedProfitLoss
  convertCashFlow(cf: CashFlow, mappings: AccountMapping[]): ConvertedCashFlow
}
```

### 4. AccountMappingService

マッピング管理。

**責務:**
- マッピングCRUD操作
- マッピングバリデーション
- 信頼度計算

**主要メソッド:**
```typescript
class AccountMappingService {
  create(data: CreateMappingInput): Promise<AccountMapping>
  getBySourceAccount(sourceAccountId: string): Promise<AccountMapping[]>
  getStatistics(coaId: string): Promise<MappingStatistics>
  batchApprove(mappingIds: string[], approvedBy: string): Promise<void>
}
```

### 5. AIConversionAdvisor

AI推論によるマッピング提案。

**責務:**
- 勘定科目の意味解析
- マッピング候補の提示
- 信頼度スコア計算
- 変換根拠の生成

**主要メソッド:**
```typescript
class AIConversionAdvisor {
  suggestMappings(sourceAccounts: COAItem[], targetCoa: ChartOfAccount): Promise<MappingSuggestion[]>
  explainMapping(sourceAccount: COAItem, targetAccount: COAItem): Promise<string>
}
```

### 6. AdjustmentCalculator

調整仕訳計算。

**責務:**
- 基準差異の特定
- 調整金額の計算
- 調整仕訳の生成

### 7. AuditTrailService

監査証跡管理。

**責役:**
- 変換操作の記録
- 変更履歴の追跡
- 監査レポート生成

### 8. ConversionExportService

エクスポート機能。

**責務:**
- Excel出力
- CSV出力
- PDF出力
- JSON出力

## データモデル

### ER図

```
┌──────────────────┐     ┌──────────────────┐
│ ConversionProject│     │  ChartOfAccount  │
├──────────────────┤     ├──────────────────┤
│ id               │────>│ id               │
│ name             │     │ name             │
│ targetStandard   │     │ standard         │
│ targetCoaId      │     │ items[]          │
│ periodStart      │     └──────────────────┘
│ periodEnd        │              │
│ status           │              │
│ settings         │              v
└──────────────────┘     ┌──────────────────┐
         │               │     COAItem      │
         │               ├──────────────────┤
         │               │ id               │
         │               │ code             │
         │               │ name             │
         │               │ category         │
         │               │ subcategory      │
         │               └──────────────────┘
         │
         v
┌──────────────────┐     ┌──────────────────┐
│  AccountMapping  │     │ ConversionResult │
├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │
│ sourceAccountId  │     │ projectId        │
│ targetAccountId  │     │ journalConversions│
│ confidence       │     │ balanceSheet     │
│ isApproved       │     │ profitLoss       │
│ conversionRule   │     │ cashFlow         │
│ approvedBy       │     │ adjustingEntries │
│ approvedAt       │     │ disclosures      │
└──────────────────┘     └──────────────────┘
         │
         v
┌──────────────────┐
│ConversionAuditLog│
├──────────────────┤
│ id               │
│ projectId        │
│ action           │
│ entityType       │
│ entityId         │
│ oldValue         │
│ newValue         │
│ performedBy      │
│ performedAt      │
└──────────────────┘
```

## 設定・環境変数

```bash
# AI設定
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4
AI_TEMPERATURE=0.1

# 変換設定
CONVERSION_TIMEOUT_MS=1800000
CONVERSION_BATCH_SIZE=1000
CONVERSION_MAX_RETRIES=3
```

## エラーハンドリング

```typescript
try {
  const result = await conversionEngine.execute(projectId)
} catch (error) {
  if (error instanceof ValidationError) {
    // マッピング検証エラー
  } else if (error instanceof TimeoutError) {
    // タイムアウト
  } else if (error instanceof AbortError) {
    // ユーザーによる中止
  } else {
    // その他のエラー
  }
}
```

## パフォーマンス考慮事項

1. **バッチ処理**: 大量の仕訳をバッチで処理（デフォルト1000件）
2. **ストリーミング**: 進捗情報をリアルタイム更新
3. **タイムアウト**: 30分で自動タイムアウト
4. **並列処理**: 可能な範囲で並列実行

## セキュリティ

1. **認証**: 全APIで認証必須
2. **認可**: 会計士権限で操作制限
3. **データ分離**: 会社ごとのデータ分離
4. **監査ログ**: 全操作を記録
