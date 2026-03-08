# Test R Statistical Analysis Service API Endpoints
# Run this script after starting the service

$baseUrl = "http://localhost:8001"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing R Statistical Analysis Service" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "  Status: $($response.status)" -ForegroundColor Green
    Write-Host "  Service: $($response.service)" -ForegroundColor Green
    Write-Host "  Version: $($response.version)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Make sure the service is running: .\start_service.bat" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 2: Service Info
Write-Host "Test 2: Service Info" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/info" -Method Get
    Write-Host "  Name: $($response.name)" -ForegroundColor Green
    Write-Host "  Endpoints available: $($response.endpoints.Count)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Financial Ratios
Write-Host "Test 3: Financial Ratios Calculation" -ForegroundColor Yellow
$body = @{
    bs = @{
        total_assets = 1000000
        total_equity = 600000
        total_liabilities = 400000
        assets = @{
            current = @(
                @{ name = "Cash"; amount = 100000 },
                @{ name = "Accounts Receivable"; amount = 150000 },
                @{ name = "Inventory"; amount = 50000 }
            )
        }
        liabilities = @{
            current = @(
                @{ name = "Accounts Payable"; amount = 80000 }
            )
        }
        cash_balance = 100000
    }
    pl = @{
        revenue = @(@{ amount = 500000 })
        net_income = 50000
        operating_income = 80000
        depreciation = 20000
        cost_of_sales_total = 300000
    }
    industry_code = "MFG"
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/ratios" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  ROE: $($response.data.profitability.roe)%" -ForegroundColor Green
    Write-Host "  ROA: $($response.data.profitability.roa)%" -ForegroundColor Green
    Write-Host "  Current Ratio: $($response.data.liquidity.current_ratio)%" -ForegroundColor Green
    Write-Host "  Debt to Equity: $($response.data.leverage.debt_to_equity)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Altman Z-Score
Write-Host "Test 4: Altman Z-Score" -ForegroundColor Yellow
$body = @{
    bs = @{
        total_assets = 1000000
        total_equity = 600000
        total_liabilities = 400000
        working_capital = 220000
        retained_earnings = 200000
        market_capitalization = 800000
    }
    pl = @{
        operating_income = 100000
        revenue = @(@{ amount = 1500000 })
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/zscore" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  Z-Score: $($response.data.z_score)" -ForegroundColor Green
    Write-Host "  Interpretation: $($response.data.interpretation)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Normality Test
Write-Host "Test 5: Normality Test" -ForegroundColor Yellow
$body = @{
    data = 1..100 | ForEach-Object { Get-Random -Minimum 40 -Maximum 60 }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/tests/normality" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  Shapiro-Wilk p-value: $($response.data.shapiro_wilk.p_value)" -ForegroundColor Green
    Write-Host "  Interpretation: $($response.data.shapiro_wilk.interpretation)" -ForegroundColor Green
    Write-Host "  Skewness: $($response.data.descriptive_stats.skewness)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 6: Trend Analysis
Write-Host "Test 6: Trend Analysis" -ForegroundColor Yellow
$body = @{
    time_series = 1..24 | ForEach-Object { $_ + (Get-Random -Minimum -5 -Maximum 5) }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/analysis/trend" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  Slope: $($response.data.linear_regression.slope)" -ForegroundColor Green
    Write-Host "  R-squared: $($response.data.linear_regression.r_squared)" -ForegroundColor Green
    Write-Host "  Trend: $($response.data.trend_direction)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 7: Period Comparison
Write-Host "Test 7: Period Comparison" -ForegroundColor Yellow
$body = @{
    period1 = @(100, 105, 110, 108, 112, 115)
    period2 = @(120, 125, 122, 128, 130, 135)
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/analysis/compare" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  Period 1 Mean: $($response.data.period1_stats.mean)" -ForegroundColor Green
    Write-Host "  Period 2 Mean: $($response.data.period2_stats.mean)" -ForegroundColor Green
    Write-Host "  Difference: $($response.data.difference.percentage)%" -ForegroundColor Green
    Write-Host "  T-test p-value: $($response.data.t_test.p_value)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 8: Currency Conversion
Write-Host "Test 8: Currency Conversion" -ForegroundColor Yellow
$body = @{
    amount = 1000000
    from = "JPY"
    to = "USD"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/international/currency" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  Original: $($response.data.original_amount) $($response.data.original_currency)" -ForegroundColor Green
    Write-Host "  Converted: $($response.data.converted_amount) $($response.data.converted_currency)" -ForegroundColor Green
    Write-Host "  Rate: $($response.data.exchange_rate)" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "All tests completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Swagger UI available at: $baseUrl/__swagger__/" -ForegroundColor Yellow
