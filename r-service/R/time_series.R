source("R/helpers.R")

#' @title ARIMA Forecasting
#' @description Forecast financial metrics using ARIMA
#' @param data Time series data (numeric vector)
#' @param horizon Number of periods to forecast
#' @param frequency Time series frequency (default 12 for monthly)
#' @return Forecast with confidence intervals
forecast_arima <- function(data, horizon = 12, frequency = 12) {
  log_info(paste("Starting ARIMA forecast with horizon:", horizon))
  
  tryCatch({
    data <- as.numeric(data)
    data <- data[!is.na(data)]
    
    if (length(data) < frequency * 2) {
      return(create_error_response(
        paste("Insufficient data for ARIMA forecast (minimum", frequency * 2, "observations)"),
        "INSUFFICIENT_DATA"
      ))
    }
    
    ts_data <- ts(data, frequency = frequency)
    
    model <- auto.arima(ts_data, 
                        seasonal = TRUE,
                        stepwise = FALSE,
                        approximation = FALSE,
                        trace = FALSE)
    
    fc <- forecast(model, h = horizon, level = c(80, 95))
    
    accuracy_metrics <- accuracy(fc)
    
    result <- list(
      model = list(
        order = c(model$arma[1], model$arma[6], model$arma[2]),
        seasonal_order = c(model$arma[3], model$arma[7], model$arma[4], model$arma[5]),
        aic = round(model$aic, 2),
        bic = round(model$bic, 2)
      ),
      forecast = list(
        point = as.numeric(round(fc$mean, 2)),
        lower_80 = as.numeric(round(fc$lower[, 1], 2)),
        upper_80 = as.numeric(round(fc$upper[, 1], 2)),
        lower_95 = as.numeric(round(fc$lower[, 2], 2)),
        upper_95 = as.numeric(round(fc$upper[, 2], 2))
      ),
      accuracy = list(
        me = round(accuracy_metrics[1, "ME"], 4),
        rmse = round(accuracy_metrics[1, "RMSE"], 4),
        mae = round(accuracy_metrics[1, "MAE"], 4),
        mpe = round(accuracy_metrics[1, "MPE"], 4),
        mape = round(accuracy_metrics[1, "MAPE"], 4),
        mase = round(accuracy_metrics[1, "MASE"], 4)
      ),
      training_data = list(
        n = length(data),
        mean = round(mean(data), 2),
        sd = round(sd(data), 2)
      )
    )
    
    log_info("ARIMA forecast completed successfully")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in ARIMA forecast:", e$message))
    return(create_error_response(e$message, "FORECAST_ERROR"))
  })
}

#' @title Exponential Smoothing Forecast
#' @description Forecast using ETS (Error, Trend, Seasonality) model
#' @param data Time series data
#' @param horizon Number of periods to forecast
#' @param frequency Time series frequency
#' @return ETS forecast results
forecast_ets <- function(data, horizon = 12, frequency = 12) {
  log_info(paste("Starting ETS forecast with horizon:", horizon))
  
  tryCatch({
    data <- as.numeric(data)
    data <- data[!is.na(data)]
    
    if (length(data) < frequency * 2) {
      return(create_error_response(
        paste("Insufficient data for ETS forecast"),
        "INSUFFICIENT_DATA"
      ))
    }
    
    ts_data <- ts(data, frequency = frequency)
    
    model <- ets(ts_data)
    
    fc <- forecast(model, h = horizon, level = c(80, 95))
    
    result <- list(
      model = list(
        error_type = model$components[1],
        trend_type = model$components[2],
        season_type = model$components[3],
        aic = round(model$aic, 2),
        bic = round(model$bic, 2)
      ),
      forecast = list(
        point = as.numeric(round(fc$mean, 2)),
        lower_80 = as.numeric(round(fc$lower[, 1], 2)),
        upper_80 = as.numeric(round(fc$upper[, 1], 2)),
        lower_95 = as.numeric(round(fc$lower[, 2], 2)),
        upper_95 = as.numeric(round(fc$upper[, 2], 2))
      ),
      accuracy = list(
        me = round(accuracy(fc)[1, "ME"], 4),
        rmse = round(accuracy(fc)[1, "RMSE"], 4),
        mae = round(accuracy(fc)[1, "MAE"], 4),
        mape = round(accuracy(fc)[1, "MAPE"], 4)
      )
    )
    
    log_info("ETS forecast completed successfully")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in ETS forecast:", e$message))
    return(create_error_response(e$message, "FORECAST_ERROR"))
  })
}

#' @title Seasonal Decomposition
#' @description Decompose time series into trend, seasonal, and remainder components
#' @param data Time series data
#' @param frequency Seasonal frequency
#' @return Decomposition results
decompose_seasonal <- function(data, frequency = 12) {
  log_info(paste("Starting seasonal decomposition with frequency:", frequency))
  
  tryCatch({
    data <- as.numeric(data)
    data <- data[!is.na(data)]
    
    if (length(data) < frequency * 2) {
      return(create_error_response(
        "Insufficient data for seasonal decomposition",
        "INSUFFICIENT_DATA"
      ))
    }
    
    ts_data <- ts(data, frequency = frequency)
    
    stl_result <- stl(ts_data, s.window = "periodic", robust = TRUE)
    
    seasonal_strength <- 1 - var(stl_result$time.series[, "remainder"]) / 
      var(stl_result$time.series[, "remainder"] + stl_result$time.series[, "seasonal"])
    
    trend_strength <- 1 - var(stl_result$time.series[, "remainder"]) / 
      var(stl_result$time.series[, "remainder"] + stl_result$time.series[, "trend"])
    
    result <- list(
      components = list(
        trend = as.numeric(round(stl_result$time.series[, "trend"], 4)),
        seasonal = as.numeric(round(stl_result$time.series[, "seasonal"], 4)),
        remainder = as.numeric(round(stl_result$time.series[, "remainder"], 4))
      ),
      original = data,
      strength = list(
        seasonal = round(seasonal_strength, 4),
        trend = round(trend_strength, 4)
      ),
      statistics = list(
        trend_mean = round(mean(stl_result$time.series[, "trend"], na.rm = TRUE), 4),
        seasonal_amplitude = round(max(stl_result$time.series[, "seasonal"]) - 
                                     min(stl_result$time.series[, "seasonal"]), 4),
        remainder_sd = round(sd(stl_result$time.series[, "remainder"]), 4)
      )
    )
    
    log_info("Seasonal decomposition completed successfully")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in seasonal decomposition:", e$message))
    return(create_error_response(e$message, "DECOMPOSITION_ERROR"))
  })
}

#' @title Change Point Detection
#' @description Detect structural breaks in financial time series
#' @param data Time series data
#' @param method Detection method (PELT, BinSeg, SegNeigh)
#' @return Detected change points
detect_changepoints <- function(data, method = "PELT") {
  log_info(paste("Starting change point detection with method:", method))
  
  tryCatch({
    data <- as.numeric(data)
    data <- data[!is.na(data)]
    
    if (length(data) < 10) {
      return(create_error_response(
        "Insufficient data for change point detection (minimum 10 observations)",
        "INSUFFICIENT_DATA"
      ))
    }
    
    if (!is_package_available("changepoint")) {
      return(create_error_response(
        "changepoint package not available",
        "PACKAGE_MISSING"
      ))
    }
    
    library(changepoint)
    
    mean_changes <- tryCatch({
      cpt <- cpt.mean(data, method = method)
      list(
        change_points = cpts(cpt),
        num_changes = length(cpts(cpt))
      )
    }, error = function(e) list(error = e$message))
    
    var_changes <- tryCatch({
      cpt <- cpt.var(data, method = method)
      list(
        change_points = cpts(cpt),
        num_changes = length(cpts(cpt))
      )
    }, error = function(e) list(error = e$message))
    
    meanvar_changes <- tryCatch({
      cpt <- cpt.meanvar(data, method = method)
      list(
        change_points = cpts(cpt),
        num_changes = length(cpts(cpt))
      )
    }, error = function(e) list(error = e$message))
    
    result <- list(
      mean_change = mean_changes,
      variance_change = var_changes,
      meanvar_change = meanvar_changes,
      summary = list(
        total_observations = length(data),
        method = method
      )
    )
    
    log_info("Change point detection completed successfully")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in change point detection:", e$message))
    return(create_error_response(e$message, "DETECTION_ERROR"))
  })
}

#' @title Unit Root Tests
#' @description Test for stationarity in time series
#' @param data Time series data
#' @return Unit root test results
test_unit_root <- function(data) {
  log_info("Performing unit root tests")
  
  tryCatch({
    data <- as.numeric(data)
    data <- data[!is.na(data)]
    
    if (length(data) < 20) {
      return(create_error_response(
        "Insufficient data for unit root tests (minimum 20 observations)",
        "INSUFFICIENT_DATA"
      ))
    }
    
    adf_test <- tryCatch({
      test <- adf.test(data)
      list(
        statistic = unname(test$statistic),
        p_value = test$p.value,
        interpretation = if (test$p.value < 0.05) "Stationary" else "Non-stationary"
      )
    }, error = function(e) list(error = e$message))
    
    pp_test <- tryCatch({
      test <- pp.test(data)
      list(
        statistic = unname(test$statistic),
        p_value = test$p.value,
        interpretation = if (test$p.value < 0.05) "Stationary" else "Non-stationary"
      )
    }, error = function(e) list(error = e$message))
    
    kpss_test <- tryCatch({
      test <- kpss.test(data)
      list(
        statistic = unname(test$statistic),
        p_value = test$p.value,
        interpretation = if (test$p.value > 0.05) "Stationary" else "Non-stationary"
      )
    }, error = function(e) list(error = e$message))
    
    result <- list(
      augmented_dickey_fuller = adf_test,
      phillips_perron = pp_test,
      kpss = kpss_test,
      conclusion = if ((adf_test$p_value %||% 1) < 0.05 && (kpss_test$p_value %||% 0) > 0.05) {
        "Series appears to be stationary"
      } else {
        "Series appears to be non-stationary; differencing may be required"
      }
    )
    
    log_info("Unit root tests completed successfully")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in unit root tests:", e$message))
    return(create_error_response(e$message, "TEST_ERROR"))
  })
}

#' @title Calculate Moving Averages
#' @description Calculate various moving averages for time series
#' @param data Time series data
#' @param windows Vector of window sizes
#' @return Moving average results
calculate_moving_averages <- function(data, windows = c(3, 6, 12)) {
  log_info(paste("Calculating moving averages for windows:", paste(windows, collapse = ", ")))
  
  tryCatch({
    data <- as.numeric(data)
    data <- data[!is.na(data)]
    
    if (length(data) < max(windows)) {
      return(create_error_response(
        paste("Insufficient data for largest window size:", max(windows)),
        "INSUFFICIENT_DATA"
      ))
    }
    
    ma_results <- list()
    
    for (w in windows) {
      if (w <= length(data)) {
        ma <- rollmean(data, k = w, fill = NA, align = "right")
        ma_results[[paste0("ma_", w)]] <- as.numeric(round(ma, 4))
      }
    }
    
    ewma <- tryCatch({
      ema <- list()
      for (alpha in c(0.1, 0.3, 0.5)) {
        ema_values <- numeric(length(data))
        ema_values[1] <- data[1]
        for (i in 2:length(data)) {
          ema_values[i] <- alpha * data[i] + (1 - alpha) * ema_values[i - 1]
        }
        ema[[paste0("ewma_", alpha)]] <- round(ema_values, 4)
      }
      ema
    }, error = function(e) list(error = e$message))
    
    result <- list(
      simple_moving_averages = ma_results,
      exponential_moving_averages = ewma,
      original_data = data,
      windows_used = windows
    )
    
    log_info("Moving averages calculated successfully")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error calculating moving averages:", e$message))
    return(create_error_response(e$message, "CALCULATION_ERROR"))
  })
}
