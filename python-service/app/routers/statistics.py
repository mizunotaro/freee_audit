from fastapi import APIRouter, HTTPException

from app.models.requests import (
    LinearRegressionRequest,
    TimeSeriesDecompositionRequest,
    ForecastRequest,
    AnomalyDetectionRequest,
)
from app.services.statistical_analysis import StatisticalAnalyzer
import numpy as np


router = APIRouter()


@router.post("/regression")
async def linear_regression(request: LinearRegressionRequest):
    """
    Perform linear regression analysis.
    
    Returns slope, intercept, R-squared, p-value, and confidence intervals.
    """
    if len(request.x) != len(request.y):
        raise HTTPException(status_code=400, detail="x and y must have the same length")
    
    analyzer = StatisticalAnalyzer()
    x = np.array(request.x)
    y = np.array(request.y)
    
    result = analyzer.linear_regression(x, y, request.confidence)
    
    return {
        "slope": result.slope,
        "intercept": result.intercept,
        "r_squared": result.r_squared,
        "p_value": result.p_value,
        "confidence_interval": result.confidence_interval,
        "standard_error": result.standard_error,
    }


@router.post("/decomposition")
async def time_series_decomposition(request: TimeSeriesDecompositionRequest):
    """
    Decompose time series into trend, seasonal, and residual components.
    """
    analyzer = StatisticalAnalyzer()
    
    try:
        result = analyzer.time_series_decomposition(
            data=request.data,
            period=request.period,
            model=request.model,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {
        "trend": result.trend,
        "seasonal": result.seasonal,
        "residual": result.residual,
    }


@router.post("/forecast")
async def forecast(request: ForecastRequest):
    """
    Forecast future values using Holt-Winters exponential smoothing.
    
    Returns forecasted values with confidence intervals.
    """
    analyzer = StatisticalAnalyzer()
    
    result = analyzer.forecast_holt_winters(
        data=request.data,
        periods=request.periods,
        confidence=request.confidence,
        seasonal_periods=request.seasonal_periods,
    )
    
    return {
        "values": result.values,
        "lower_bound": result.lower_bound,
        "upper_bound": result.upper_bound,
        "confidence_level": result.confidence_level,
    }


@router.post("/anomalies")
async def detect_anomalies(request: AnomalyDetectionRequest):
    """
    Detect anomalies in financial data using IQR or Z-score method.
    """
    analyzer = StatisticalAnalyzer()
    
    anomalies = analyzer.detect_anomalies(
        data=request.data,
        method=request.method,
        threshold=request.threshold,
    )
    
    return {
        "anomalies": anomalies,
        "total_anomalies": len(anomalies),
        "method": request.method,
        "threshold": request.threshold,
    }


@router.post("/confidence-interval")
async def calculate_confidence_interval(data: list[float], confidence: float = 0.95):
    """Calculate confidence interval for a dataset."""
    analyzer = StatisticalAnalyzer()
    lower, upper = analyzer.calculate_confidence_interval(data, confidence)
    
    return {
        "lower_bound": lower,
        "upper_bound": upper,
        "confidence_level": confidence,
    }


@router.post("/descriptive")
async def calculate_descriptive_stats(data: list[float]):
    """Calculate descriptive statistics for a dataset."""
    analyzer = StatisticalAnalyzer()
    stats = analyzer.calculate_descriptive_stats(data)
    return stats
