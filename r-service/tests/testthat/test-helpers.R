# R Statistical Analysis Service

# Test the helper functions
library(testthat)

source("../../R/helpers.R")

test_that("null coalescing operator works", {
  expect_equal(NULL %||% "default", "default")
  expect_equal(NA %||% "default", "default")
  expect_equal("value" %||% "default", "value")
  expect_equal(5 %||% 10, 5)
})

test_that("safe_divide handles edge cases", {
  expect_equal(safe_divide(10, 2), 5)
  expect_true(is.na(safe_divide(10, 0)))
  expect_true(is.na(safe_divide(10, NA)))
  expect_equal(safe_divide(10, 0, 999), 999)
})

test_that("calculate_percentage works correctly", {
  expect_equal(calculate_percentage(25, 100), 25)
  expect_true(is.na(calculate_percentage(25, 0)))
  expect_true(is.na(calculate_percentage(25, NA)))
})

test_that("interpret_cohens_d returns correct interpretation", {
  expect_equal(interpret_cohens_d(0.1), "negligible")
  expect_equal(interpret_cohens_d(0.3), "small")
  expect_equal(interpret_cohens_d(0.6), "medium")
  expect_equal(interpret_cohens_d(1.0), "large")
})

test_that("create_success_response has correct structure", {
  response <- create_success_response(list(value = 42))
  expect_true(response$success)
  expect_equal(response$data$value, 42)
})

test_that("create_error_response has correct structure", {
  response <- create_error_response("test error", "TEST_ERROR")
  expect_false(response$success)
  expect_equal(response$error$code, "TEST_ERROR")
  expect_equal(response$error$message, "test error")
})
