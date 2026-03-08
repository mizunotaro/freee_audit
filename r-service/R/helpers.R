#' Null coalescing operator
#' @param x First value
#' @param y Default value if x is NULL or NA
#' @return x if not NULL/NA, otherwise y
`%||%` <- function(x, y) {
  if (is.null(x) || (length(x) == 1 && is.na(x))) y else x
}

#' Calculate data quality score
#' @param bs Balance sheet data
#' @param pl Profit and loss data
#' @return Quality score between 0 and 1
calculate_data_quality_score <- function(bs, pl) {
  score <- 1.0
  
  required_bs_fields <- c("total_assets", "total_equity", "total_liabilities")
  required_pl_fields <- c("revenue", "net_income")
  
  for (field in required_bs_fields) {
    if (is.null(bs[[field]]) || is.na(bs[[field]])) {
      score <- score - 0.1
    }
  }
  
  for (field in required_pl_fields) {
    if (is.null(pl[[field]]) || is.na(pl[[field]])) {
      score <- score - 0.1
    }
  }
  
  return(max(0, round(score, 2)))
}

#' Safe division with zero handling
#' @param numerator Numeric value
#' @param denominator Numeric value
#' @param default Default value if denominator is zero or NA
#' @return Result of division or default
safe_divide <- function(numerator, denominator, default = NA_real_) {
  if (is.null(denominator) || is.na(denominator) || denominator == 0) {
    return(default)
  }
  return(numerator / denominator)
}

#' Extract amount from nested structure
#' @param data Nested list containing amount field
#' @param pattern Optional regex pattern to match name
#' @return Sum of matching amounts
extract_amount <- function(data, pattern = NULL) {
  if (is.null(data)) return(0)
  
  if (!is.null(pattern)) {
    return(sum(sapply(data, function(x) {
      if (grepl(pattern, x$name, ignore.case = TRUE)) x$amount else 0
    })))
  }
  
  return(sum(sapply(data, function(x) x$amount %||% 0)))
}

#' Format number with precision
#' @param x Numeric value
#' @param digits Number of decimal places
#' @return Formatted number
format_number <- function(x, digits = 2) {
  if (is.null(x) || is.na(x)) return(NA_real_)
  return(round(x, digits))
}

#' Calculate percentage
#' @param part Part value
#' @param whole Whole value
#' @return Percentage or NA if invalid
calculate_percentage <- function(part, whole) {
  if (is.null(whole) || is.na(whole) || whole == 0) {
    return(NA_real_)
  }
  return((part / whole) * 100)
}

#' Validate JSON input
#' @param input Input to validate
#' @return TRUE if valid, FALSE otherwise
validate_json_input <- function(input) {
  if (is.null(input)) return(FALSE)
  if (is.character(input)) {
    tryCatch({
      jsonlite::fromJSON(input)
      return(TRUE)
    }, error = function(e) return(FALSE))
  }
  return(is.list(input))
}

#' Create error response
#' @param message Error message
#' @param code Error code
#' @return Error list
create_error_response <- function(message, code = "ERROR") {
  list(
    success = FALSE,
    error = list(
      code = code,
      message = message
    )
  )
}

#' Create success response
#' @param data Response data
#' @return Success list
create_success_response <- function(data) {
  list(
    success = TRUE,
    data = data
  )
}

#' Interpret Cohen's d effect size
#' @param d Cohen's d value
#' @return Interpretation string
interpret_cohens_d <- function(d) {
  abs_d <- abs(d)
  if (abs_d < 0.2) return("negligible")
  if (abs_d < 0.5) return("small")
  if (abs_d < 0.8) return("medium")
  return("large")
}

#' Safe quantile calculation
#' @param x Numeric vector
#' @param probs Probability values
#' @return Quantile values or NA
safe_quantile <- function(x, probs = c(0.25, 0.5, 0.75)) {
  if (is.null(x) || length(x) == 0 || all(is.na(x))) {
    return(rep(NA_real_, length(probs)))
  }
  return(quantile(x, probs = probs, na.rm = TRUE))
}

#' Calculate skewness
#' @param x Numeric vector
#' @return Skewness value
skewness <- function(x) {
  n <- length(x)
  if (n < 3) return(NA_real_)
  m <- mean(x, na.rm = TRUE)
  s <- sd(x, na.rm = TRUE)
  if (s == 0) return(NA_real_)
  sum((x - m)^3, na.rm = TRUE) / (n * s^3)
}

#' Calculate kurtosis
#' @param x Numeric vector
#' @return Excess kurtosis value
kurtosis <- function(x) {
  n <- length(x)
  if (n < 4) return(NA_real_)
  m <- mean(x, na.rm = TRUE)
  s <- sd(x, na.rm = TRUE)
  if (s == 0) return(NA_real_)
  sum((x - m)^4, na.rm = TRUE) / (n * s^4) - 3
}

#' Convert to numeric safely
#' @param x Input value
#' @return Numeric value or NA
safe_as_numeric <- function(x) {
  tryCatch(
    as.numeric(x),
    warning = function(w) NA_real_,
    error = function(e) NA_real_
  )
}

#' Check if package is available
#' @param pkg Package name
#' @return TRUE if available, FALSE otherwise
is_package_available <- function(pkg) {
  requireNamespace(pkg, quietly = TRUE)
}
