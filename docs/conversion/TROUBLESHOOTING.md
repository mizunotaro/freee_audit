# トラブルシューティング

## よくある問題

---

### 1. マッピングエラー

**症状:** 変換実行時に「Unmapped account」エラー

**原因:** ソース勘定科目に対応するマッピングがない

**解決策:**
1. マッピング統計を確認
   ```bash
   GET /api/conversion/mappings/statistics?sourceCoaId=xxx&targetCoaId=xxx
   ```
2. 未マッピングの勘定科目を特定
   ```bash
   GET /api/conversion/mappings?isApproved=false&sourceCoaId=xxx
   ```
3. AI提案を取得
   ```bash
   POST /api/conversion/mappings/suggest
   ```
4. 手動でマッピングを追加
   ```bash
   POST /api/conversion/mappings
   ```

---

### 2. タイムアウトエラー

**症状:** 変換実行が途中で停止、「Timeout」エラー

**原因:** データ量が多く処理時間がタイムアウト（30分）を超過

**解決策:**
1. 期間を分割して複数回実行
   ```json
   {
     "periodStart": "2024-01-01",
     "periodEnd": "2024-06-30"
   }
   ```
2. バッチサイズを調整
   ```json
   {
     "batchSize": 500
   }
   ```
3. 不要なデータを除外
   ```json
   {
     "settings": {
       "includeJournals": true,
       "includeFinancialStatements": false
     }
   }
   ```

---

### 3. 低信頼度マッピング

**症状:** AI提案の信頼度が低い（0.5未満）

**原因:** 勘定科目の名称や分類が標準的でない

**解決策:**
1. 勘定科目名を確認・修正
2. 手動でマッピングを設定
3. マッピングルールを追加
   ```json
   {
     "conversionRule": {
       "type": "percentage",
       "percentage": 50,
       "targetAccountId": "acc-xxx"
     }
   }
   ```

---

### 4. COAインポートエラー

**症状:** CSV/Excelインポートが失敗

**原因:** ファイルフォーマットが不正

**解決策:**
1. CSVフォーマットを確認
   ```csv
   code,name,category,subcategory,description
   1000,Cash,ASSET,CURRENT_ASSET,Cash and bank deposits
   ```
2. 必須フィールドを確認
   - `code`: 勘定科目コード（必須）
   - `name`: 勘定科目名（必須）
   - `category`: カテゴリ（必須: ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE）
3. エンコーディングを確認（UTF-8推奨）

---

### 5. 変換結果の不一致

**症状:** 変換後の数値が期待値と異なる

**原因:**
- マッピングミス
- 為替レート設定の問題
- 調整仕訳の計算方法

**解決策:**
1. 監査ログを確認
   ```bash
   GET /api/conversion/projects/{projectId}/audit-logs
   ```
2. マッピングを再確認
3. 為替レートを確認
   ```json
   {
     "settings": {
       "currencyConversionRate": 150.0
     }
   }
   ```
4. 調整仕訳を確認

---

### 6. API認証エラー

**症状:** 「Unauthorized」エラー

**原因:** トークンが無効または期限切れ

**解決策:**
1. トークンを再取得
2. Authorizationヘッダーを確認
   ```
   Authorization: Bearer <token>
   ```
3. セッションが有効か確認

---

### 7. 権限エラー

**症状:** 「Forbidden」エラー

**原因:** 会計士権限が必要な操作を実行

**解決策:**
1. ユーザーの権限を確認
2. 会計士権限を持つユーザーで操作

---

### 8. プロジェクト削除エラー

**症状:** プロジェクトが削除できない

**原因:** `draft`ステータス以外のプロジェクトは削除不可

**解決策:**
1. ステータスを確認
2. 関連データを確認（変換結果など）
3. アーカイブとして扱う

---

### 9. エクスポートエラー

**症状:** エクスポートが失敗

**原因:**
- 変換が完了していない
- ファイルサイズが大きすぎる

**解決策:**
1. 変換ステータスを確認
   ```bash
   GET /api/conversion/projects/{projectId}
   ```
2. フォーマットを変更（PDF→Excel等）
3. データを分割してエクスポート

---

### 10. AI提案が返ってこない

**症状:** マッピング提案APIがタイムアウト

**原因:**
- AIサービスの不調
- 勘定科目数が多すぎる

**解決策:**
1. 少ない件数で試す
   ```json
   {
     "accountIds": ["acc-001", "acc-002"]
   }
   ```
2. AIサービスの状態を確認
3. 手動マッピングで対応

---

## デバッグ方法

### ログ確認

```bash
# アプリケーションログ
tail -f logs/app.log | grep conversion

# エラーログ
tail -f logs/error.log
```

### 進捗確認

```bash
GET /api/conversion/projects/{projectId}/progress
```

### Dry Run実行

本番実行前にDry Runで確認:

```bash
POST /api/conversion/projects/{projectId}/execute
{
  "dryRun": true
}
```

---

## サポート

問題が解決しない場合:

1. 監査ログを収集
2. エラーメッセージを記録
3. 再現手順を整理
4. サポートチームに連絡
