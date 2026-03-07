# セキュリティ実装ガイド

## 概要

本ドキュメントは、freee_auditシステムのセキュリティ実装に関する技術的な詳細を説明します。

## 認証・認可

### セッション管理
- **方式**: JWT (JSON Web Token)
- **保存場所**: HttpOnly, Secure, SameSite=Strict Cookie
- **有効期限**: 24時間
- **トークン検証**: 全APIリクエストで実施

### 環境変数（必須）

以下の環境変数は本番環境で必須です：

```bash
JWT_SECRET=<32文字以上のランダム文字列>
CSRF_SECRET=<32文字以上のランダム文字列>
ENCRYPTION_KEY=<64文字の16進数文字列>
```

#### 生成方法

```bash
# JWT_SECRET / CSRF_SECRET (32文字以上)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (64文字の16進数 = 32バイト)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ロールベースアクセス制御 (RBAC)

| ロール | 説明 | 権限 |
|--------|------|------|
| `SUPER_ADMIN` | システム管理者 | 全会社へのアクセス、全機能利用可能 |
| `ADMIN` | 会社管理者 | 自社の全機能利用可能 |
| `ACCOUNTANT` | 経理担当者 | 自社の監査・レポート機能利用可能 |
| `VIEWER` | 閲覧者 | 自社のレポート閲覧のみ |
| `INVESTOR` | 投資家 | 投資家ポータル閲覧のみ |

## API保護

### 認証が必要なエンドポイント

- `/api/*` (パブリックエンドポイントを除く全て)

### パブリックエンドポイント

以下のエンドポイントは認証なしでアクセス可能です：

| エンドポイント | 説明 |
|----------------|------|
| `/api/auth/login` | ログイン |
| `/api/auth/logout` | ログアウト |
| `/api/health` | ヘルスチェック |
| `/api/freee/callback` | freee OAuth コールバック |

### 認証ミドルウェアの使用方法

```typescript
import { withAuth, getAuthenticatedUser, requireRole } from '@/lib/api/auth-helpers'

// 方法1: withAuth ラッパーを使用
export const GET = withAuth(async (request) => {
  const user = request.user // 認証済みユーザー
  // ...
}, { requiredRoles: ['ADMIN', 'ACCOUNTANT'] })

// 方法2: 手動で認証をチェック
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    await requireRole(user, ['ADMIN'])
    // ...
  } catch (error) {
    return handleAuthError(error)
  }
}
```

### レート制限

| タイプ | 制限 | 適用範囲 |
|--------|------|----------|
| `api` | 100リクエスト/分 | API全般 |
| `auth` | 5リクエスト/15分 | 認証エンドポイント |
| `upload` | 20リクエスト/時間 | ファイルアップロード |
| `strict` | 10リクエスト/分 | 機密性の高いエンドポイント |

## 機密情報管理

### API キー

- **保存**: AES-256-GCMで暗号化してデータベースに保存
- **アクセス**: 管理者(`ADMIN`, `SUPER_ADMIN`)のみ設定可能
- **表示**: 設定有無のみ表示（値は非表示）

#### 実装例

```typescript
// API キーの保存（暗号化）
const encryptedKey = encrypt(apiKey)
await prisma.user.update({
  where: { id: userId },
  data: { openaiApiKey: encryptedKey }
})

// API キーの取得（復号化しない）
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { openaiApiKey: true }
})

// レスポンスでは設定有無のみ返す
return {
  hasOpenaiApiKey: !!user.openaiApiKey
  // openaiApiKey は返さない
}
```

### 暗号化

- **アルゴリズム**: AES-256-GCM
- **用途**: API キー、OAuth トークン
- **キー管理**: 環境変数 `ENCRYPTION_KEY`

## 監査ログ

### 記録対象

- ユーザーログイン/ログアウト
- 設定変更
- API キー更新
- 監査実行
- 投資家招待

### 保持期間

- 90日間

## セキュリティヘッダー

全レスポンスに以下のヘッダーを設定：

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; ...
```

## 定期セキュリティタスク

### 日次
- [ ] 依存パッケージ脆弱性チェック: `pnpm audit:check`
- [ ] エラーログの確認

### 週次
- [ ] 監査ログレビュー
- [ ] 失敗したログイン試行の確認
- [ ] アクティブセッションの確認

### 月次
- [ ] セキュリティパッチ適用
- [ ] アクセス権限レビュー
- [ ] API キーのローテーション確認

## インシデント対応

### セキュリティインシデント発見時の手順

1. **影響範囲の調査**
   - 影響を受けたユーザー/データの特定
   - 攻撃の種類と侵入経路の特定

2. **即時対応**
   - 全セッションの無効化（必要な場合）
   - 該当ユーザーへの通知
   - 影響を受けたAPI キーの無効化

3. **修正と再発防止**
   - 脆弱性の修正
   - 追加のセキュリティ対策の実施
   - ドキュメントの更新

4. **事後検証**
   - インシデントレポートの作成
   - プロセスの改善点の特定

### 連絡先

- セキュリティ担当: security@example.com
- 緊急連絡先: （設定してください）

## テスト

### セキュリティテストの実行

```bash
# 統合テスト
pnpm test tests/integration/security/

# E2Eセキュリティテスト
pnpm e2e tests/e2e/security.spec.ts

# セキュリティチェックリスト
node scripts/security-checklist.js

# パフォーマンステスト
pnpm test tests/performance/
```

## Cookie セキュリティ

### 設定要件

すべてのCookieは以下の設定を満たす必要があります：

| 設定 | 値 | 説明 |
|------|------|------|
| `httpOnly` | `true` | XSS攻撃防止 |
| `secure` | `true` | HTTPS通信の強制 |
| `sameSite` | `strict` | CSRF攻撃防止 |
| `maxAge` | 適切な値 | セッション有効期限 |

### 実装例

```typescript
response.cookies.set('session', token, {
  httpOnly: true,   // 必須
  secure: true,      // 必須（本番・開発環境問わず）
  sameSite: 'strict', // 必須
  maxAge: 60 * 60 * 24, // 24時間
  path: '/',
  domain: process.env.COOKIE_DOMAIN || undefined,
})
```

### 禁止事項

- ❌ `sameSite: 'lax'` の使用（CSRF脆弱性）
- ❌ `secure: false` の使用（中間者攻撃脆弱性）
- ❌ `httpOnly: false` の使用（XSS脆弱性）

### 現在のCookie設定
```bash
# セッション Cookie
/api/auth/login
/api/investor/accept

# OAuth State Cookie
/api/freee/auth

# CSRF トークン Cookie
/api/csrf-token
```

## エラーハンドリング

### セキュリティエラー

本番環境では、エラーメッセージに機密情報を含めないでください。

```typescript
// ❌ 悪い例
return NextResponse.json({
  error: `Database connection failed: ${dbHost}:${dbPort}`
}, { status: 500 })

// ✅ 良い例
console.error('Database error:', error)
return NextResponse.json({
  error: 'Internal server error'
  // 詳細はサーバーログのみ
}, { status: 500 })
```

### 本番環境でのエラーログ
- 詳細なスタックトレースは含まない
- ラーザー識別子を含まない
- データベースの詳細情報を含まない
- 内部IPアドレスを含まない

- API キーを含まない

## 本番環境チェックリスト

### デプロイ前確認

#### 環境変数
- [ ] すべての環境変数が設定されている
  - [ ] JWT_SECRET (32文字以上)
  - [ ] CSRF_SECRET (32文字以上)
  - [ ] ENCRYPTION_KEY (64文字の16進数)
  - [ ] DATABASE_URL
  - [ ] COOKIE_DOMAIN

#### Cookie設定
- [ ] Cookie設定が統一されている
  - [ ] すべてのCookieで `sameSite: 'strict'`
  - [ ] すべてのCookieで `secure: true`

#### テスト
- [ ] テストが全てパスしている
  - [ ] `pnpm test`
  - [ ] `pnpm test:coverage` (80%以上)
  - [ ] `pnpm typecheck`

#### セキュリティテスト
- [ ] セキュリティテストが実行されている
  - [ ] `pnpm test tests/integration/security/`

#### 依存パッケージ
- [ ] 依存パッケージの脆弱性チェック
  - [ ] `pnpm audit:check`

#### ビルド
- [ ] 本番ビルドが成功している
  - [ ] `pnpm build`

### デプロイ後確認
- [ ] セキュリティヘッダーが設定されている
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Content-Security-Policy` (適切に設定)

- [ ] HTTPSが有効
  - [ ] すべてのAPIエンドポイントがHTTPS経由
  - [ ] Cookieが `secure: true` で設定されている

- [ ] 認証フローが動作している
  - [ ] ログインが成功する
  - [ ] ログアウトが成功する
  - [ ] セッションが正しく期限切れする

### 定期確認事項
- [ ] 監査ログの確認（週次）
- [ ] 失敗したログイン試行の確認（日次）
- [ ] アクティブセッションの確認（週次）
- [ ] API キーのローテーション（月次）
- [ ] アクセス権限のレビュー（月次）

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|------------|----------|
| 2024-XX-XX | 1.0.0 | 初版作成 |
| 2026-03-07 | 1.1.0 | Cookie セキュリティ、エラーハンドリング、本番環境チェックリストを追加 |

---

**注意**: このドキュメントは機密情報を含みます。一般公開しないでください。
