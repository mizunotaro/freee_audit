source("R/helpers.R")

#' @title Convert Currency
#' @description Convert amounts between currencies
#' @param amount Numeric amount
#' @param from Source currency code
#' @param to Target currency code
#' @param rate Exchange rate (optional, will use default if not provided)
#' @return Converted amount
convert_currency <- function(amount, from, to, rate = NULL) {
  log_info(paste("Converting currency from", from, "to", to))
  
  tryCatch({
    amount <- as.numeric(amount)
    
    if (is.null(rate)) {
      default_rates <- list(
        JPY_USD = 0.0067,
        USD_JPY = 149.25,
        EUR_USD = 1.08,
        USD_EUR = 0.93,
        GBP_USD = 1.27,
        USD_GBP = 0.79,
        JPY_EUR = 0.0072,
        EUR_JPY = 139.0
      )
      
      rate_key <- paste(from, to, sep = "_")
      rate <- default_rates[[rate_key]]
      
      if (is.null(rate)) {
        return(create_error_response(
          paste("Exchange rate not found for", from, "to", to),
          "RATE_NOT_FOUND"
        ))
      }
    }
    
    converted <- amount * rate
    
    result <- list(
      original_amount = amount,
      original_currency = from,
      converted_amount = round(converted, 2),
      converted_currency = to,
      exchange_rate = rate,
      rate_source = if (is.null(rate)) "default" else "custom"
    )
    
    log_info(paste("Currency converted:", amount, from, "->", round(converted, 2), to))
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error converting currency:", e$message))
    return(create_error_response(e$message, "CONVERSION_ERROR"))
  })
}

#' @title Convert IFRS to JGAAP
#' @description Convert IFRS financial statements to Japanese GAAP
#' @param data IFRS format financial data
#' @return JGAAP format data
convert_ifrs_to_jgaap <- function(data) {
  log_info("Converting IFRS to JGAAP")
  
  tryCatch({
    adjustments <- list(
      development_costs = list(
        ifrs = "Capitalized",
        jgaap = "Expensed (generally)",
        adjustment = -(data$development_costs %||% 0)
      ),
      revaluation_model = list(
        ifrs = "Allowed (PP&E, Intangibles)",
        jgaap = "Generally not allowed",
        adjustment = -(data$revaluation_surplus %||% 0)
      ),
      impairment_reversal = list(
        ifrs = "Allowed (except goodwill)",
        jgaap = "Generally not allowed",
        adjustment = -(data$impairment_reversal %||% 0)
      ),
      lease_accounting = list(
        ifrs = "All leases on balance sheet",
        jgaap = "Operating leases off balance sheet",
        adjustment = (data$operating_lease_liability %||% 0) - 
          (data$operating_lease_asset %||% 0)
      )
    )
    
    total_adjustment <- sum(sapply(adjustments, function(x) x$adjustment))
    
    converted_equity <- (data$total_equity %||% 0) + total_adjustment
    converted_assets <- (data$total_assets %||% 0) + 
      (adjustments$development_costs$adjustment %||% 0) +
      (adjustments$revaluation_model$adjustment %||% 0)
    
    result <- list(
      original_data = data,
      adjustments = adjustments,
      total_adjustment = round(total_adjustment, 2),
      converted_data = list(
        total_assets = round(converted_assets, 2),
        total_equity = round(converted_equity, 2),
        total_liabilities = round((data$total_liabilities %||% 0) - total_adjustment, 2)
      ),
      notes = c(
        "Development costs are generally expensed under JGAAP",
        "Revaluation model is generally not permitted under JGAAP",
        "Impairment reversals are generally not permitted under JGAAP",
        "Operating leases may be off balance sheet under JGAAP"
      )
    )
    
    log_info("IFRS to JGAAP conversion completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error converting IFRS to JGAAP:", e$message))
    return(create_error_response(e$message, "CONVERSION_ERROR"))
  })
}

#' @title Convert JGAAP to IFRS
#' @description Convert Japanese GAAP financial statements to IFRS
#' @param data JGAAP format financial data
#' @return IFRS format data
convert_jgaap_to_ifrs <- function(data) {
  log_info("Converting JGAAP to IFRS")
  
  tryCatch({
    adjustments <- list(
      development_costs = list(
        jgaap = "Expensed",
        ifrs = "Capitalized (if criteria met)",
        adjustment = (data$development_costs_expensed %||% 0)
      ),
      available_for_sale_securities = list(
        jgaap = "Unrealized gains/losses in equity",
        ifrs = "Fair value through OCI or P&L",
        adjustment = 0
      ),
      deferred_tax = list(
        jgaap = "Different timing recognition",
        ifrs = "Balance sheet approach",
        adjustment = (data$deferred_tax_adjustment %||% 0)
      )
    )
    
    total_adjustment <- sum(sapply(adjustments, function(x) x$adjustment))
    
    result <- list(
      original_data = data,
      adjustments = adjustments,
      total_adjustment = round(total_adjustment, 2),
      converted_data = list(
        total_assets = round((data$total_assets %||% 0) + total_adjustment, 2),
        total_equity = round((data$total_equity %||% 0) + total_adjustment, 2),
        total_liabilities = data$total_liabilities %||% 0
      ),
      notes = c(
        "Development costs may be capitalized under IFRS if criteria are met",
        "Available-for-sale securities are measured at fair value under IFRS 9",
        "Deferred taxes follow balance sheet approach under IAS 12"
      )
    )
    
    log_info("JGAAP to IFRS conversion completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error converting JGAAP to IFRS:", e$message))
    return(create_error_response(e$message, "CONVERSION_ERROR"))
  })
}

#' @title Adjust for Inflation
#' @description Adjust financial data for inflation
#' @param data Financial data
#' @param base_year Base year for adjustment
#' @param current_year Current year
#' @param cpi_index Consumer price index values
#' @return Inflation-adjusted data
adjust_for_inflation <- function(data, base_year, current_year, cpi_index = NULL) {
  log_info(paste("Adjusting for inflation from", base_year, "to", current_year))
  
  tryCatch({
    if (is.null(cpi_index)) {
      japan_cpi <- list(
        "2018" = 101.5,
        "2019" = 101.9,
        "2020" = 101.8,
        "2021" = 102.0,
        "2022" = 104.3,
        "2023" = 107.6,
        "2024" = 110.2
      )
      cpi_index <- japan_cpi
    }
    
    base_cpi <- cpi_index[[as.character(base_year)]]
    current_cpi <- cpi_index[[as.character(current_year)]]
    
    if (is.null(base_cpi) || is.null(current_cpi)) {
      return(create_error_response(
        "CPI index not available for specified years",
        "DATA_NOT_FOUND"
      ))
    }
    
    inflation_factor <- current_cpi / base_cpi
    
    adjust_value <- function(x) {
      if (is.numeric(x)) {
        return(x * inflation_factor)
      }
      return(x)
    }
    
    adjusted_data <- data
    
    if (is.list(data) && !is.data.frame(data)) {
      numeric_fields <- c("revenue", "net_income", "total_assets", "total_equity",
                          "operating_income", "gross_profit", "depreciation")
      for (field in numeric_fields) {
        if (!is.null(data[[field]])) {
          adjusted_data[[field]] <- adjust_value(data[[field]])
        }
      }
    } else if (is.numeric(data)) {
      adjusted_data <- adjust_value(data)
    }
    
    result <- list(
      original_data = data,
      adjusted_data = adjusted_data,
      adjustment_factor = round(inflation_factor, 4),
      base_year = base_year,
      current_year = current_year,
      cpi_base = base_cpi,
      cpi_current = current_cpi,
      inflation_rate = round((inflation_factor - 1) * 100, 2)
    )
    
    log_info(paste("Inflation adjustment completed. Factor:", round(inflation_factor, 4)))
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error adjusting for inflation:", e$message))
    return(create_error_response(e$message, "ADJUSTMENT_ERROR"))
  })
}

#' @title Segment Reporting Analysis
#' @description Analyze segment reporting data
#' @param segments List of segment data
#' @return Segment analysis results
analyze_segments <- function(segments) {
  log_info("Analyzing segment reporting")
  
  tryCatch({
    if (!is.list(segments) || length(segments) == 0) {
      return(create_error_response(
        "Invalid segment data provided",
        "INVALID_DATA"
      ))
    }
    
    segment_names <- names(segments)
    if (is.null(segment_names)) {
      segment_names <- paste0("Segment_", seq_along(segments))
    }
    
    total_revenue <- sum(sapply(segments, function(s) s$revenue %||% 0))
    total_assets <- sum(sapply(segments, function(s) s$assets %||% 0))
    total_profit <- sum(sapply(segments, function(s) s$profit %||% 0))
    
    segment_analysis <- lapply(seq_along(segments), function(i) {
      s <- segments[[i]]
      name <- segment_names[i]
      
      revenue <- s$revenue %||% 0
      assets <- s$assets %||% 0
      profit <- s$profit %||% 0
      
      list(
        name = name,
        revenue = revenue,
        revenue_share = safe_divide(revenue * 100, total_revenue),
        assets = assets,
        assets_share = safe_divide(assets * 100, total_assets),
        profit = profit,
        profit_share = safe_divide(profit * 100, total_profit),
        roa = safe_divide(profit * 100, assets),
        profit_margin = safe_divide(profit * 100, revenue)
      )
    })
    
    names(segment_analysis) <- segment_names
    
    herfindahl_revenue <- sum(sapply(segment_analysis, function(s) {
      share <- (s$revenue_share %||% 0) / 100
      share^2
    }))
    
    result <- list(
      segments = segment_analysis,
      totals = list(
        revenue = total_revenue,
        assets = total_assets,
        profit = total_profit
      ),
      concentration = list(
        herfindahl_index = round(herfindahl_revenue, 4),
        interpretation = if (herfindahl_revenue > 0.25) {
          "Highly concentrated (dominant segment)"
        } else if (herfindahl_revenue > 0.15) {
          "Moderately concentrated"
        } else {
          "Diversified revenue base"
        }
      ),
      top_segment = segment_names[which.max(sapply(segment_analysis, function(s) s$revenue))]
    )
    
    log_info("Segment analysis completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error analyzing segments:", e$message))
    return(create_error_response(e$message, "ANALYSIS_ERROR"))
  })
}
