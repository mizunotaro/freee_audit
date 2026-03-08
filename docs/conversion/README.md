# 会計基準変換機能

## 概要

JGAAP（日本基準）から USGAAP/IFRS への会計データ変換機能。

## 機能一覧

| 機能 | 説明 |
|------|------|
| 勘定科目表（COA）管理 | ソース/ターゲット勘定科目表のインポート・管理 |
| 自動マッピング（AI推論） | AIによる勘定科目の自動マッピング提案 |
| 仕訳変換 | ソース基準からターゲット基準への仕訳変換 |
| 財務諸表変換 | BS/PL/CFの変換 |
| 調整仕訳生成 | 基準差異に伴う調整仕訳の自動生成 |
| 監査証跡 | 変換プロセスの完全な記録 |

## クイックスタート

### 1. プロジェクト作成

```bash
curl -X POST /api/conversion/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FY2024 USGAAP変換",
    "targetStandard": "USGAAP",
    "targetCoaId": "coa-xxx",
    "periodStart": "2024-01-01",
    "periodEnd": "2024-12-31"
  }'
```

### 2. COAインポート

```bash
curl -X POST /api/conversion/coa/{coaId}/import \
  -F "file=@chart_of_accounts.csv"
```

### 3. マッピング設定

```bash
# AIによる自動提案
curl -X POST /api/conversion/mappings/suggest \
  -d '{"sourceCoaId": "coa-jgaap", "targetCoaId": "coa-usgaap"}'

# マッピング承認
curl -X POST /api/conversion/mappings/batch \
  -d '{"mappings": [...]}'
```

### 4. 変換実行

```bash
curl -X POST /api/conversion/projects/{projectId}/execute
```

### 5. 結果エクスポート

```bash
curl -X GET /api/conversion/export/{projectId}?format=excel
```

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer (Pages)                        │
│  /conversion/projects  /conversion/mappings  /conversion/coa │
├─────────────────────────────────────────────────────────────┤
│                    Components (React)                        │
│  ProjectList  MappingTable  COAImporter  ProgressIndicator   │
├─────────────────────────────────────────────────────────────┤
│                     API Layer (Routes)                       │
│  /api/conversion/projects  /api/conversion/mappings  ...     │
├─────────────────────────────────────────────────────────────┤
│                   Services (Business Logic)                  │
│  ConversionEngine  JournalConverter  AccountMappingService   │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer (Prisma)                     │
│  ConversionProject  AccountMapping  ConversionResult  ...    │
└─────────────────────────────────────────────────────────────┘
```

## 主要エンドポイント

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/conversion/projects` | GET/POST | プロジェクト一覧/作成 |
| `/api/conversion/projects/:id` | GET/PUT/DELETE | プロジェクト操作 |
| `/api/conversion/projects/:id/execute` | POST | 変換実行 |
| `/api/conversion/coa` | GET/POST | COA一覧/作成 |
| `/api/conversion/mappings` | GET/POST | マッピング一覧/作成 |
| `/api/conversion/mappings/suggest` | POST | AIマッピング提案 |
| `/api/conversion/export/:projectId` | GET | 結果エクスポート |

## 変換ステータス

| ステータス | 説明 |
|-----------|------|
| `draft` | 下書き |
| `mapping` | マッピング設定中 |
| `validating` | 検証中 |
| `converting` | 変換実行中 |
| `reviewing` | レビュー中 |
| `completed` | 完了 |
| `error` | エラー |

## 関連ドキュメント

- [API リファレンス](./API.md)
- [アーキテクチャ設計](./ARCHITECTURE.md)
- [トラブルシューティング](./TROUBLESHOOTING.md)
