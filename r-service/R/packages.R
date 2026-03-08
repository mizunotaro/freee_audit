# Core
library(plumber)
library(jsonlite)

# Data manipulation
library(dplyr)
library(tidyr)
library(purrr)

# Statistics
library(stats)
library(MASS)
library(car)

# Time series
library(forecast)
library(tseries)
library(zoo)
library(xts)

# Financial
library(PerformanceAnalytics)
library(lmtest)

# Visualization (server-side)
library(ggplot2)
library(plotly)

# Utilities
library(httr)
library(logger)

# Additional packages for statistical tests
tryCatch(library(nortest), error = function(e) {
  warning("nortest package not available. Install with: install.packages('nortest')")
})

tryCatch(library(Kendall), error = function(e) {
  warning("Kendall package not available. Install with: install.packages('Kendall')")
})

tryCatch(library(changepoint), error = function(e) {
  warning("changepoint package not available. Install with: install.packages('changepoint')")
})

# Configure logging
log_threshold(INFO)
