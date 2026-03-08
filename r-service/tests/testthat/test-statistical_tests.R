library(testthat)

source("../../R/helpers.R")
source("../../R/statistical_tests.R")

test_that("test_normality returns correct structure", {
  set.seed(42)
  data <- rnorm(100)
  
  result <- test_normality(data)
  
  expect_true(result$success)
  expect_true("shapiro_wilk" %in% names(result$data))
  expect_true("jarque_bera" %in% names(result$data))
  expect_true("descriptive_stats" %in% names(result$data))
})

test_that("test_normality handles insufficient data", {
  data <- c(1, 2)
  
  result <- test_normality(data)
  
  expect_false(result$success)
  expect_equal(result$error$code, "INSUFFICIENT_DATA")
})

test_that("analyze_trend returns correct structure", {
  time_series <- 1:20 + rnorm(20, 0, 0.5)
  
  result <- analyze_trend(time_series)
  
  expect_true(result$success)
  expect_true("linear_regression" %in% names(result$data))
  expect_true("trend_direction" %in% names(result$data))
  expect_true("trend_significance" %in% names(result$data))
})

test_that("analyze_trend detects increasing trend", {
  time_series <- 1:20
  
  result <- analyze_trend(time_series)
  
  expect_true(result$success)
  expect_equal(result$data$trend_direction, "increasing")
})

test_that("compare_periods returns correct structure", {
  period1 <- c(10, 12, 14, 16, 18)
  period2 <- c(20, 22, 24, 26, 28)
  
  result <- compare_periods(period1, period2)
  
  expect_true(result$success)
  expect_true("period1_stats" %in% names(result$data))
  expect_true("period2_stats" %in% names(result$data))
  expect_true("t_test" %in% names(result$data))
  expect_true("effect_size" %in% names(result$data))
})

test_that("compare_periods calculates correct means", {
  period1 <- c(10, 20, 30)
  period2 <- c(40, 50, 60)
  
  result <- compare_periods(period1, period2)
  
  expect_true(result$success)
  expect_equal(result$data$period1_stats$mean, 20)
  expect_equal(result$data$period2_stats$mean, 50)
})

test_that("compare_periods handles insufficient data", {
  period1 <- c(10)
  period2 <- c(20)
  
  result <- compare_periods(period1, period2)
  
  expect_false(result$success)
  expect_equal(result$error$code, "INSUFFICIENT_DATA")
})

test_that("analyze_correlation returns correct structure", {
  data <- list(
    x = 1:20,
    y = 1:20 + rnorm(20, 0, 0.1)
  )
  
  result <- analyze_correlation(data)
  
  expect_true(result$success)
  expect_true("correlation_matrix" %in% names(result$data))
  expect_true("p_value_matrix" %in% names(result$data))
})

test_that("perform_regression returns correct structure", {
  y <- 1:20 + rnorm(20, 0, 0.5)
  x <- 1:20
  
  result <- perform_regression(y, x)
  
  expect_true(result$success)
  expect_true("coefficients" %in% names(result$data))
  expect_true("diagnostics" %in% names(result$data))
})
