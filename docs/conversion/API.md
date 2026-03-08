# Conversion API リファレンス

## 認証

全エンドポイントで認証が必要。`Authorization: Bearer <token>` ヘッダーを使用。

---

## プロジェクト

### GET /api/conversion/projects

プロジェクト一覧を取得。

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|-----|------|
| `page` | number | No | ページ番号 (default: 1) |
| `limit` | number | No | 1ページあたりの件数 (default: 20, max: 100) |
| `status` | string | No | ステータスでフィルタ |
| `targetStandard` | string | No | 対象基準でフィルタ (USGAAP/IFRS) |

**レスポンス:**
```json
{
  "data": [
    {
      "id": "proj-xxx",
      "name": "FY2024 USGAAP変換",
      "description": "Annual conversion project",
      "targetStandard": "USGAAP",
      "targetCoaId": "coa-xxx",
      "periodStart": "2024-01-01",
      "periodEnd": "2024-12-31",
      "status": "completed",
      "createdAt": "2024-01-15T00:00:00Z",
      "updatedAt": "2024-02-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### POST /api/conversion/projects

新規プロジェクト作成。（会計士権限必要）

**リクエストボディ:**
```json
{
  "name": "FY2024 USGAAP変換",
  "description": "Annual conversion project",
  "targetStandard": "USGAAP",
  "targetCoaId": "coa-xxx",
  "periodStart": "2024-01-01",
  "periodEnd": "2024-12-31",
  "settings": {
    "includeJournals": true,
    "includeFinancialStatements": true,
    "generateAdjustingEntries": true,
    "aiAssistedMapping": true,
    "currencyConversionRate": 150.0,
    "functionalCurrency": "JPY",
    "presentationCurrency": "USD"
  }
}
```

**レスポンス:** `201 Created`
```json
{
  "data": {
    "id": "proj-xxx",
    "name": "FY2024 USGAAP変換",
    ...
  }
}
```

### GET /api/conversion/projects/:id

プロジェクト詳細取得。

**レスポンス:**
```json
{
  "data": {
    "id": "proj-xxx",
    "name": "FY2024 USGAAP変換",
    "targetStandard": "USGAAP",
    "status": "completed",
    "progress": 100,
    ...
  }
}
```

### PUT /api/conversion/projects/:id

プロジェクト更新。

### DELETE /api/conversion/projects/:id

プロジェクト削除。（`draft`ステータスのみ可能）

### POST /api/conversion/projects/:id/execute

変換実行。（会計士権限必要）

**リクエストボディ:**
```json
{
  "dryRun": false,
  "skipValidation": false,
  "batchSize": 1000
}
```

**レスポンス:** `200 OK`
```json
{
  "data": {
    "id": "result-xxx",
    "projectId": "proj-xxx",
    "status": "completed",
    "journalConversions": [...],
    "balanceSheet": {...},
    "profitLoss": {...},
    "cashFlow": {...},
    "adjustingEntries": [...],
    "disclosures": [...],
    "conversionDate": "2024-02-01T00:00:00Z",
    "conversionDurationMs": 15000
  }
}
```

### POST /api/conversion/projects/:id/abort

変換中止。

### GET /api/conversion/projects/:id/progress

変換進捗取得。

**レスポンス:**
```json
{
  "data": {
    "status": "converting",
    "progress": 45,
    "currentItem": "journal-12345",
    "processedJournals": 4500,
    "totalJournals": 10000,
    "errors": [],
    "startedAt": "2024-02-01T10:00:00Z",
    "estimatedCompletion": "2024-02-01T10:05:00Z"
  }
}
```

### GET /api/conversion/projects/:id/results

変換結果取得。

---

## 勘定科目表（COA）

### GET /api/conversion/coa

COA一覧取得。

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|-----|------|
| `standard` | string | No | 会計基準でフィルタ (JGAAP/USGAAP/IFRS) |
| `page` | number | No | ページ番号 |
| `limit` | number | No | 件数 |

### POST /api/conversion/coa

COA作成。

**リクエストボディ:**
```json
{
  "name": "USGAAP Chart of Accounts",
  "standard": "USGAAP",
  "description": "Standard USGAAP COA",
  "items": [
    {
      "code": "1000",
      "name": "Cash and Cash Equivalents",
      "category": "ASSET",
      "subcategory": "CURRENT_ASSET",
      "description": "Cash, bank deposits, and short-term investments"
    }
  ]
}
```

### GET /api/conversion/coa/:id

COA詳細取得。

### PUT /api/conversion/coa/:id

COA更新。

### DELETE /api/conversion/coa/:id

COA削除。

### POST /api/conversion/coa/:id/import

COAインポート（CSV/Excel）。

**リクエスト:** `multipart/form-data`
- `file`: CSV または Excel ファイル

**CSVフォーマット:**
```csv
code,name,category,subcategory,description
1000,Cash and Cash Equivalents,ASSET,CURRENT_ASSET,Cash and bank deposits
```

### GET /api/conversion/coa/:id/export

COAエクスポート。

### GET /api/conversion/coa/:id/validate

COAバリデーション。

### POST /api/conversion/coa/:id/items

COA項目追加。

### GET /api/conversion/coa/templates

COAテンプレート一覧取得。

---

## マッピング

### GET /api/conversion/mappings

マッピング一覧取得。

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|-----|------|
| `sourceCoaId` | string | Yes | ソースCOA ID |
| `targetCoaId` | string | Yes | ターゲットCOA ID |
| `isApproved` | boolean | No | 承認済みのみ |
| `minConfidence` | number | No | 最小信頼度 (0-1) |
| `page` | number | No | ページ番号 |
| `limit` | number | No | 件数 |

**レスポンス:**
```json
{
  "data": [
    {
      "id": "map-xxx",
      "sourceAccountId": "acc-jp-1000",
      "sourceAccountCode": "1000",
      "sourceAccountName": "現金及び預金",
      "targetAccountId": "acc-us-1000",
      "targetAccountCode": "1000",
      "targetAccountName": "Cash and Cash Equivalents",
      "confidence": 0.95,
      "isApproved": true,
      "conversionRule": null,
      "approvedBy": "user-xxx",
      "approvedAt": "2024-01-20T00:00:00Z"
    }
  ],
  "pagination": {...}
}
```

### POST /api/conversion/mappings

マッピング作成。

**リクエストボディ:**
```json
{
  "sourceAccountId": "acc-jp-1000",
  "targetAccountId": "acc-us-1000",
  "confidence": 1.0,
  "conversionRule": null
}
```

### GET /api/conversion/mappings/:id

マッピング詳細取得。

### PUT /api/conversion/mappings/:id

マッピング更新。

### DELETE /api/conversion/mappings/:id

マッピング削除。

### POST /api/conversion/mappings/batch

一括マッピング作成/承認。

**リクエストボディ:**
```json
{
  "mappings": [
    {
      "sourceAccountId": "acc-jp-1000",
      "targetAccountId": "acc-us-1000",
      "isApproved": true
    }
  ]
}
```

### POST /api/conversion/mappings/suggest

AIによるマッピング提案。

**リクエストボディ:**
```json
{
  "sourceCoaId": "coa-jgaap",
  "targetCoaId": "coa-usgaap",
  "accountIds": ["acc-jp-1000", "acc-jp-1100"]
}
```

**レスポンス:**
```json
{
  "data": [
    {
      "sourceAccountId": "acc-jp-1000",
      "sourceAccountName": "現金及び預金",
      "suggestions": [
        {
          "targetAccountId": "acc-us-1000",
          "targetAccountName": "Cash and Cash Equivalents",
          "confidence": 0.95,
          "rationale": "Direct semantic match"
        }
      ]
    }
  ]
}
```

### GET /api/conversion/mappings/statistics

マッピング統計取得。

**レスポンス:**
```json
{
  "data": {
    "total": 100,
    "mapped": 85,
    "approved": 70,
    "unmapped": 15,
    "averageConfidence": 0.87,
    "byCategory": {
      "ASSET": { "total": 40, "mapped": 38 },
      "LIABILITY": { "total": 30, "mapped": 25 },
      "EQUITY": { "total": 10, "mapped": 10 },
      "REVENUE": { "total": 12, "mapped": 8 },
      "EXPENSE": { "total": 8, "mapped": 4 }
    }
  }
}
```

### GET /api/conversion/mappings/export

マッピングエクスポート。

---

## エクスポート

### GET /api/conversion/export/:projectId

変換結果エクスポート。

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|-----|------|
| `format` | string | Yes | 出力形式 (json/csv/excel/pdf) |
| `include` | string | No | 含める項目 (journals,statements,adjustments,disclosures) |

**レスポンス:** ファイルダウンロード

---

## 会計基準

### GET /api/conversion/standards

会計基準一覧取得。

### GET /api/conversion/standards/:code

会計基準詳細取得。

---

## エラーレスポンス

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fieldErrors": {
      "periodStart": ["must be before periodEnd"]
    }
  }
}
```

**エラーコード:**

| コード | HTTPステータス | 説明 |
|-------|---------------|------|
| `VALIDATION_ERROR` | 400 | バリデーションエラー |
| `COMPANY_REQUIRED` | 400 | 会社IDが必要 |
| `INVALID_JSON` | 400 | JSONパースエラー |
| `NOT_FOUND` | 404 | リソースが見つからない |
| `FETCH_ERROR` | 500 | 取得エラー |
| `CREATE_ERROR` | 500 | 作成エラー |
