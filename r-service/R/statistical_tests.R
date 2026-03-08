source("R/helpers.R")

#' @title Perform Normality Tests
#' @description Test if financial data follows normal distribution
#' @param data Numeric vector
#' @return List of test results
test_normality <- function(data) {
  log_info("Performing normality tests")
  
  tryCatch({
    data <- as.numeric(data)
    data <- data[!is.na(data)]
    
    if (length(data) < 3) {
      return(create_error_response(
        "Insufficient data points for normality test (minimum 3 required)",
        "INSUFFICIENT_DATA"
      ))
    }
    
    shapiro_result <- if (length(data) >= 3 && length(data) <= 5000) {
      test <- shapiro.test(data)
      list(
        statistic = unname(test$statistic),
        p_value = test$p.value,
        interpretation = if (test$p.value > 0.05) "Normal" else "Non-normal"
      )
    } else {
      list(error = "Sample size out of range for Shapiro-Wilk (3-5000)")
    }
    
    jb_result <- tryCatch({
      n <- length(data)
      m <- mean(data)
      s <- sd(data)
      skew <- sum((data - m)^3) / (n * s^3)
      kurt <- sum((data - m)^4) / (n * s^4) - 3
      jb_stat <- n * (skew^2 / 6 + kurt^2 / 24)
      p_val <- 1 - pchisq(jb_stat, df = 2)
      list(
        statistic = unname(jb_stat),
        p_value = p_val,
        interpretation = if (p_val > 0.05) "Normal" else "Non-normal"
      )
    }, error = function(e) list(error = e$message))
    
    ad_result <- tryCatch({
      if (is_package_available("nortest")) {
        library(nortest)
        test <- ad.test(data)
        list(
          statistic = unname(test$statistic),
          p_value = test$p.value
        )
      } else {
        list(error = "nortest package not available")
      }
    }, error = function(e) list(error = e$message))
    
    result <- list(
      shapiro_wilk = shapiro_result,
      jarque_bera = jb_result,
      anderson_darling = ad_result,
      descriptive_stats = list(
        n = length(data),
        mean = round(mean(data), 4),
        median = round(median(data), 4),
        sd = round(sd(data), 4),
        skewness = round(skewness(data), 4),
        kurtosis = round(kurtosis(data), 4)
      ),
      conclusion = if (shapiro_result$p_value %||% 0 > 0.05) {
        "Data appears to be normally distributed"
      } else {
        "Data does not appear to be normally distributed"
      }
    )
    
    log_info("Normality tests completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in normality tests:", e$message))
    return(create_error_response(e$message, "TEST_ERROR"))
  })
}

#' @title Perform Trend Analysis
#' @description Statistical trend analysis with significance testing
#' @param time_series Numeric vector of time series data
#' @param dates Optional date vector
#' @return Trend analysis results
analyze_trend <- function(time_series, dates = NULL) {
  log_info("Performing trend analysis")
  
  tryCatch({
    time_series <- as.numeric(time_series)
    time_series <- time_series[!is.na(time_series)]
    n <- length(time_series)
    
    if (n < 3) {
      return(create_error_response(
        "Insufficient data points for trend analysis (minimum 3 required)",
        "INSUFFICIENT_DATA"
      ))
    }
    
    t <- 1:n
    model <- lm(time_series ~ t)
    summary_model <- summary(model)
    
    mk_result <- tryCatch({
      if (is_package_available("Kendall")) {
        library(Kendall)
        test <- MannKendall(time_series)
        list(
          tau = unname(test$tau),
          p_value = test$sl,
          interpretation = if (test$sl < 0.05) "Significant trend" else "No significant trend"
        )
      } else {
        list(error = "Kendall package not available")
      }
    }, error = function(e) list(error = e$message))
    
    slope_ci <- tryCatch({
      confint(model, "t", level = 0.95)
    }, error = function(e) NULL)
    
    result <- list(
      linear_regression = list(
        slope = round(coef(model)[2], 6),
        intercept = round(coef(model)[1], 4),
        r_squared = round(summary_model$r.squared, 4),
        adjusted_r_squared = round(summary_model$adj.r.squared, 4),
        p_value = round(summary_model$coefficients[2, 4], 6),
        slope_ci_95 = if (!is.null(slope_ci)) {
          list(
            lower = round(slope_ci[1], 6),
            upper = round(slope_ci[2], 6)
          )
        } else NULL
      ),
      mann_kendall = mk_result,
      descriptive_stats = list(
        n = n,
        mean = round(mean(time_series), 4),
        sd = round(sd(time_series), 4),
        min = round(min(time_series), 4),
        max = round(max(time_series), 4)
      ),
      trend_direction = if (coef(model)[2] > 0) "increasing" else "decreasing",
      trend_significance = if (summary_model$coefficients[2, 4] < 0.05) "significant" else "not significant"
    )
    
    log_info("Trend analysis completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in trend analysis:", e$message))
    return(create_error_response(e$message, "ANALYSIS_ERROR"))
  })
}

#' @title Compare Two Periods
#' @description Statistical comparison of two financial periods
#' @param period1 Numeric vector for period 1
#' @param period2 Numeric vector for period 2
#' @return Comparison results with statistical tests
compare_periods <- function(period1, period2) {
  log_info("Comparing two periods")
  
  tryCatch({
    period1 <- as.numeric(period1)
    period2 <- as.numeric(period2)
    period1 <- period1[!is.na(period1)]
    period2 <- period2[!is.na(period2)]
    
    if (length(period1) < 2 || length(period2) < 2) {
      return(create_error_response(
        "Insufficient data points for comparison (minimum 2 per period)",
        "INSUFFICIENT_DATA"
      ))
    }
    
    stats1 <- list(
      mean = round(mean(period1), 4),
      median = round(median(period1), 4),
      sd = round(sd(period1), 4),
      n = length(period1),
      se = round(sd(period1) / sqrt(length(period1)), 4)
    )
    
    stats2 <- list(
      mean = round(mean(period2), 4),
      median = round(median(period2), 4),
      sd = round(sd(period2), 4),
      n = length(period2),
      se = round(sd(period2) / sqrt(length(period2)), 4)
    )
    
    t_test <- tryCatch({
      test <- t.test(period1, period2)
      list(
        statistic = unname(test$statistic),
        df = test$parameter,
        p_value = test$p.value,
        ci_lower = test$conf.int[1],
        ci_upper = test$conf.int[2],
        method = test$method
      )
    }, error = function(e) list(error = e$message))
    
    wilcox_test <- tryCatch({
      test <- wilcox.test(period1, period2)
      list(
        statistic = unname(test$statistic),
        p_value = test$p.value
      )
    }, error = function(e) list(error = e$message))
    
    pooled_sd <- sqrt(((length(period1) - 1) * var(period1) + (length(period2) - 1) * var(period2)) / 
                        (length(period1) + length(period2) - 2))
    cohens_d <- (mean(period1) - mean(period2)) / pooled_sd
    
    f_test <- tryCatch({
      test <- var.test(period1, period2)
      list(
        statistic = unname(test$statistic),
        p_value = test$p.value
      )
    }, error = function(e) list(error = e$message))
    
    result <- list(
      period1_stats = stats1,
      period2_stats = stats2,
      difference = list(
        absolute = round(mean(period1) - mean(period2), 4),
        percentage = round(((mean(period1) - mean(period2)) / abs(mean(period2))) * 100, 2)
      ),
      t_test = t_test,
      wilcoxon_test = wilcox_test,
      f_test = f_test,
      effect_size = list(
        cohens_d = round(cohens_d, 4),
        interpretation = interpret_cohens_d(cohens_d)
      ),
      conclusion = if (t_test$p_value %||% 1 < 0.05) {
        "Statistically significant difference between periods"
      } else {
        "No statistically significant difference between periods"
      }
    )
    
    log_info("Period comparison completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in period comparison:", e$message))
    return(create_error_response(e$message, "COMPARISON_ERROR"))
  })
}

#' @title Perform Correlation Analysis
#' @description Calculate correlation matrix with significance tests
#' @param data Numeric matrix or data frame
#' @param method Correlation method (pearson, spearman, kendall)
#' @return Correlation analysis results
analyze_correlation <- function(data, method = "pearson") {
  log_info(paste("Performing correlation analysis with method:", method))
  
  tryCatch({
    if (is.data.frame(data) || is.list(data)) {
      data <- do.call(cbind, lapply(data, as.numeric))
    }
    data <- as.matrix(data)
    
    if (nrow(data) < 3) {
      return(create_error_response(
        "Insufficient observations for correlation analysis (minimum 3 required)",
        "INSUFFICIENT_DATA"
      ))
    }
    
    cor_matrix <- cor(data, use = "complete.obs", method = method)
    
    n <- nrow(data)
    p_matrix <- matrix(NA, ncol = ncol(data), nrow = ncol(data))
    
    for (i in 1:ncol(data)) {
      for (j in 1:ncol(data)) {
        if (i != j) {
          test <- cor.test(data[, i], data[, j], method = method)
          p_matrix[i, j] <- test$p.value
        } else {
          p_matrix[i, j] <- NA
        }
      }
    }
    
    result <- list(
      correlation_matrix = round(cor_matrix, 4),
      p_value_matrix = round(p_matrix, 4),
      method = method,
      n_observations = n,
      interpretation = "P-values < 0.05 indicate statistically significant correlations"
    )
    
    log_info("Correlation analysis completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in correlation analysis:", e$message))
    return(create_error_response(e$message, "CORRELATION_ERROR"))
  })
}

#' @title Perform Regression Analysis
#' @description Linear regression with diagnostics
#' @param y Dependent variable
#' @param x Independent variable(s)
#' @return Regression results with diagnostics
perform_regression <- function(y, x) {
  log_info("Performing regression analysis")
  
  tryCatch({
    y <- as.numeric(y)
    
    if (is.list(x) && !is.data.frame(x)) {
      x <- do.call(cbind, lapply(x, as.numeric))
    }
    x <- as.matrix(x)
    
    data <- data.frame(y = y, x)
    data <- na.omit(data)
    
    if (nrow(data) < ncol(x) + 2) {
      return(create_error_response(
        "Insufficient observations for regression",
        "INSUFFICIENT_DATA"
      ))
    }
    
    model <- lm(y ~ ., data = data)
    summary_model <- summary(model)
    
    diagnostics <- list(
      r_squared = round(summary_model$r.squared, 4),
      adjusted_r_squared = round(summary_model$adj.r.squared, 4),
      f_statistic = unname(summary_model$fstatistic[1]),
      f_p_value = pf(summary_model$fstatistic[1], summary_model$fstatistic[2], 
                     summary_model$fstatistic[3], lower.tail = FALSE),
      residuals_analysis = list(
        min = round(min(residuals(model)), 4),
        q1 = round(quantile(residuals(model), 0.25), 4),
        median = round(median(residuals(model)), 4),
        q3 = round(quantile(residuals(model), 0.75), 4),
        max = round(max(residuals(model)), 4)
      )
    )
    
    dw_test <- tryCatch({
      if (is_package_available("lmtest")) {
        library(lmtest)
        test <- dwtest(model)
        list(
          statistic = unname(test$statistic),
          p_value = test$p.value,
          interpretation = if (test$p.value > 0.05) "No autocorrelation" else "Autocorrelation detected"
        )
      } else {
        list(error = "lmtest package not available")
      }
    }, error = function(e) list(error = e$message))
    
    bp_test <- tryCatch({
      library(lmtest)
      test <- bptest(model)
      list(
        statistic = unname(test$statistic),
        p_value = test$p.value,
        interpretation = if (test$p.value > 0.05) "Homoscedasticity" else "Heteroscedasticity detected"
      )
    }, error = function(e) list(error = e$message))
    
    coefficients <- as.data.frame(summary_model$coefficients)
    colnames(coefficients) <- c("estimate", "std_error", "t_value", "p_value")
    
    result <- list(
      coefficients = coefficients,
      diagnostics = diagnostics,
      durbin_watson = dw_test,
      breusch_pagan = bp_test,
      n_observations = nrow(data),
      model_significance = if (diagnostics$f_p_value < 0.05) "Significant" else "Not significant"
    )
    
    log_info("Regression analysis completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in regression analysis:", e$message))
    return(create_error_response(e$message, "REGRESSION_ERROR"))
  })
}
