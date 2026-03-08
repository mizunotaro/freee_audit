#!/usr/bin/env Rscript
# R Statistical Analysis Service - Setup and Validation Script
# Run this script to install dependencies and verify the installation

cat("=== R Statistical Analysis Service Setup ===\n\n")

# Check R version
cat("1. Checking R version...\n")
cat(paste("   R version:", R.version.string, "\n"))
if (as.numeric(R.version$major) < 4 || 
    (as.numeric(R.version$major) == 4 && as.numeric(R.version$minor) < 3)) {
  warning("R version 4.3.0 or higher is recommended")
}

# Required packages
required_packages <- c(
  "plumber", "jsonlite", "dplyr", "tidyr", "purrr",
  "ggplot2", "plotly", "httr", "logger", "forecast",
  "tseries", "zoo", "xts", "PerformanceAnalytics",
  "MASS", "car", "lmtest", "nortest", "Kendall",
  "changepoint", "testthat"
)

# Check and install missing packages
cat("\n2. Checking required packages...\n")
missing_packages <- character(0)

for (pkg in required_packages) {
  if (requireNamespace(pkg, quietly = TRUE)) {
    cat(paste("   [OK]", pkg, "\n"))
  } else {
    cat(paste("   [MISSING]", pkg, "\n"))
    missing_packages <- c(missing_packages, pkg)
  }
}

if (length(missing_packages) > 0) {
  cat(paste("\n3. Installing missing packages:", length(missing_packages), "packages...\n"))
  
  for (pkg in missing_packages) {
    cat(paste("   Installing", pkg, "...\n"))
    tryCatch({
      install.packages(pkg, repos = "https://cloud.r-project.org/", quiet = TRUE)
      cat(paste("   [DONE]", pkg, "\n"))
    }, error = function(e) {
      cat(paste("   [ERROR] Failed to install", pkg, ":", e$message, "\n"))
    })
  }
} else {
  cat("   All packages are installed!\n")
}

# Verify source files exist
cat("\n4. Verifying source files...\n")
required_files <- c(
  "R/packages.R",
  "R/helpers.R",
  "R/financial_analysis.R",
  "R/statistical_tests.R",
  "R/time_series.R",
  "R/international.R",
  "plumber.R"
)

files_ok <- TRUE
for (file in required_files) {
  if (file.exists(file)) {
    cat(paste("   [OK]", file, "\n"))
  } else {
    cat(paste("   [MISSING]", file, "\n"))
    files_ok <- FALSE
  }
}

if (!files_ok) {
  stop("Some required files are missing. Please check the installation.")
}

# Test load source files
cat("\n5. Testing source file loading...\n")
tryCatch({
  source("R/packages.R")
  cat("   [OK] packages.R loaded\n")
  
  source("R/helpers.R")
  cat("   [OK] helpers.R loaded\n")
  
  source("R/financial_analysis.R")
  cat("   [OK] financial_analysis.R loaded\n")
  
  source("R/statistical_tests.R")
  cat("   [OK] statistical_tests.R loaded\n")
  
  source("R/time_series.R")
  cat("   [OK] time_series.R loaded\n")
  
  source("R/international.R")
  cat("   [OK] international.R loaded\n")
}, error = function(e) {
  cat(paste("   [ERROR]", e$message, "\n"))
  stop("Failed to load source files")
})

# Run basic function tests
cat("\n6. Running basic function tests...\n")

test_that <- testthat::test_that
expect_true <- testthat::expect_true
expect_equal <- testthat::expect_equal

# Test helpers
tryCatch({
  test_that("null coalescing works", {
    expect_equal(NULL %||% "default", "default")
    expect_equal("value" %||% "default", "value")
  })
  cat("   [OK] Helper functions work\n")
}, error = function(e) {
  cat(paste("   [ERROR] Helper test failed:", e$message, "\n"))
})

# Test financial analysis
tryCatch({
  bs <- list(
    total_assets = 1000000,
    total_equity = 600000,
    total_liabilities = 400000
  )
  pl <- list(
    revenue = list(list(amount = 500000)),
    net_income = 50000,
    operating_income = 80000
  )
  result <- calculate_financial_ratios(bs, pl)
  expect_true(result$success)
  cat("   [OK] Financial ratios calculation works\n")
}, error = function(e) {
  cat(paste("   [ERROR] Financial analysis test failed:", e$message, "\n"))
})

# Test statistical functions
tryCatch({
  data <- rnorm(100)
  result <- test_normality(data)
  expect_true(result$success)
  cat("   [OK] Normality test works\n")
}, error = function(e) {
  cat(paste("   [ERROR] Statistical test failed:", e$message, "\n"))
})

# Test time series
tryCatch({
  data <- cumsum(rnorm(36, 0.5, 1))
  result <- forecast_arima(data, horizon = 6)
  expect_true(result$success)
  cat("   [OK] ARIMA forecast works\n")
}, error = function(e) {
  cat(paste("   [ERROR] Time series test failed:", e$message, "\n"))
})

# Summary
cat("\n")
cat("===========================================\n")
cat("   Setup Complete!\n")
cat("===========================================\n")
cat("\n")
cat("To start the service, run:\n")
cat("  Rscript -e \"pr <- plumber::plumb('plumber.R'); pr\\$run(host='0.0.0.0', port=8001)\"\n")
cat("\n")
cat("Or with R:\n")
cat("  R\n")
cat("  pr <- plumber::plumb('plumber.R')\n")
cat("  pr$run(host='0.0.0.0', port=8001)\n")
cat("\n")
cat("API will be available at: http://localhost:8001\n")
cat("Swagger UI: http://localhost:8001/__swagger__/\n")
