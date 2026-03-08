#* @apiTitle Financial Statistical Analysis Service
#* @apiDescription R-based statistical analysis for financial data
#* @apiVersion 1.0.0

#* Echo serializer
#* @serializer json list(auto_unbox = TRUE, digits = 10)

# Load dependencies
source("R/packages.R")
source("R/helpers.R")
source("R/financial_analysis.R")
source("R/statistical_tests.R")
source("R/time_series.R")
source("R/international.R")

#* Health check
#* @get /health
#* @serializer json
function() {
  list(
    status = "healthy",
    service = "r-statistical-analysis",
    version = "1.0.0",
    timestamp = Sys.time()
  )
}

#* Get service info
#* @get /api/v1/info
#* @serializer json
function() {
  list(
    name = "R Statistical Analysis Service",
    version = "1.0.0",
    endpoints = list(
      "/api/v1/ratios - Calculate financial ratios",
      "/api/v1/zscore - Calculate Altman Z-Score",
      "/api/v1/sustainable-growth - Calculate sustainable growth rate",
      "/api/v1/common-size - Perform common size analysis",
      "/api/v1/tests/normality - Test for normality",
      "/api/v1/analysis/trend - Analyze trends",
      "/api/v1/analysis/compare - Compare two periods",
      "/api/v1/analysis/correlation - Correlation analysis",
      "/api/v1/analysis/regression - Regression analysis",
      "/api/v1/forecast/arima - ARIMA forecasting",
      "/api/v1/forecast/ets - ETS forecasting",
      "/api/v1/analysis/decompose - Seasonal decomposition",
      "/api/v1/analysis/changepoints - Change point detection",
      "/api/v1/analysis/unit-root - Unit root tests",
      "/api/v1/analysis/moving-averages - Moving averages",
      "/api/v1/international/currency - Currency conversion",
      "/api/v1/international/ifrs-to-jgaap - IFRS to JGAAP conversion",
      "/api/v1/international/jgaap-to-ifrs - JGAAP to IFRS conversion",
      "/api/v1/international/inflation - Inflation adjustment",
      "/api/v1/international/segments - Segment analysis"
    ),
    r_version = R.version.string
  )
}

#* Calculate financial ratios
#* @param bs:object Balance sheet data
#* @param pl:object Profit and loss data
#* @param industry_code:string Industry code (optional)
#* @post /api/v1/ratios
#* @serializer json
function(bs, pl, industry_code = NULL) {
  calculate_financial_ratios(bs, pl, industry_code)
}

#* Calculate Altman Z-Score
#* @param bs:object Balance sheet data
#* @param pl:object Profit and loss data
#* @post /api/v1/zscore
#* @serializer json
function(bs, pl) {
  calculate_altman_zscore(bs, pl)
}

#* Calculate sustainable growth rate
#* @param bs:object Balance sheet data
#* @param pl:object Profit and loss data
#* @post /api/v1/sustainable-growth
#* @serializer json
function(bs, pl) {
  calculate_sustainable_growth(bs, pl)
}

#* Perform common size analysis
#* @param bs:object Balance sheet data
#* @param pl:object Profit and loss data
#* @post /api/v1/common-size
#* @serializer json
function(bs, pl) {
  perform_common_size_analysis(bs, pl)
}

#* Test normality
#* @param data:numeric[] Data array
#* @post /api/v1/tests/normality
#* @serializer json
function(data) {
  test_normality(data)
}

#* Analyze trend
#* @param time_series:numeric[] Time series data
#* @param dates:string[] Optional dates
#* @post /api/v1/analysis/trend
#* @serializer json
function(time_series, dates = NULL) {
  analyze_trend(time_series, dates)
}

#* Compare two periods
#* @param period1:numeric[] First period data
#* @param period2:numeric[] Second period data
#* @post /api/v1/analysis/compare
#* @serializer json
function(period1, period2) {
  compare_periods(period1, period2)
}

#* Correlation analysis
#* @param data:object Data matrix or list of vectors
#* @param method:string Correlation method (pearson, spearman, kendall)
#* @post /api/v1/analysis/correlation
#* @serializer json
function(data, method = "pearson") {
  analyze_correlation(data, method)
}

#* Regression analysis
#* @param y:numeric[] Dependent variable
#* @param x:object Independent variable(s)
#* @post /api/v1/analysis/regression
#* @serializer json
function(y, x) {
  perform_regression(y, x)
}

#* Forecast with ARIMA
#* @param data:numeric[] Historical data
#* @param horizon:int Forecast horizon
#* @param frequency:int Time series frequency (default 12)
#* @post /api/v1/forecast/arima
#* @serializer json
function(data, horizon = 12, frequency = 12) {
  forecast_arima(data, horizon, frequency)
}

#* Forecast with ETS
#* @param data:numeric[] Historical data
#* @param horizon:int Forecast horizon
#* @param frequency:int Time series frequency (default 12)
#* @post /api/v1/forecast/ets
#* @serializer json
function(data, horizon = 12, frequency = 12) {
  forecast_ets(data, horizon, frequency)
}

#* Decompose seasonal
#* @param data:numeric[] Time series data
#* @param frequency:int Seasonal frequency
#* @post /api/v1/analysis/decompose
#* @serializer json
function(data, frequency = 12) {
  decompose_seasonal(data, frequency)
}

#* Detect change points
#* @param data:numeric[] Time series data
#* @param method:string Detection method (PELT, BinSeg, SegNeigh)
#* @post /api/v1/analysis/changepoints
#* @serializer json
function(data, method = "PELT") {
  detect_changepoints(data, method)
}

#* Unit root tests
#* @param data:numeric[] Time series data
#* @post /api/v1/analysis/unit-root
#* @serializer json
function(data) {
  test_unit_root(data)
}

#* Calculate moving averages
#* @param data:numeric[] Time series data
#* @param windows:int[] Window sizes
#* @post /api/v1/analysis/moving-averages
#* @serializer json
function(data, windows = c(3, 6, 12)) {
  calculate_moving_averages(data, windows)
}

#* Currency conversion
#* @param amount:double Amount to convert
#* @param from:string Source currency
#* @param to:string Target currency
#* @param rate:double Exchange rate (optional)
#* @post /api/v1/international/currency
#* @serializer json
function(amount, from, to, rate = NULL) {
  convert_currency(amount, from, to, rate)
}

#* IFRS to JGAAP conversion
#* @param data:object IFRS format financial data
#* @post /api/v1/international/ifrs-to-jgaap
#* @serializer json
function(data) {
  convert_ifrs_to_jgaap(data)
}

#* JGAAP to IFRS conversion
#* @param data:object JGAAP format financial data
#* @post /api/v1/international/jgaap-to-ifrs
#* @serializer json
function(data) {
  convert_jgaap_to_ifrs(data)
}

#* Inflation adjustment
#* @param data:object Financial data
#* @param base_year:int Base year
#* @param current_year:int Current year
#* @param cpi_index:object CPI index values (optional)
#* @post /api/v1/international/inflation
#* @serializer json
function(data, base_year, current_year, cpi_index = NULL) {
  adjust_for_inflation(data, base_year, current_year, cpi_index)
}

#* Segment analysis
#* @param segments:object Segment data
#* @post /api/v1/international/segments
#* @serializer json
function(segments) {
  analyze_segments(segments)
}
