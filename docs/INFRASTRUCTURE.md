# インフラストラクチャ設計・比較

> **対象**: 小規模スタートアップ（1人管理部）でのfreee_audit運用
> **原則**: サーバーレスファースト、最小コスト、最大堅牢性

---

## 推奨構成: Vercel + Supabase（第1推奨）

| 項目 | 評価 |
|------|------|
| 安定性 | ★★★★★ Vercel はNext.js公式、Edge Runtime完全対応 |
| 堅牢性 | ★★★★★ 自動フェイルオーバー、グローバルCDN |
| 再現性 | ★★★★★ GitPush=自動デプロイ、プレビュー環境 |
| 拡張性 | ★★★★☆ Serverless Functions自動スケール |
| メンテナンス性 | ★★★★★ ゼロインフラ管理 |
| セキュリティ | ★★★★☆ 自動HTTPS、DDoS保護、環境変数管理 |
| パフォーマンス | ★★★★★ Edge Network、ISR、ストリーミングSSR |
| コスト | ★★★★★ Hobby: 無料、Pro: $20/月 |

```
構成図:
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Vercel    │───▶│   Supabase   │    │  Python/R    │
│  (Next.js)  │    │ (PostgreSQL) │    │  (Railway)   │
│  Edge/Node  │    │   Auth追加可  │    │  or Render   │
└─────────────┘    └──────────────┘    └──────────────┘
       │                                      │
       ▼                                      ▼
┌──────────────┐                    ┌──────────────┐
│ Vercel Blob  │                    │  Box API     │
│ (ファイル)    │                    │  (バックアップ) │
└──────────────┘                    └──────────────┘
```

**月額コスト見積もり（スタートアップ）**:
- Vercel Pro: $20/月
- Supabase Free: $0（500MB DB、50K MAU）
- Railway (Python): $5/月（使用量課金）
- **合計: 約 $25/月（約3,800円）**

---

## 比較表: 全選択肢

| 構成 | 初期コスト | 月額 | 安定性 | 運用負荷 | 適性 |
|------|----------|------|--------|---------|------|
| **Vercel + Supabase** | $0 | $0-25 | ★★★★★ | ★★★★★ | **最推奨** |
| Cloudflare Pages + D1 | $0 | $0-5 | ★★★★☆ | ★★★★☆ | 良い代替案 |
| AWS Lambda + RDS | $0 | $20-50 | ★★★★★ | ★★★☆☆ | エンタープライズ向け |
| GCP Cloud Run + Cloud SQL | $0 | $15-40 | ★★★★★ | ★★★☆☆ | GCP好みなら |
| Azure Container Apps | $0 | $20-40 | ★★★★☆ | ★★★☆☆ | Azure好みなら |
| Railway | $0 | $5-20 | ★★★★☆ | ★★★★★ | Python/R含む場合最適 |
| Fly.io | $0 | $5-15 | ★★★★☆ | ★★★★☆ | コンテナ好みなら |
| **ローカル（PC常時起動）** | $0 | 電気代 | ★★☆☆☆ | ★★☆☆☆ | **非推奨** |
| Raspberry Pi | $10K | 電気代 | ★★☆☆☆ | ★☆☆☆☆ | **非推奨** |
| Synology NAS | $50K+ | 電気代 | ★★★☆☆ | ★★☆☆☆ | 条件付き |

---

## 各構成の詳細

### Cloudflare Pages + D1（第2推奨）

**メリット**:
- 無料枠が非常に大きい（100K リクエスト/日、10GB帯域）
- D1はSQLite互換のため、現在のdev DBと完全互換
- Workers AI統合（LLM推論もCloudflare上で可能）

**デメリット**:
- Next.js対応は @opennextjs/cloudflare 経由（公式ではない）
- Edge Runtime制約あり（一部Node.js APIが使えない）

**月額**: $0-5

### AWS構成（エンタープライズ向け）

```
Lambda (Next.js via SST/OpenNext) + RDS PostgreSQL + S3
```

**メリット**: IPO/M&A時のDD対応に有利、SOC2等のコンプライアンス
**デメリット**: 運用複雑、コスト高め
**月額**: $20-50+

### ローカル運用（非推奨の理由）

| リスク | 説明 |
|--------|------|
| 可用性 | PC電源OFF = サービス停止 |
| セキュリティ | ポート開放、動的IP、SSL設定の手間 |
| バックアップ | 自前管理必須 |
| ネットワーク | ISP障害 = サービス停止 |
| スケーラビリティ | CPU/RAM制限 |

**ただし「必要なときだけ使う」なら許容可能**:
- ローカルで `pnpm dev` → ブラウザでアクセス
- データはSQLiteファイルで持ち運び可能
- Box/Google Driveにバックアップ

---

## 推奨デプロイメント手順

### Phase 1: Vercel デプロイ

```bash
# 1. Vercel CLI インストール
npm i -g vercel

# 2. プロジェクト連携
vercel link

# 3. 環境変数設定（Vercel Dashboard で設定推奨）
vercel env add JWT_SECRET production
vercel env add ENCRYPTION_KEY production
vercel env add CSRF_SECRET production
vercel env add DATABASE_URL production

# 4. デプロイ
vercel --prod
```

### Phase 2: Supabase DB設定

```bash
# 1. Supabase プロジェクト作成（supabase.com）
# 2. DATABASE_URL をVercelに設定
# 3. Prisma マイグレーション
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Phase 3: Python/R サービス（Railway）

```bash
# python-service/ をRailwayにデプロイ
# r-service/ をRailwayにデプロイ
# 環境変数でVercelアプリと接続
```

---

## SQLite → PostgreSQL 移行準備

現在のPrismaスキーマは `provider = "sqlite"` ですが、PostgreSQL移行時:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**移行チェックリスト**:
- [ ] schema.prismaの provider を "postgresql" に変更
- [ ] `@default(cuid())` はPostgreSQL互換（変更不要）
- [ ] SQLite固有の制約がないことを確認（✅ 確認済み）
- [ ] マイグレーション生成: `npx prisma migrate dev --name init`
- [ ] シードデータ投入: `npx prisma db seed`
