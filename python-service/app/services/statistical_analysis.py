from typing import Optional, List, Dict, Any
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.holtwinters import ExponentialSmoothing


@dataclass
class RegressionResult:
    slope: float
    intercept: float
    r_squared: float
    p_value: float
    confidence_interval: tuple[float, float]
    standard_error: float


@dataclass
class TimeSeriesDecomposition:
    trend: List[float]
    seasonal: List[float]
    residual: List[float]


@dataclass
class ForecastResult:
    values: List[float]
    lower_bound: List[float]
    upper_bound: List[float]
    confidence_level: float


class StatisticalAnalyzer:
    """
    Statistical analysis tools for financial data.
    
    Provides:
    - Linear regression with confidence intervals
    - Time series decomposition
    - Forecasting with uncertainty quantification
    - Anomaly detection
    """
    
    def linear_regression(
        self,
        x: NDArray[np.floating],
        y: NDArray[np.floating],
        confidence: float = 0.95,
    ) -> RegressionResult:
        """
        Perform linear regression with confidence intervals.
        
        Args:
            x: Independent variable
            y: Dependent variable
            confidence: Confidence level (default 95%)
        
        Returns:
            RegressionResult with all statistics
        """
        X = sm.add_constant(x)
        model = sm.OLS(y, X).fit()
        
        slope = model.params[1]
        intercept = model.params[0]
        r_squared = model.rsquared
        p_value = model.pvalues[1]
        standard_error = model.bse[1]
        
        alpha = 1 - confidence
        ci = model.conf_int(alpha)
        slope_ci = (float(ci[1, 0]), float(ci[1, 1]))
        
        return RegressionResult(
            slope=float(slope),
            intercept=float(intercept),
            r_squared=float(r_squared),
            p_value=float(p_value),
            confidence_interval=slope_ci,
            standard_error=float(standard_error),
        )
    
    def time_series_decomposition(
        self,
        data: List[float],
        period: int = 12,
        model: str = "additive",
    ) -> TimeSeriesDecomposition:
        """
        Decompose time series into trend, seasonal, and residual components.
        
        Args:
            data: Time series data
            period: Seasonal period (default 12 for monthly)
            model: 'additive' or 'multiplicative'
        
        Returns:
            TimeSeriesDecomposition with components
        """
        series = pd.Series(data)
        
        if len(data) < period * 2:
            raise ValueError(f"Need at least {period * 2} data points for decomposition")
        
        decomposition = seasonal_decompose(series, period=period, model=model)
        
        trend = decomposition.trend.bfill().ffill().tolist()
        seasonal = decomposition.seasonal.tolist()
        residual = decomposition.resid.fillna(0).tolist()
        
        return TimeSeriesDecomposition(
            trend=trend,
            seasonal=seasonal,
            residual=residual,
        )
    
    def forecast_holt_winters(
        self,
        data: List[float],
        periods: int = 12,
        confidence: float = 0.95,
        seasonal_periods: int = 12,
    ) -> ForecastResult:
        """
        Forecast using Holt-Winters exponential smoothing.
        
        Args:
            data: Historical time series data
            periods: Number of periods to forecast
            confidence: Confidence level for prediction intervals
            seasonal_periods: Number of periods in seasonal cycle
        
        Returns:
            ForecastResult with values and confidence bounds
        """
        series = pd.Series(data)
        
        model = ExponentialSmoothing(
            series,
            seasonal_periods=seasonal_periods,
            trend='add',
            seasonal='add',
        ).fit()
        
        forecast = model.forecast(periods)
        
        residuals = model.resid
        se = np.std(residuals)
        z = stats.norm.ppf((1 + confidence) / 2)
        
        values = forecast.tolist()
        lower = (forecast - z * se).tolist()
        upper = (forecast + z * se).tolist()
        
        return ForecastResult(
            values=values,
            lower_bound=lower,
            upper_bound=upper,
            confidence_level=confidence,
        )
    
    def detect_anomalies(
        self,
        data: List[float],
        method: str = "iqr",
        threshold: float = 1.5,
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies in financial data.
        
        Args:
            data: Data to analyze
            method: Detection method ('iqr', 'zscore')
            threshold: Threshold for anomaly detection
        
        Returns:
            List of detected anomalies with indices and values
        """
        arr = np.array(data)
        anomalies = []
        
        if method == "iqr":
            q1, q3 = np.percentile(arr, [25, 75])
            iqr = q3 - q1
            lower = q1 - threshold * iqr
            upper = q3 + threshold * iqr
            
            for i, val in enumerate(arr):
                if val < lower or val > upper:
                    anomalies.append({
                        "index": i,
                        "value": float(val),
                        "type": "low" if val < lower else "high",
                        "threshold": float(lower if val < lower else upper),
                    })
        
        elif method == "zscore":
            mean = np.mean(arr)
            std = np.std(arr)
            
            for i, val in enumerate(arr):
                z = abs((val - mean) / std) if std > 0 else 0
                if z > threshold:
                    anomalies.append({
                        "index": i,
                        "value": float(val),
                        "z_score": float(z),
                        "threshold": float(threshold),
                    })
        
        return anomalies
    
    def calculate_confidence_interval(
        self,
        data: List[float],
        confidence: float = 0.95,
    ) -> tuple[float, float]:
        """
        Calculate confidence interval for mean.
        
        Args:
            data: Sample data
            confidence: Confidence level
        
        Returns:
            Tuple of (lower_bound, upper_bound)
        """
        arr = np.array(data)
        n = len(arr)
        mean = np.mean(arr)
        se = stats.sem(arr)
        h = se * stats.t.ppf((1 + confidence) / 2, n - 1)
        
        return (float(mean - h), float(mean + h))
    
    def calculate_financial_benchmarks(
        self,
        data: Dict[str, List[float]],
        industry_code: str,
    ) -> Dict[str, Any]:
        """
        Calculate industry benchmark percentiles.
        
        Args:
            data: Dict of metric_name -> values
            industry_code: Industry classification code
        
        Returns:
            Dict with percentile rankings and comparisons
        """
        results = {}
        
        for metric, values in data.items():
            arr = np.array(values)
            
            results[metric] = {
                "min": float(np.min(arr)),
                "p25": float(np.percentile(arr, 25)),
                "median": float(np.median(arr)),
                "p75": float(np.percentile(arr, 75)),
                "max": float(np.max(arr)),
                "mean": float(np.mean(arr)),
                "std": float(np.std(arr)),
            }
        
        return results
    
    def calculate_descriptive_stats(
        self,
        data: List[float],
    ) -> Dict[str, float]:
        """Calculate descriptive statistics for a dataset."""
        arr = np.array(data)
        
        return {
            "count": int(len(arr)),
            "mean": float(np.mean(arr)),
            "std": float(np.std(arr)),
            "min": float(np.min(arr)),
            "q25": float(np.percentile(arr, 25)),
            "median": float(np.median(arr)),
            "q75": float(np.percentile(arr, 75)),
            "max": float(np.max(arr)),
            "skewness": float(stats.skew(arr)),
            "kurtosis": float(stats.kurtosis(arr)),
        }
