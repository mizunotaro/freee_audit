#!/usr/bin/env Rscript
# Quick test script to verify the R service functionality
# This script tests the core functions without starting the HTTP server

cat("=== R Service Quick Test ===\n\n")

# Source all files
source("R/packages.R")
source("R/helpers.R")
source("R/statistical_tests.R")
source("R/financial_analysis.R")
source("R/time_series.R")
source("R/international.R")

cat("All source files loaded successfully.\n\n")

# Test 1: Financial Ratios
cat("Test 1: Financial Ratios Calculation\n")
cat("------------------------------------\n")

bs <- list(
  total_assets = 1000000,
  total_equity = 600000,
  total_liabilities = 400000,
  assets = list(
    current = list(
      list(name = "Cash", amount = 100000),
      list(name = "Accounts Receivable", amount = 150000),
      list(name = "Inventory", amount = 50000)
    )
  ),
  liabilities = list(
    current = list(
      list(name = "Accounts Payable", amount = 80000)
    )
  ),
  cash_balance = 100000
)

pl <- list(
  revenue = list(list(amount = 500000)),
  net_income = 50000,
  operating_income = 80000,
  depreciation = 20000,
  cost_of_sales_total = 300000
)

result <- calculate_financial_ratios(bs, pl, "MFG")
cat("ROE:", result$data$profitability$roe, "%\n")
cat("ROA:", result$data$profitability$roa, "%\n")
cat("Current Ratio:", result$data$liquidity$current_ratio, "%\n")
cat("Debt to Equity:", result$data$leverage$debt_to_equity, "\n")
cat("\n")

# Test 2: Altman Z-Score
cat("Test 2: Altman Z-Score\n")
cat("----------------------\n")

bs_zscore <- list(
  total_assets = 1000000,
  total_equity = 600000,
  total_liabilities = 400000,
  working_capital = 220000,
  retained_earnings = 200000,
  market_capitalization = 800000
)

pl_zscore <- list(
  operating_income = 100000,
  revenue = list(list(amount = 1500000))
)

result <- calculate_altman_zscore(bs_zscore, pl_zscore)
cat("Z-Score:", result$data$z_score, "\n")
cat("Interpretation:", result$data$interpretation, "\n")
cat("Components:\n")
cat("  X1 (Working Capital/TA):", result$data$components$x1_working_capital, "\n")
cat("  X2 (Retained Earnings/TA):", result$data$components$x2_retained_earnings, "\n")
cat("  X3 (EBIT/TA):", result$data$components$x3_ebit, "\n")
cat("  X4 (Market Equity/TL):", result$data$components$x4_market_equity, "\n")
cat("  X5 (Sales/TA):", result$data$components$x5_sales, "\n")
cat("\n")

# Test 3: Normality Test
cat("Test 3: Normality Test\n")
cat("----------------------\n")

set.seed(42)
normal_data <- rnorm(100, mean = 50, sd = 10)
result <- test_normality(normal_data)

cat("Shapiro-Wilk p-value:", result$data$shapiro_wilk$p_value, "\n")
cat("Interpretation:", result$data$shapiro_wilk$interpretation, "\n")
cat("Skewness:", result$data$descriptive_stats$skewness, "\n")
cat("Kurtosis:", result$data$descriptive_stats$kurtosis, "\n")
cat("\n")

# Test 4: Trend Analysis
cat("Test 4: Trend Analysis\n")
cat("----------------------\n")

time_series <- 1:24 + rnorm(24, 0, 0.5)
result <- analyze_trend(time_series)

cat("Slope:", result$data$linear_regression$slope, "\n")
cat("R-squared:", result$data$linear_regression$r_squared, "\n")
cat("P-value:", result$data$linear_regression$p_value, "\n")
cat("Trend Direction:", result$data$trend_direction, "\n")
cat("Significance:", result$data$trend_significance, "\n")
cat("\n")

# Test 5: Period Comparison
cat("Test 5: Period Comparison\n")
cat("-------------------------\n")

period1 <- c(100, 105, 110, 108, 112, 115)
period2 <- c(120, 125, 122, 128, 130, 135)
result <- compare_periods(period1, period2)

cat("Period 1 Mean:", result$data$period1_stats$mean, "\n")
cat("Period 2 Mean:", result$data$period2_stats$mean, "\n")
cat("Absolute Difference:", result$data$difference$absolute, "\n")
cat("Percentage Change:", result$data$difference$percentage, "%\n")
cat("T-test p-value:", result$data$t_test$p_value, "\n")
cat("Effect Size (Cohen's d):", result$data$effect_size$cohens_d, "\n")
cat("Effect Interpretation:", result$data$effect_size$interpretation, "\n")
cat("\n")

# Test 6: ARIMA Forecast
cat("Test 6: ARIMA Forecast\n")
cat("----------------------\n")

set.seed(42)
forecast_data <- cumsum(rnorm(36, 0.5, 1))
result <- forecast_arima(forecast_data, horizon = 6)

cat("Model AIC:", result$data$model$aic, "\n")
cat("Forecast (6 periods):", paste(round(result$data$forecast$point, 2), collapse = ", "), "\n")
cat("RMSE:", result$data$accuracy$rmse, "\n")
cat("MAPE:", result$data$accuracy$mape, "%\n")
cat("\n")

# Test 7: Currency Conversion
cat("Test 7: Currency Conversion\n")
cat("---------------------------\n")

result <- convert_currency(1000000, "JPY", "USD")
cat("Original:", result$data$original_amount, result$data$original_currency, "\n")
cat("Converted:", result$data$converted_amount, result$data$converted_currency, "\n")
cat("Exchange Rate:", result$data$exchange_rate, "\n")
cat("\n")

# Test 8: Seasonal Decomposition
cat("Test 8: Seasonal Decomposition\n")
cat("------------------------------\n")

set.seed(42)
trend <- seq(0, 10, length.out = 36)
seasonal <- rep(sin(2 * pi * (1:12) / 12), 3) * 2
decomp_data <- trend + seasonal + rnorm(36, 0, 0.1)

result <- decompose_seasonal(decomp_data, frequency = 12)
cat("Seasonal Strength:", result$data$strength$seasonal, "\n")
cat("Trend Strength:", result$data$strength$trend, "\n")
cat("Seasonal Amplitude:", result$data$statistics$seasonal_amplitude, "\n")
cat("\n")

cat("===========================================\n")
cat("All tests completed successfully!\n")
cat("===========================================\n")
