# R Statistical Analysis Service

R言語を活用した財務データの統計分析サービスです。

## 概要

このサービスは、R言語の豊富な統計パッケージを使用して、財務データの高度な統計分析を提供します。Plumberを使用してREST APIを構築しています。

## アーキテクチャ

```
┌──────────────────┐     HTTP REST      ┌─────────────────────┐
│   Next.js API    │ ─────────────────→ │  R Plumber API      │
│   (TypeScript)   │ ←───────────────── │  (統計分析特化)     │
└──────────────────┘                    └─────────────────────┘
```

## 機能

### 財務分析
- 財務比率計算（ROE, ROA, 流動性比率など）
- Altman Z-Score（倒産予測スコア）
- 持続可能成長率計算
- コモンサイズ分析

### 統計検定
- 正規性検定（Shapiro-Wilk, Jarque-Bera, Anderson-Darling）
- トレンド分析（線形回帰、Mann-Kendall検定）
- 期間比較（t検定、Wilcoxon検定、効果量）
- 相関分析
- 回帰分析（診断付き）

### 時系列分析
- ARIMA予測
- ETS（指数平滑化）予測
- 季節分解（STL）
- 変化点検出
- 単位根検定（ADF, PP, KPSS）
- 移動平均計算

### 国際会計基準対応
- 通貨換算
- IFRS ⇔ JGAAP変換
- インフレ調整
- セグメント分析

## セットアップ（Windows 11）

### 方法1: 自動セットアップ（推奨）

PowerShellを管理者として実行し、以下のコマンドを実行：

```powershell
cd r-service
.\setup.ps1
```

このスクリプトは以下を自動的に行います：
- Rのインストール（Chocolateyを使用）
- 必要なパッケージのインストール
- インストールの検証

### 方法2: 手動セットアップ

#### Step 1: Rのインストール

1. CRANからRをダウンロード
   - URL: https://cran.r-project.org/bin/windows/base/
   - 推奨バージョン: R 4.3.2以上

2. インストーラーを実行
   - デフォルト設定でOK
   - パスにRを追加するオプションを選択

3. Rtoolsをインストール
   - URL: https://cran.r-project.org/bin/windows/Rtools/
   - R 4.3.x用のRtools 4.3を選択

#### Step 2: パッケージのインストール

```powershell
cd r-service
.\setup.bat
```

またはRコンソールで：

```r
install.packages(c(
  "plumber", "jsonlite", "dplyr", "tidyr", "purrr",
  "ggplot2", "plotly", "httr", "logger", "forecast",
  "tseries", "zoo", "xts", "PerformanceAnalytics",
  "MASS", "car", "lmtest", "nortest", "Kendall",
  "changepoint", "testthat"
), repos = "https://cloud.r-project.org/")
```

### 方法3: Dockerを使用する場合

```bash
# イメージをビルド
docker build -t r-statistical-service .

# コンテナを起動
docker run -p 8001:8001 r-statistical-service
```

### サービスの起動

#### Windows (BAT)

```powershell
cd r-service
.\start_service.bat
```

#### Windows (PowerShell)

```powershell
cd r-service
Rscript -e "pr <- plumber::plumb('plumber.R'); pr`$run(host='0.0.0.0', port=8001)"
```

#### Linux/Mac

```bash
cd r-service
R -e "pr <- plumber::plumb('plumber.R'); pr\$run(host='0.0.0.0', port=8001)"
```

### 動作確認

サービス起動後、別のターミナルで：

```powershell
# PowerShell
.\test_api.ps1

# または
.\run_tests.bat
```

API URL: http://localhost:8001
Swagger UI: http://localhost:8001/__swagger__/

## API エンドポイント

### ヘルスチェック

```
GET /health
```

### サービス情報

```
GET /api/v1/info
```

### 財務比率計算

```
POST /api/v1/ratios
Content-Type: application/json

{
  "bs": {
    "total_assets": 1000000,
    "total_equity": 600000,
    "total_liabilities": 400000,
    "assets": {
      "current": [
        {"name": "現金", "amount": 100000},
        {"name": "売掛金", "amount": 150000},
        {"name": "棚卸資産", "amount": 50000}
      ]
    },
    "liabilities": {
      "current": [
        {"name": "買掛金", "amount": 80000}
      ]
    },
    "cash_balance": 100000
  },
  "pl": {
    "revenue": [{"amount": 500000}],
    "net_income": 50000,
    "operating_income": 80000,
    "depreciation": 20000,
    "cost_of_sales_total": 300000
  },
  "industry_code": "MFG"
}
```

### Altman Z-Score

```
POST /api/v1/zscore
Content-Type: application/json

{
  "bs": {
    "total_assets": 1000000,
    "total_equity": 600000,
    "total_liabilities": 400000,
    "working_capital": 220000,
    "retained_earnings": 200000,
    "market_capitalization": 800000
  },
  "pl": {
    "operating_income": 80000,
    "revenue": [{"amount": 500000}]
  }
}
```

### 正規性検定

```
POST /api/v1/tests/normality
Content-Type: application/json

{
  "data": [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9]
}
```

### ARIMA予測

```
POST /api/v1/forecast/arima
Content-Type: application/json

{
  "data": [100, 110, 120, 115, 125, 130, 140, 135, 145, 150, 160, 155],
  "horizon": 6,
  "frequency": 12
}
```

### 期間比較

```
POST /api/v1/analysis/compare
Content-Type: application/json

{
  "period1": [100, 110, 120, 115, 125],
  "period2": [130, 140, 135, 145, 150]
}
```

### 季節分解

```
POST /api/v1/analysis/decompose
Content-Type: application/json

{
  "data": [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210,
           120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230],
  "frequency": 12
}
```

### 通貨換算

```
POST /api/v1/international/currency
Content-Type: application/json

{
  "amount": 1000000,
  "from": "JPY",
  "to": "USD"
}
```

## レスポンス形式

すべてのエンドポイントは統一された形式で応答します：

### 成功時

```json
{
  "success": true,
  "data": {
    // 結果データ
  }
}
```

### エラー時

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ"
  }
}
```

## テスト

```bash
# testthatを使用してテストを実行
R -e "testthat::test_dir('tests/testthat')"
```

## ディレクトリ構成

```
r-service/
├── R/
│   ├── packages.R              # パッケージ読み込み
│   ├── helpers.R               # ユーティリティ関数
│   ├── financial_analysis.R    # 財務分析関数
│   ├── statistical_tests.R     # 統計検定関数
│   ├── time_series.R           # 時系列分析
│   └── international.R         # 国際会計基準対応
├── tests/
│   └── testthat/
│       ├── test-financial_analysis.R
│       ├── test-statistical_tests.R
│       └── test-time_series.R
├── plumber.R                   # API エントリーポイント
├── Dockerfile
├── .Rbuildignore
└── README.md
```

## 品質基準

- R CMD check: エラー0件
- testthat::test_dir(): 全テストPASS
- コードカバレッジ: 80%以上

## 依存パッケージ

### Core
- plumber - REST API フレームワーク
- jsonlite - JSON処理

### Data Manipulation
- dplyr, tidyr, purrr - データ操作

### Statistics
- stats, MASS, car - 統計関数

### Time Series
- forecast, tseries, zoo, xts - 時系列分析

### Financial
- PerformanceAnalytics, lmtest - 財務分析

### Additional
- nortest - 正規性検定
- Kendall - Mann-Kendall検定
- changepoint - 変化点検出

## ライセンス

MIT License

## 参照

- [Plumber Documentation](https://www.rplumber.io/)
- [R Forecast Package](https://pkg.robjhyndman.com/forecast/)
- [PerformanceAnalytics](https://cran.r-project.org/package=PerformanceAnalytics)
