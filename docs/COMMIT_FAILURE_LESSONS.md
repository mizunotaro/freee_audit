# コミット失敗原因究明レポートと教訓

## 概要

2026年3月8日、340ファイル（83,297行追加、1,106行削除）のコミット時にlint-stagedによるpre-commitフックが失敗した。本ドキュメントは失敗原因を詳細に分析し、再発防止のための教訓を体系化したものである。

---

## 1. インシデント詳細

### 1.1 環境構成

| 項目 | 値 |
|------|-----|
| Node.js | >=20.0.0 |
| pnpm | >=8.0.0 |
| ESLint | 9.39.4 (Flat Config) |
| lint-staged | 16.2.7 |
| husky | 9.1.7 |
| prettier | 3.8.1 |

### 1.2 Pre-commitフック構成

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

### 1.3 ESLint設定（flat config）

```javascript
// eslint.config.mjs
export default [
  js.configs.recommended,  // ← これが重要
  {
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // ... その他
    }
  }
]
```

---

## 2. 失敗原因分析

### 2.1 直接的原因（ESLintエラー）

#### 原因A: `no-case-declarations` 違反

**発生箇所**: `src/services/conversion/journal-converter.ts`

**問題コード**:
```typescript
switch (mapping.mappingType) {
  case '1toN':
    const splitLines = this.createSplitLines(...)  // ← エラー
    // ...
    break

  case 'complex':
    const complexResult = await this.createComplexLines(...)  // ← エラー
    // ...
    break
}
```

**エラーメッセージ**:
```
Unexpected lexical declaration in case block  no-case-declarations
```

**原因**: ESLintの`js.configs.recommended`に含まれる`no-case-declarations`ルールは、switch文のcaseブロック内で直接`let`/`const`/`class`/`function`を宣言することを禁止している。これはケース間での変数の意図しない共有や、ホイスティングによる混乱を防ぐため。

**正しい実装**:
```typescript
switch (mapping.mappingType) {
  case '1toN': {
    const splitLines = this.createSplitLines(...)
    // ...
    break
  }

  case 'complex': {
    const complexResult = await this.createComplexLines(...)
    // ...
    break
  }
}
```

#### 原因B: `@typescript-eslint/no-unsafe-function-type` 違反

**発生箇所**: `tests/integration/api/conversion/projects.test.ts`

**問題コード**:
```typescript
vi.mock('@/lib/api', () => ({
  withAuth: (handler: Function) => handler,        // ← エラー
  withAccountantAuth: (handler: Function) => handler,  // ← エラー
}))
```

**エラーメッセージ**:
```
The `Function` type accepts any function-like value.
Prefer explicitly defining any function parameters and return type  @typescript-eslint/no-unsafe-function-type
```

**原因**: TypeScript 5.x以降、`Function`型は型安全性が低いため推奨されない。`@typescript-eslint/recommended`ルールセットに含まれる。

**正しい実装**:
```typescript
vi.mock('@/lib/api', () => ({
  withAuth: (handler: (req: unknown) => unknown) => handler,
  withAccountantAuth: (handler: (req: unknown) => unknown) => handler,
}))
```

#### 原因C: `no-empty` 違反

**発生箇所**: `tests/unit/lib/integrations/ai/fallback-provider.test.ts`

**問題コード**:
```typescript
try {
  await fallback.analyzeDocument({ ... })
} catch {}  // ← エラー: 空のcatchブロック
```

**エラーメッセージ**:
```
Empty block statement  no-empty
```

**原因**: 空のcatchブロックはエラーを隠蔽するため、バグの原因となる。ESLint推奨ルールで禁止されている。

**正しい実装**:
```typescript
try {
  await fallback.analyzeDocument({ ... })
} catch {
  // Expected error - circuit breaker should open
}
```
または、より明示的に:
```typescript
try {
  await fallback.analyzeDocument({ ... })
} catch (error) {
  // Intentionally ignored: testing circuit breaker behavior
  void error
}
```

### 2.2 組織的原因

#### 原因D: 大量ファイルの一括コミット

- **変更ファイル数**: 340ファイル
- **lint-stagedの挙動**: ファイルを6チャンクに分割して並列処理
- **結果**: 
  - ESLint処理が大量の警告を出力（214件：6エラー、208警告）
  - PrettierがSIGKILLで強制終了（メモリ/リソース不足の可能性）

#### 原因E: CI/CD前の品質チェック不足

- ローカルでの`pnpm lint`実行なしにコミットを試行
- 大量の新規コードに対して段階的な品質確認を実施していない

### 2.3 修正時の問題

#### 原因F: AIアシスタントによる不適切な編集

修正プロセス中に以下の問題が発生：

1. **部分的なファイル読み込み**: ファイル全体ではなく一部のみを読み込み、文脈を誤解
2. **編集の重複適用**: 同じ編集が複数回適用され、コード構造が破壊
3. **コンテキスト不足**: `oldString`の一致箇所が複数ある場合の適切な特定ができず

**破壊されたコード例**:
```typescript
// 編集前（正常）
for (let i = 0; i < 3; i++) {
  try {
    await fallback.analyzeDocument({ ... })
  } catch {}
}

// 編集後（破壊）
for (let i = 0; i < 3; i++) {
  try {
    await fallback.analyzeDocument({ ... })
  } catch {
    // Expected error
  }
}

    const result = await fallback.analyzeDocument({  // ← インデント崩壊
      documentBase64: 'test',
      documentType: 'pdf',
          mimeType: 'application/pdf',  // ← さらに崩壊
        })
      } catch {  // ← 孤立したcatch
        // Expected error
      }
    }
```

---

## 3. 根本原因の5-Why分析

| レベル | 質問 | 回答 |
|--------|------|------|
| 1 | なぜコミットが失敗したか？ | ESLintエラーが6件発生したため |
| 2 | なぜESLintエラーが発生したか？ | コードがESLint推奨ルールに違反していたため |
| 3 | なぜルール違反のコードが作成されたか？ | 作成時にESLintを実行しなかったため |
| 4 | なぜESLintを実行しなかったか？ | 大量のコード生成を一括で行い、段階的に検証しなかったため |
| 5 | なぜ段階的な検証をしなかったか？ | **品質保証プロセスが確立されていなかったため** |

---

## 4. 教訓とベストプラクティス

### 4.1 コーディング規約（絶対遵守事項）

#### [RULE-001] Switch文のcaseブロック
```typescript
// ❌ 禁止
switch (value) {
  case 'a':
    const x = 1
    break
}

// ✅ 必須: ブロックで囲む
switch (value) {
  case 'a': {
    const x = 1
    break
  }
}
```

#### [RULE-002] Function型の使用禁止
```typescript
// ❌ 禁止
const handler: Function = (x) => x

// ✅ 明示的な型定義
const handler: (x: unknown) => unknown = (x) => x
// または
type Handler<T, R> = (input: T) => R
const handler: Handler<unknown, unknown> = (x) => x
```

#### [RULE-003] 空のcatchブロック禁止
```typescript
// ❌ 禁止
try { ... } catch {}

// ✅ コメントで意図を明示
try { ... } catch {
  // Intentionally ignored: [理由]
}

// ✅ より明示的
try { ... } catch (error) {
  void error  // Intentionally ignored
}
```

#### [RULE-004] any型の使用制限
```typescript
// ❌ 警告対象
const data: any = fetchData()

// ✅ unknownを使用して型ガード
const data: unknown = fetchData()
if (typeof data === 'object' && data !== null) {
  // 型安全なアクセス
}
```

### 4.2 コミット前チェックリスト

**必須実行コマンド**（コミット前）:
```bash
# 1. Lintチェック
pnpm lint

# 2. 型チェック
pnpm typecheck

# 3. テスト実行（変更に関連するもの）
pnpm test

# 4. フォーマット確認
pnpm format:check
```

**大量変更時の追加手順**:
```bash
# 5. 変更ファイル数が50を超える場合
# 5-1. 機能単位で分割コミット
git add src/services/conversion/
git commit -m "feat: add conversion services"

git add src/lib/conversion/
git commit -m "feat: add conversion utilities"

# 5-2. 各コミット後にlint確認
pnpm lint
```

### 4.3 大量ファイル変更時のガイドライン

#### [GUIDE-001] 変更の分割戦略

| 変更規模 | 推奨アクション |
|----------|----------------|
| 1-10ファイル | 通常のコミット |
| 11-50ファイル | `pnpm lint`実行後にコミット |
| 51-100ファイル | 機能単位で分割コミット |
| 101ファイル以上 | 必ず分割コミット + 各セグメントでlint確認 |

#### [GUIDE-002] lint-stagedの設定最適化

大量ファイル変更が予想される場合、一時的に設定を緩和せず、分割コミットを行う：

```json
// 推奨: そのまま維持
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

### 4.4 AIアシスタント使用時の注意事項

#### [AI-001] 編集前の必須確認

AIアシスタントに編集を依頼する場合：

1. **全文読み込みを要求**: 部分読み込みではなく、ファイル全体の読み込みを要求する
2. **編集箇所の明示**: 具体的な行番号や関数名を指定する
3. **段階的な編集**: 大きな変更は複数の小さな編集に分割する

#### [AI-002] 編集後の必須確認

```bash
# 編集直後に構文チェック
pnpm lint <file-path>

# TypeScriptの型チェック
pnpm typecheck
```

---

## 5. ESLint推奨ルール 重要度分類

### 5.1 エラー（Error）- コミット不可

| ルール | 説明 | 対応 |
|--------|------|------|
| `no-case-declarations` | case内での宣言禁止 | ブロック`{}`で囲む |
| `no-empty` | 空ブロック禁止 | コメントまたは処理を追加 |
| `no-undef` | 未定義変数使用禁止 | 変数を定義 |
| `no-dupe-keys` | 重複キー禁止 | 重複を削除 |
| `no-unreachable` | 到達不能コード禁止 | コードを削除 |

### 5.2 警告（Warn）- 要対応

| ルール | 説明 | 推奨対応 |
|--------|------|----------|
| `@typescript-eslint/no-explicit-any` | any型使用 | unknownまたは具体型へ |
| `@typescript-eslint/no-unused-vars` | 未使用変数 | 削除または`_`prefix |
| `no-console` | console使用 | loggerまたは警告の許可リスト |

---

## 6. トラブルシューティングフローチャート

```
コミット失敗
    │
    ├─ ESLintエラーがある？
    │   YES → エラー箇所を特定
    │         │
    │         ├─ no-case-declarations → case内を{}で囲む
    │         ├─ no-empty → catchにコメント追加
    │         ├─ no-unsafe-function-type → 明示的な型定義
    │         └─ その他 → エラーメッセージに従う
    │
    ├─ Prettier SIGKILL？
    │   YES → ファイル数が多すぎる
    │         → 分割コミットを実施
    │
    └─ 修正後に再度失敗？
        YES → 編集でコード破壊の可能性
              → git diff で変更を確認
              → git checkout で元に戻して再修正
```

---

## 7. 他リポジトリへの適用チェックリスト

新規/既存リポジトリで本教訓を適用する場合：

### 7.1 必須設定

- [ ] ESLint 9.x flat configの導入
- [ ] `js.configs.recommended`の適用
- [ ] `@typescript-eslint/recommended`の適用
- [ ] lint-stagedの設定
- [ ] husky pre-commitフックの設定
- [ ] CI/CDでのlint/typecheck実行

### 7.2 推奨設定

- [ ] package.jsonへの必須スクリプト追加
  ```json
  {
    "scripts": {
      "lint": "eslint .",
      "lint:fix": "eslint . --fix",
      "typecheck": "tsc --noEmit",
      "format:check": "prettier --check ."
    }
  }
  ```
- [ ] CONTRIBUTING.mdへの規約記載
- [ ] PRテンプレートへのチェックリスト追加

### 7.3 既存リポジトリの移行

```bash
# 1. 現在のESLint設定を確認
cat .eslintrc.* 2>/dev/null || cat eslint.config.* 2>/dev/null

# 2. 全ファイルのlint実行
pnpm lint

# 3. エラー/警告の数を確認し、優先度付けして修正

# 4. lint-stagedが通ることを確認
git add .
pnpm lint-staged  # dry-run的な確認
```

---

## 8. 参考資料

- [ESLint no-case-declarations](https://eslint.org/docs/latest/rules/no-case-declarations)
- [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
- [Husky Documentation](https://typicode.github.io/husky/)

---

## 改訂履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2026-03-08 | 1.0.0 | 初版作成 |

---

**本ドキュメントは、同様のトラブルを防ぐための組織的資産である。全開発者は本内容を理解し、遵守すること。**
