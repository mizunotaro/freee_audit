# Cloudflare Pages + D1 + Zero Trust デプロイ設計書

> **対象**: freee_audit のCloudflareインフラ構成
> **前提**: Cloudflare One (SASE) 経由のアクセス、小規模スタートアップ運用

---

## 1. 構成概要

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Network                  │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐               │
│  │ Zero Trust   │──▶│ Cloudflare   │               │
│  │ Access       │   │ Pages        │               │
│  │ (認証+SASE)  │   │ (Next.js)    │               │
│  └──────────────┘   └──────┬───────┘               │
│         │                  │                        │
│  ┌──────┴───────┐   ┌─────┴────────┐              │
│  │ Device       │   │    D1        │              │
│  │ Posture      │   │  (SQLite)    │              │
│  │ Check        │   │  メインDB     │              │
│  └──────────────┘   └──────────────┘              │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐              │
│  │ R2           │   │ KV           │              │
│  │ (ファイル)    │   │ (セッション)  │              │
│  └──────────────┘   └──────────────┘              │
└─────────────────────────────────────────────────────┘
         │
    ┌────┴─────┐
    │ 外部API   │
    ├──────────┤
    │ freee API│
    │ LLM APIs │
    │ Google   │
    │ Calendar │
    └──────────┘
```

---

## 2. Cloudflare Zero Trust / Access 設定

### 2.1 アクセスポリシー設計

```yaml
# アプリケーション定義
Application:
  name: freee-audit
  domain: audit.your-domain.com
  type: self-hosted

# アクセスポリシー（レイヤー1: Cloudflare Access）
Policy:
  name: "freee-audit-access"
  decision: Allow
  include:
    - emails:
        - admin@epifrontier.com        # 管理者
        - accountant@epifrontier.com   # 経理
    - email_domains:
        - epifrontier.com              # 会社ドメイン全体
  require:
    - device_posture:
        checks:
          - disk_encryption: true       # ディスク暗号化必須
          - os_version:
              operator: ">="
              os: "windows"
              version: "10.0.19045"     # Windows 10 22H2以上
          - firewall: true              # ファイアウォール有効

# Cloudflare WARP クライアント設定
WARP:
  mode: gateway_with_doh              # SASE: 全トラフィック経由
  split_tunnel: exclude               # 社内IPのみ除外
  captive_portal: 5min
```

### 2.2 デバイスポスチャーチェック

Cloudflare One を経由するPC端末に対して:

| チェック項目 | 設定値 | 必須/推奨 |
|---|---|---|
| WARP クライアント | 最新版 | 必須 |
| ディスク暗号化 | BitLocker有効 | 必須 |
| OSバージョン | Windows 10 22H2+ | 必須 |
| ファイアウォール | 有効 | 必須 |
| マルウェア対策 | 有効 | 推奨 |
| 画面ロック | 5分 | 推奨 |

### 2.3 認証フロー

```
ユーザー → WARP Client → Cloudflare Edge → Access認証
                                              │
                                    ┌─────────┴────────┐
                                    │ IdP認証           │
                                    │ (Google/Azure AD) │
                                    └─────────┬────────┘
                                              │
                                    デバイスポスチャー検証
                                              │
                                    freee_audit アプリ
```

**重要**: Cloudflare Access が認証を行うため、アプリ側のJWT認証は**二重認証**として機能。
Access が通過した時点でユーザーは認証済みだが、アプリ内のRBAC（ADMIN/ACCOUNTANT/VIEWER）は
引き続きアプリ側で管理。

### 2.4 アプリ側での Access トークン検証

```typescript
// middleware.ts に追加
// Cloudflare Access の JWT トークンを検証
const CF_ACCESS_AUD = process.env.CF_ACCESS_AUD // Access Application Audience tag

async function verifyCfAccessToken(request: NextRequest): Promise<boolean> {
  const cfToken = request.headers.get('cf-access-jwt-assertion')
  if (!cfToken || !CF_ACCESS_AUD) return false

  try {
    // Cloudflare の公開鍵で検証
    const certsUrl = `https://${process.env.CF_ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`
    // JWKSを使った検証ロジック
    return true // 実際はjose等で検証
  } catch {
    return false
  }
}
```

---

## 3. 技術的制約と対応策

### 3.1 D1 の制約

| 制約 | 影響 | 対応策 |
|---|---|---|
| `prisma migrate` 不可 | マイグレーション管理 | `wrangler d1 migrations apply` + SQL手動管理 |
| インタラクティブトランザクション不可 | Prisma `$transaction` コールバック | バッチトランザクション or 個別クエリに分解 |
| ENUM型なし | Prismaの String型で代替 | ✅ 現在もString使用（影響なし） |
| 5GB/DB (Free) | データ量 | 十分（仕訳+補助金で年間数百MB程度） |
| 5M rows read/日 (Free) | 大量クエリ | 1人運用なら十分。キャッシュ（KV）併用 |

### 3.2 Workers Runtime の制約

| 制約 | 影響 | 対応策 |
|---|---|---|
| bcrypt不可 | パスワードハッシュ | `scrypt` (node:crypto) に移行 |
| CPU 10ms (Free) / 30s (Paid) | AI分析、PDF生成 | 外部サービスに委譲（LLM API直接、R2経由） |
| メモリ128MB | 大規模データ処理 | ストリーミング処理、分割バッチ |
| ファイルシステムなし | バックアップ、Excel出力 | R2 (Object Storage) 使用 |

### 3.3 bcrypt → scrypt 移行

```typescript
// 現在: bcrypt
import * as bcrypt from 'bcryptjs'
const hash = await bcrypt.hash(password, 12)

// 移行後: scrypt (node:crypto)
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer
  return timingSafeEqual(Buffer.from(key, 'hex'), derivedKey)
}
```

### 3.4 Prisma $transaction の代替

```typescript
// 現在: インタラクティブトランザクション
const result = await prisma.$transaction(async (tx) => {
  const a = await tx.model1.create(...)
  const b = await tx.model2.create(...)
  return { a, b }
})

// D1対応: バッチトランザクション
const result = await prisma.$transaction([
  prisma.model1.create(...),
  prisma.model2.create(...),
])
```

---

## 4. wrangler.toml 設定

```toml
name = "freee-audit"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NEXT_PUBLIC_APP_NAME = "freee_audit"
FREEE_MOCK_MODE = "false"
AI_MOCK_MODE = "false"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "freee-audit-db"
database_id = "<your-database-id>"

# R2 Storage (ファイル保存、バックアップ)
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "freee-audit-files"

# KV Namespace (セッションキャッシュ)
[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "<your-kv-namespace-id>"

# Secrets (wrangler secret put で設定)
# JWT_SECRET
# ENCRYPTION_KEY
# CSRF_SECRET
# FREEE_CLIENT_ID
# FREEE_CLIENT_SECRET
```

---

## 5. コスト試算

### Free プラン（Cloudflare Pages + Workers Free）

| サービス | 無料枠 | 月額 |
|---|---|---|
| Pages | 無制限帯域、500ビルド/月 | $0 |
| D1 | 5GB、5M reads/日 | $0 |
| R2 | 10GB、10M reads/月 | $0 |
| KV | 100K reads/日 | $0 |
| Zero Trust | 50ユーザーまで | $0 |
| WARP | 50デバイスまで | $0 |
| **合計** | | **$0/月** |

### Workers Paid プラン（スケール時）

| サービス | 内容 | 月額 |
|---|---|---|
| Workers Paid | 10M requests、30s CPU | $5 |
| D1 Paid | 10GB/DB | 含む |
| R2 | 超過分のみ課金 | ~$0 |
| **合計** | | **$5/月** |

---

## 6. デプロイ手順

```bash
# 1. Cloudflare アカウント設定
npx wrangler login

# 2. D1 データベース作成
npx wrangler d1 create freee-audit-db

# 3. R2 バケット作成
npx wrangler r2 bucket create freee-audit-files

# 4. KV 名前空間作成
npx wrangler kv namespace create SESSION_CACHE

# 5. シークレット設定
npx wrangler secret put JWT_SECRET
npx wrangler secret put ENCRYPTION_KEY
npx wrangler secret put CSRF_SECRET

# 6. D1 マイグレーション（SQLファイルから）
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migrations/0001_init.sql
npx wrangler d1 migrations apply freee-audit-db

# 7. OpenNext ビルド + デプロイ
npx @opennextjs/cloudflare build
npx wrangler pages deploy .open-next/

# 8. Zero Trust Access 設定（Cloudflare Dashboard）
# - Application 作成
# - Policy 設定（email domain + device posture）
# - WARP クライアント配布
```

---

## 7. 推奨/非推奨の判断

### Cloudflare構成が適している場合 ✅
- コスト最優先（$0-5/月）
- 1人〜数人のアクセス
- Cloudflare One (SASE) を既に導入or導入予定
- AI処理は外部API（OpenAI/Claude API）に委譲

### Vercel構成が適している場合
- Next.js公式サポートが必要
- 複雑なPrismaトランザクションが頻繁
- ビルド/デプロイの安定性を最優先
- 月額$20-25を許容可能

### 結論
Cloudflare One導入前提であれば、**Cloudflare構成が最適**です。
Zero Trust Access が認証・アクセス制御を完全にカバーし、
アプリ側の認証負荷が大幅に軽減されます。
D1のトランザクション制約は、バッチトランザクションへの書き換えで対応可能です。

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-04-15 | 初版作成 |
