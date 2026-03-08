library(testthat)

source("../../R/helpers.R")
source("../../R/time_series.R")

test_that("forecast_arima returns correct structure", {
  set.seed(42)
  data <- cumsum(rnorm(36, 0.5, 1))
  
  result <- forecast_arima(data, horizon = 6)
  
  expect_true(result$success)
  expect_true("model" %in% names(result$data))
  expect_true("forecast" %in% names(result$data))
  expect_true("accuracy" %in% names(result$data))
  expect_equal(length(result$data$forecast$point), 6)
})

test_that("forecast_arima handles insufficient data", {
  data <- 1:10
  
  result <- forecast_arima(data, horizon = 6, frequency = 12)
  
  expect_false(result$success)
  expect_equal(result$error$code, "INSUFFICIENT_DATA")
})

test_that("decompose_seasonal returns correct structure", {
  set.seed(42)
  trend <- seq(0, 10, length.out = 36)
  seasonal <- rep(sin(2 * pi * (1:12) / 12), 3) * 2
  data <- trend + seasonal + rnorm(36, 0, 0.1)
  
  result <- decompose_seasonal(data, frequency = 12)
  
  expect_true(result$success)
  expect_true("components" %in% names(result$data))
  expect_true("trend" %in% names(result$data$components) || 
              "trend" %in% names(result$data$components) == FALSE)
  expect_equal(length(result$data$original), 36)
})

test_that("test_unit_root returns correct structure", {
  set.seed(42)
  data <- cumsum(rnorm(100))
  
  result <- test_unit_root(data)
  
  expect_true(result$success)
  expect_true("augmented_dickey_fuller" %in% names(result$data))
  expect_true("phillips_perron" %in% names(result$data))
  expect_true("kpss" %in% names(result$data))
})

test_that("calculate_moving_averages returns correct structure", {
  data <- 1:20
  
  result <- calculate_moving_averages(data, windows = c(3, 5))
  
  expect_true(result$success)
  expect_true("simple_moving_averages" %in% names(result$data))
  expect_true("ma_3" %in% names(result$data$simple_moving_averages))
  expect_true("ma_5" %in% names(result$data$simple_moving_averages))
})

test_that("calculate_moving_averages calculates correctly", {
  data <- 1:5
  
  result <- calculate_moving_averages(data, windows = c(3))
  
  expect_true(result$success)
  ma3 <- result$data$simple_moving_averages$ma_3
  expect_equal(ma3[3], 2)
  expect_equal(ma3[4], 3)
  expect_equal(ma3[5], 4)
})
