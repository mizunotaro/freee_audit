# freee_audit データベース設計書

## 1. 概要

本ドキュメントは、freee_auditシステムのデータベース設計を定義します。

### 1.1 データベース選定

| 環境 | データベース | 理由 |
|------|-------------|------|
| PoC | SQLite | ローカル開発の簡易性 |
| 本番 | PostgreSQL | 拡張性、信頼性、クラウド対応 |

### 1.2 ORM

**Prisma ORM**を採用

- 型安全性
- マイグレーション管理
- 複数データベース対応（SQLite/PostgreSQL）

---

## 2. ER図

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ AuditLog : creates
    User }o--|| Company : belongs_to
    
    Company ||--o{ Journal : has
    Company ||--o{ Document : has
    Company ||--o{ Budget : has
    Company ||--o{ CashFlow : has
    Company ||--o{ FinancialKPI : has
    Company ||--o{ ApiKey : has
    
    Journal ||--o| Document : has
    Journal ||--o{ AuditResult : has
    
    Document ||--o{ AuditResult : has
    
    ExchangeRate ||--o{ FinancialKPI : used_in

    User {
        string id PK
        string email UK
        string password_hash
        string name
        string role
        string company_id FK
        datetime created_at
        datetime updated_at
    }

    Session {
        string id PK
        string user_id FK
        string token UK
        datetime expires_at
        datetime created_at
    }

    Company {
        string id PK
        string freee_company_id UK
        string name
        string fiscal_year_start
        datetime created_at
        datetime updated_at
    }

    ApiKey {
        string id PK
        string company_id FK
        string provider
        string encrypted_key
        string encrypted_secret
        datetime expires_at
        datetime created_at
        datetime updated_at
    }

    Journal {
        string id PK
        string company_id FK
        string freee_journal_id UK
        date entry_date
        string description
        string debit_account
        string credit_account
        decimal amount
        decimal tax_amount
        string document_id FK
        string audit_status
        datetime synced_at
        datetime created_at
    }

    Document {
        string id PK
        string company_id FK
        string freee_document_id UK
        string journal_id FK
        string file_path
        string file_type
        datetime upload_date
        datetime created_at
    }

    AuditResult {
        string id PK
        string journal_id FK
        string document_id FK
        string status
        json issues
        decimal confidence_score
        datetime analyzed_at
        datetime created_at
    }

    Budget {
        string id PK
        string company_id FK
        int fiscal_year
        int month
        string department_id
        string account_code
        string account_name
        decimal amount
        datetime created_at
        datetime updated_at
    }

    CashFlow {
        string id PK
        string company_id FK
        int fiscal_year
        int month
        string category
        string item_name
        decimal amount
        datetime created_at
    }

    ExchangeRate {
        string id PK
        date rate_date
        string from_currency
        string to_currency
        decimal rate
        string source
        datetime created_at
    }

    FinancialKPI {
        string id PK
        string company_id FK
        int fiscal_year
        int month
        string kpi_name
        decimal value
        string currency
        string exchange_rate_id FK
        datetime created_at
    }

    AuditLog {
        string id PK
        string user_id FK
        string action
        string resource
        string resource_id
        string ip_address
        string user_agent
        json details
        string result
        datetime created_at
    }
```

---

## 3. Prismaスキーマ

### 3.1 schema.prisma

```prisma
// Prisma Schema for freee_audit

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"  // PoC: sqlite, Production: postgresql
  url      = env("DATABASE_URL")
}

// ============================================
// User & Authentication
// ============================================

enum UserRole {
  ADMIN
  ACCOUNTANT
  VIEWER
  INVESTOR
}

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String?    @map("password_hash")
  name         String
  role         UserRole   @default(VIEWER)
  companyId    String?    @map("company_id")
  company      Company?   @relation(fields: [companyId], references: [id])
  sessions     Session[]
  auditLogs    AuditLog[]
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([token])
  @@map("sessions")
}

// ============================================
// Company & API Keys
// ============================================

model Company {
  id             String        @id @default(cuid())
  freeeCompanyId String?       @unique @map("freee_company_id")
  name           String
  fiscalYearStart Int          @default(1) @map("fiscal_year_start") // 1-12
  journals       Journal[]
  documents      Document[]
  budgets        Budget[]
  cashFlows      CashFlow[]
  kpis           FinancialKPI[]
  apiKeys        ApiKey[]
  users          User[]
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  @@map("companies")
}

enum ApiProvider {
  FREEE
  OPENAI
  GEMINI
  CLAUDE
  SLACK
  BOX
}

model ApiKey {
  id              String     @id @default(cuid())
  companyId       String     @map("company_id")
  company         Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  provider        ApiProvider
  encryptedKey    String     @map("encrypted_key")
  encryptedSecret String?    @map("encrypted_secret")
  metadata        Json?      // 追加情報（トークン有効期限等）
  expiresAt       DateTime?  @map("expires_at")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  @@unique([companyId, provider])
  @@map("api_keys")
}

// ============================================
// Journal & Document
// ============================================

enum AuditStatus {
  PENDING
  PASSED
  FAILED
  SKIPPED
}

model Journal {
  id             String       @id @default(cuid())
  companyId      String       @map("company_id")
  company        Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  freeeJournalId String       @unique @map("freee_journal_id")
  entryDate      Date         @map("entry_date")
  description    String
  debitAccount   String       @map("debit_account")
  creditAccount  String       @map("credit_account")
  amount         Decimal      @db.Decimal(15, 2)
  taxAmount      Decimal      @default(0) @map("tax_amount") @db.Decimal(15, 2)
  documentId     String?      @map("document_id")
  document       Document?    @relation(fields: [documentId], references: [id])
  auditStatus    AuditStatus  @default(PENDING) @map("audit_status")
  auditResults   AuditResult[]
  syncedAt       DateTime     @map("synced_at")
  createdAt      DateTime     @default(now()) @map("created_at")

  @@index([companyId, entryDate])
  @@index([companyId, auditStatus])
  @@map("journals")
}

model Document {
  id             String       @id @default(cuid())
  companyId      String       @map("company_id")
  company        Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  freeeDocumentId String?     @unique @map("freee_document_id")
  journalId      String?      @unique @map("journal_id")
  journal        Journal?     @relation(fields: [journalId], references: [id])
  filePath       String       @map("file_path")
  fileType       String       @map("file_type") // pdf, jpeg, png
  fileName       String       @map("file_name")
  fileSize       Int          @map("file_size")
  uploadDate     DateTime     @map("upload_date")
  auditResults   AuditResult[]
  createdAt      DateTime     @default(now()) @map("created_at")

  @@index([companyId])
  @@map("documents")
}

// ============================================
// Audit
// ============================================

enum AuditResultStatus {
  PASSED
  FAILED
  ERROR
}

model AuditResult {
  id             String           @id @default(cuid())
  journalId      String           @map("journal_id")
  journal        Journal          @relation(fields: [journalId], references: [id], onDelete: Cascade)
  documentId     String?          @map("document_id")
  document       Document?        @relation(fields: [documentId], references: [id])
  status         AuditResultStatus
  issues         Json             // ValidationIssue[]
  confidenceScore Decimal?        @map("confidence_score") @db.Decimal(3, 2)
  rawAiResponse  String?          @map("raw_ai_response")
  analyzedAt     DateTime         @map("analyzed_at")
  createdAt      DateTime         @default(now()) @map("created_at")

  @@index([journalId])
  @@index([status])
  @@map("audit_results")
}

// ============================================
// Budget
// ============================================

model Budget {
  id           String   @id @default(cuid())
  companyId    String   @map("company_id")
  company      Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  fiscalYear   Int      @map("fiscal_year")
  month        Int      // 1-12
  departmentId String?  @map("department_id")
  accountCode  String   @map("account_code")
  accountName  String   @map("account_name")
  amount       Decimal  @db.Decimal(15, 2)
  note         String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@unique([companyId, fiscalYear, month, departmentId, accountCode])
  @@index([companyId, fiscalYear])
  @@map("budgets")
}

// ============================================
// Cash Flow
// ============================================

enum CashFlowCategory {
  OPERATING
  INVESTING
  FINANCING
}

model CashFlow {
  id        String            @id @default(cuid())
  companyId String            @map("company_id")
  company   Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  fiscalYear Int              @map("fiscal_year")
  month     Int               // 1-12
  category  CashFlowCategory
  itemName  String            @map("item_name")
  amount    Decimal           @db.Decimal(15, 2)
  note      String?
  createdAt DateTime          @default(now()) @map("created_at")

  @@unique([companyId, fiscalYear, month, category, itemName])
  @@index([companyId, fiscalYear])
  @@map("cash_flows")
}

// ============================================
// Exchange Rate
// ============================================

model ExchangeRate {
  id           String   @id @default(cuid())
  rateDate     Date     @map("rate_date")
  fromCurrency String   @map("from_currency")
  toCurrency   String   @map("to_currency")
  rate         Decimal  @db.Decimal(10, 4)
  source       String   // BOJ, ECB, etc.
  kpis         FinancialKPI[]
  createdAt    DateTime @default(now()) @map("created_at")

  @@unique([rateDate, fromCurrency, toCurrency])
  @@index([rateDate])
  @@map("exchange_rates")
}

// ============================================
// Financial KPI
// ============================================

model FinancialKPI {
  id             String        @id @default(cuid())
  companyId      String        @map("company_id")
  company        Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  fiscalYear     Int           @map("fiscal_year")
  month          Int           // 1-12
  kpiName        String        @map("kpi_name")
  value          Decimal       @db.Decimal(15, 4)
  currency       String        @default("JPY")
  exchangeRateId String?       @map("exchange_rate_id")
  exchangeRate   ExchangeRate? @relation(fields: [exchangeRateId], references: [id])
  createdAt      DateTime      @default(now()) @map("created_at")

  @@unique([companyId, fiscalYear, month, kpiName, currency])
  @@index([companyId, fiscalYear])
  @@map("financial_kpis")
}

// ============================================
// Audit Log
// ============================================

enum AuditLogResult {
  SUCCESS
  FAILURE
}

model AuditLog {
  id         String          @id @default(cuid())
  userId     String?         @map("user_id")
  user       User?           @relation(fields: [userId], references: [id])
  action     String          // login, logout, create, update, delete, etc.
  resource   String          // journal, report, user, etc.
  resourceId String?         @map("resource_id")
  ipAddress  String?         @map("ip_address")
  userAgent  String?         @map("user_agent")
  details    Json?           // 追加情報
  result     AuditLogResult
  createdAt  DateTime        @default(now()) @map("created_at")

  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## 4. マイグレーション方針

### 4.1 開発フロー

```mermaid
graph LR
    A[スキーマ変更] --> B[prisma migrate dev]
    B --> C[マイグレーションファイル生成]
    C --> D[ローカルDB適用]
    D --> E[Gitコミット]
```

### 4.2 コマンド

```bash
# 開発環境：マイグレーション作成＆適用
npx prisma migrate dev --name description_of_change

# 本番環境：マイグレーション適用
npx prisma migrate deploy

# スキーマ確認
npx prisma validate

# クライアント生成
npx prisma generate

# シード実行
npx prisma db seed
```

### 4.3 本番マイグレーション手順

1. バックアップ取得
2. メンテナンスモード開始
3. `prisma migrate deploy` 実行
4. 動作確認
5. メンテナンスモード終了

### 4.4 ロールバック戦略

```sql
-- ロールバック用SQLファイルを手動作成
-- 例: migrations/20240101000000_rollback.sql
```

---

## 5. インデックス設計

### 5.1 インデックス一覧

| テーブル | カラム | 種別 | 用途 |
|---------|--------|------|------|
| users | email | UNIQUE | ログイン検索 |
| sessions | token | UNIQUE | セッション検証 |
| sessions | user_id | INDEX | ユーザー別セッション |
| journals | company_id, entry_date | INDEX | 期間検索 |
| journals | company_id, audit_status | INDEX | 監査ステータス検索 |
| budgets | company_id, fiscal_year | INDEX | 年度別予算 |
| cash_flows | company_id, fiscal_year | INDEX | 年度別CF |
| audit_logs | created_at | INDEX | ログ検索 |

### 5.2 クエリパフォーマンス目標

| クエリ種別 | 目標応答時間 |
|-----------|-------------|
| 主キー検索 | < 10ms |
| インデックス検索 | < 50ms |
| 集計クエリ | < 200ms |
| フルテキスト検索 | < 500ms |

---

## 6. データ整合性

### 6.1 制約

```prisma
// 外部キー制約
model Journal {
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
}

// 一意制約
@@unique([companyId, fiscalYear, month, departmentId, accountCode])

// 複合インデックス
@@index([companyId, entryDate])
```

### 6.2 カスケード削除

| 親テーブル | 子テーブル | 削除時動作 |
|-----------|-----------|-----------|
| Company | Journal | CASCADE |
| Company | Document | CASCADE |
| Company | Budget | CASCADE |
| Journal | AuditResult | CASCADE |
| User | Session | CASCADE |

---

## 7. バックアップ・リカバリ

### 7.1 PoC環境

```bash
# SQLite バックアップ
cp prisma/dev.db prisma/backup/dev_$(date +%Y%m%d).db
```

### 7.2 本番環境（PostgreSQL）

```yaml
# 日次フルバックアップ
- pg_dump -Fc database > backup_$(date +%Y%m%d).dump

# PITR (Point-in-Time Recovery)
- WAL アーカイブ有効化
- ベースバックアップ + WAL ファイル
```

### 7.3 リカバリ手順

```bash
# PostgreSQL リストア
pg_restore -d database backup_20240115.dump

# PITR リカバリ
pg_basebackup --recovery-target-time="2024-01-15 10:00:00"
```

---

## 8. セキュリティ

### 8.1 接続セキュリティ

```bash
# PoC (SQLite)
DATABASE_URL="file:./dev.db"

# 本番 (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/db?sslmode=require"
```

### 8.2 機密データ暗号化

| データ | 暗号化 |
|--------|--------|
| パスワード | bcrypt (ハッシュ) |
| APIキー | AES-256-GCM (暗号化) |
| セッショントークン | ランダム生成 (CUID) |

### 8.3 アクセス制御

```sql
-- 本番環境: ロールベースアクセス制御
CREATE ROLE app_readonly;
CREATE ROLE app_readwrite;
GRANT SELECT ON ALL TABLES TO app_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES TO app_readwrite;
```

---

## 9. シードデータ

### 9.1 初期データ

```typescript
// prisma/seed.ts

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // 会社作成
  const company = await prisma.company.create({
    data: {
      name: 'サンプル株式会社',
      fiscalYearStart: 4
    }
  })

  // 管理者ユーザー作成
  const passwordHash = await hash('admin123', 12)
  await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      name: 'システム管理者',
      role: 'ADMIN',
      companyId: company.id
    }
  })

  // 為替レートサンプル
  await prisma.exchangeRate.create({
    data: {
      rateDate: new Date('2024-01-31'),
      fromCurrency: 'USD',
      toCurrency: 'JPY',
      rate: 148.50,
      source: 'BOJ'
    }
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

## 10. パフォーマンスチューニング

### 10.1 クエリ最適化

```typescript
// N+1問題回避: includeを使用
const journalsWithAudit = await prisma.journal.findMany({
  include: {
    auditResults: true,
    document: true
  }
})

// バッチ処理: chunkSize指定
const journals = await prisma.journal.findMany({
  take: 100,
  skip: page * 100
})

// 集計: 生SQL使用
const summary = await prisma.$queryRaw`
  SELECT 
    DATE(entry_date) as date,
    COUNT(*) as count,
    SUM(amount) as total
  FROM journals
  WHERE company_id = ${companyId}
    AND entry_date BETWEEN ${startDate} AND ${endDate}
  GROUP BY DATE(entry_date)
`
```

### 10.2 接続プール

```typescript
// 本番環境: 接続プール設定
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['query', 'info', 'warn', 'error']
})
```
