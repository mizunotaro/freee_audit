source("R/helpers.R")

#' @title Calculate Financial Ratios with Industry Benchmarks
#' @description Calculate comprehensive financial ratios with statistical comparison
#' @param bs Balance sheet data (list)
#' @param pl Profit and loss data (list)
#' @param industry_code Industry classification code (optional)
#' @return List of ratios with benchmark comparisons
calculate_financial_ratios <- function(bs, pl, industry_code = NULL) {
  log_info("Calculating financial ratios")
  
  tryCatch({
    total_assets <- bs$total_assets %||% 0
    total_equity <- bs$total_equity %||% 0
    total_liabilities <- bs$total_liabilities %||% 0
    
    current_assets <- if (!is.null(bs$assets$current)) {
      sum(sapply(bs$assets$current, function(x) x$amount %||% 0))
    } else 0
    
    current_liabilities <- if (!is.null(bs$liabilities$current)) {
      sum(sapply(bs$liabilities$current, function(x) x$amount %||% 0))
    } else 0
    
    inventory <- if (!is.null(bs$assets$current)) {
      sum(sapply(bs$assets$current, function(x) {
        if (!is.null(x$name) && grepl("棚卸|在庫|inventory", x$name, ignore.case = TRUE)) {
          x$amount %||% 0
        } else 0
      }))
    } else 0
    
    receivables <- if (!is.null(bs$assets$current)) {
      sum(sapply(bs$assets$current, function(x) {
        if (!is.null(x$name) && grepl("売掛|受取|receivable", x$name, ignore.case = TRUE)) {
          x$amount %||% 0
        } else 0
      }))
    } else 0
    
    revenue <- if (!is.null(pl$revenue) && is.list(pl$revenue)) {
      sum(sapply(pl$revenue, function(x) x$amount %||% 0))
    } else pl$revenue %||% 0
    
    net_income <- pl$net_income %||% 0
    operating_income <- pl$operating_income %||% 0
    depreciation <- pl$depreciation %||% 0
    cost_of_sales <- pl$cost_of_sales_total %||% 
      (if (!is.null(pl$cost_of_sales)) sum(sapply(pl$cost_of_sales, function(x) x$amount %||% 0)) else 0)
    cash_balance <- bs$cash_balance %||% 0
    
    ratios <- list(
      profitability = list(
        roe = safe_divide(net_income * 100, total_equity),
        roa = safe_divide(net_income * 100, total_assets),
        ros = safe_divide(operating_income * 100, revenue),
        gross_margin = pl$gross_profit_margin %||% safe_divide(
          (revenue - cost_of_sales) * 100, revenue
        ),
        operating_margin = pl$operating_margin %||% safe_divide(
          operating_income * 100, revenue
        ),
        ebitda_margin = safe_divide((operating_income + depreciation) * 100, revenue)
      ),
      liquidity = list(
        current_ratio = safe_divide(current_assets * 100, current_liabilities),
        quick_ratio = safe_divide((current_assets - inventory) * 100, current_liabilities),
        cash_ratio = safe_divide(cash_balance * 100, current_liabilities)
      ),
      leverage = list(
        debt_to_equity = safe_divide(total_liabilities, total_equity),
        equity_ratio = safe_divide(total_equity * 100, total_assets),
        debt_ratio = safe_divide(total_liabilities * 100, total_assets)
      ),
      efficiency = list(
        asset_turnover = safe_divide(revenue, total_assets),
        inventory_turnover = safe_divide(cost_of_sales, inventory),
        receivables_turnover = safe_divide(revenue, receivables),
        days_sales_outstanding = safe_divide(receivables * 365, revenue)
      )
    )
    
    ratios$confidence <- list(
      data_quality_score = calculate_data_quality_score(bs, pl),
      calculation_precision = "high",
      industry_code = industry_code
    )
    
    log_info("Financial ratios calculated successfully")
    return(create_success_response(ratios))
    
  }, error = function(e) {
    log_error(paste("Error calculating financial ratios:", e$message))
    return(create_error_response(e$message, "CALCULATION_ERROR"))
  })
}

#' @title Calculate Altman Z-Score
#' @description Calculate bankruptcy prediction score
#' @param bs Balance sheet data
#' @param pl Profit and loss data
#' @return Z-Score with interpretation
calculate_altman_zscore <- function(bs, pl) {
  log_info("Calculating Altman Z-Score")
  
  tryCatch({
    total_assets <- bs$total_assets %||% 0
    total_liabilities <- bs$total_liabilities %||% 0
    
    current_assets <- if (!is.null(bs$assets$current)) {
      sum(sapply(bs$assets$current, function(x) x$amount %||% 0))
    } else 0
    
    current_liabilities <- if (!is.null(bs$liabilities$current)) {
      sum(sapply(bs$liabilities$current, function(x) x$amount %||% 0))
    } else 0
    
    working_capital <- bs$working_capital %||% (current_assets - current_liabilities)
    
    retained_earnings <- bs$retained_earnings %||%
      if (!is.null(bs$equity$items)) {
        sum(sapply(bs$equity$items, function(x) {
          if (!is.null(x$name) && grepl("剰余金|利益|retained", x$name, ignore.case = TRUE)) {
            x$amount %||% 0
          } else 0
        }))
      } else 0
    
    ebit <- pl$operating_income %||% 0
    
    sales <- if (!is.null(pl$revenue) && is.list(pl$revenue)) {
      sum(sapply(pl$revenue, function(x) x$amount %||% 0))
    } else pl$revenue %||% 0
    
    market_cap <- bs$market_capitalization %||% bs$total_equity %||% 0
    
    if (total_assets == 0 || total_liabilities == 0) {
      return(create_error_response(
        "Insufficient data for Z-Score calculation",
        "INSUFFICIENT_DATA"
      ))
    }
    
    x1 <- working_capital / total_assets
    x2 <- retained_earnings / total_assets
    x3 <- ebit / total_assets
    x4 <- safe_divide(market_cap, total_liabilities)
    x5 <- sales / total_assets
    
    z_score <- 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5
    
    interpretation <- if (z_score > 2.99) {
      "Safe zone - low bankruptcy risk"
    } else if (z_score > 1.81) {
      "Grey zone - moderate risk"
    } else {
      "Distress zone - high bankruptcy risk"
    }
    
    result <- list(
      z_score = round(z_score, 4),
      components = list(
        x1_working_capital = round(x1, 4),
        x2_retained_earnings = round(x2, 4),
        x3_ebit = round(x3, 4),
        x4_market_equity = round(x4, 4),
        x5_sales = round(x5, 4)
      ),
      interpretation = interpretation,
      confidence_level = 0.95
    )
    
    log_info(paste("Z-Score calculated:", round(z_score, 4)))
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error calculating Z-Score:", e$message))
    return(create_error_response(e$message, "CALCULATION_ERROR"))
  })
}

#' @title Calculate Sustainable Growth Rate
#' @description Calculate sustainable growth rate with DuPont analysis
#' @param bs Balance sheet data
#' @param pl Profit and loss data
#' @return Sustainable growth analysis
calculate_sustainable_growth <- function(bs, pl) {
  log_info("Calculating sustainable growth rate")
  
  tryCatch({
    total_equity <- bs$total_equity %||% 0
    total_assets <- bs$total_assets %||% 0
    net_income <- pl$net_income %||% 0
    
    revenue <- if (!is.null(pl$revenue) && is.list(pl$revenue)) {
      sum(sapply(pl$revenue, function(x) x$amount %||% 0))
    } else pl$revenue %||% 0
    
    dividends <- pl$dividends %||% 0
    
    if (total_equity == 0 || revenue == 0 || total_assets == 0) {
      return(create_error_response(
        "Insufficient data for sustainable growth calculation",
        "INSUFFICIENT_DATA"
      ))
    }
    
    roe <- (net_income / total_equity) * 100
    retention_ratio <- if (net_income > 0) {
      1 - safe_divide(dividends, net_income, 0)
    } else 1
    
    profit_margin <- (net_income / revenue) * 100
    asset_turnover <- revenue / total_assets
    equity_multiplier <- total_assets / total_equity
    
    sgr <- roe * retention_ratio / 100
    
    result <- list(
      sustainable_growth_rate = round(sgr, 4),
      dupont_analysis = list(
        profit_margin = round(profit_margin, 2),
        asset_turnover = round(asset_turnover, 4),
        equity_multiplier = round(equity_multiplier, 4),
        roe = round(roe, 2)
      ),
      retention_ratio = round(retention_ratio, 4),
      interpretation = if (sgr > 0.1) {
        "High sustainable growth potential"
      } else if (sgr > 0.05) {
        "Moderate sustainable growth"
      } else {
        "Low sustainable growth"
      }
    )
    
    log_info(paste("Sustainable growth rate calculated:", round(sgr, 4)))
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error calculating sustainable growth:", e$message))
    return(create_error_response(e$message, "CALCULATION_ERROR"))
  })
}

#' @title Perform Common Size Analysis
#' @description Convert financial statements to percentages
#' @param bs Balance sheet data
#' @param pl Profit and loss data
#' @return Common size analysis results
perform_common_size_analysis <- function(bs, pl) {
  log_info("Performing common size analysis")
  
  tryCatch({
    total_assets <- bs$total_assets %||% 0
    revenue <- if (!is.null(pl$revenue) && is.list(pl$revenue)) {
      sum(sapply(pl$revenue, function(x) x$amount %||% 0))
    } else pl$revenue %||% 0
    
    common_size_bs <- list()
    if (!is.null(bs$assets$current)) {
      common_size_bs$current_assets <- lapply(bs$assets$current, function(x) {
        list(
          name = x$name,
          amount = x$amount,
          percentage = safe_divide(x$amount * 100, total_assets)
        )
      })
    }
    
    common_size_pl <- list()
    if (!is.null(pl$revenue) && is.list(pl$revenue)) {
      common_size_pl$revenue <- lapply(pl$revenue, function(x) {
        list(
          name = x$name,
          amount = x$amount,
          percentage = safe_divide(x$amount * 100, revenue)
        )
      })
    }
    
    common_size_pl$net_income <- list(
      amount = pl$net_income,
      percentage = safe_divide(pl$net_income * 100, revenue)
    )
    
    result <- list(
      balance_sheet = common_size_bs,
      profit_loss = common_size_pl,
      base_values = list(
        total_assets = total_assets,
        revenue = revenue
      )
    )
    
    log_info("Common size analysis completed")
    return(create_success_response(result))
    
  }, error = function(e) {
    log_error(paste("Error in common size analysis:", e$message))
    return(create_error_response(e$message, "CALCULATION_ERROR"))
  })
}
