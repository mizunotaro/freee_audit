library(testthat)

source("../../R/helpers.R")
source("../../R/financial_analysis.R")

test_that("calculate_financial_ratios returns correct structure", {
  bs <- list(
    total_assets = 1000000,
    total_equity = 600000,
    total_liabilities = 400000,
    assets = list(
      current = list(
        list(name = "cash", amount = 100000),
        list(name = "receivables", amount = 150000),
        list(name = "inventory", amount = 50000)
      )
    ),
    liabilities = list(
      current = list(
        list(name = "payables", amount = 80000)
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
  
  result <- calculate_financial_ratios(bs, pl)
  
  expect_true(result$success)
  expect_true("profitability" %in% names(result$data))
  expect_true("liquidity" %in% names(result$data))
  expect_true("leverage" %in% names(result$data))
  expect_true("efficiency" %in% names(result$data))
})

test_that("calculate_financial_ratios calculates ROE correctly", {
  bs <- list(
    total_assets = 1000000,
    total_equity = 500000,
    total_liabilities = 500000
  )
  
  pl <- list(
    revenue = list(list(amount = 1000000)),
    net_income = 100000,
    operating_income = 150000
  )
  
  result <- calculate_financial_ratios(bs, pl)
  
  expect_true(result$success)
  expect_equal(result$data$profitability$roe, 20)
})

test_that("calculate_altman_zscore returns correct structure", {
  bs <- list(
    total_assets = 1000000,
    total_equity = 600000,
    total_liabilities = 400000,
    working_capital = 200000,
    retained_earnings = 150000,
    market_capitalization = 800000
  )
  
  pl <- list(
    operating_income = 100000,
    revenue = list(list(amount = 2000000))
  )
  
  result <- calculate_altman_zscore(bs, pl)
  
  expect_true(result$success)
  expect_true("z_score" %in% names(result$data))
  expect_true("components" %in% names(result$data))
  expect_true("interpretation" %in% names(result$data))
})

test_that("calculate_altman_zscore handles insufficient data", {
  bs <- list(total_assets = 0)
  pl <- list()
  
  result <- calculate_altman_zscore(bs, pl)
  
  expect_false(result$success)
  expect_equal(result$error$code, "INSUFFICIENT_DATA")
})

test_that("calculate_sustainable_growth returns correct structure", {
  bs <- list(
    total_assets = 1000000,
    total_equity = 500000
  )
  
  pl <- list(
    revenue = list(list(amount = 1000000)),
    net_income = 100000,
    dividends = 20000
  )
  
  result <- calculate_sustainable_growth(bs, pl)
  
  expect_true(result$success)
  expect_true("sustainable_growth_rate" %in% names(result$data))
  expect_true("dupont_analysis" %in% names(result$data))
})
