import pytest
import numpy as np

from app.services.statistical_analysis import StatisticalAnalyzer


class TestStatisticalAnalyzer:
    @pytest.fixture
    def analyzer(self):
        return StatisticalAnalyzer()
    
    def test_linear_regression(self, analyzer):
        """Test linear regression analysis."""
        x = np.array([1, 2, 3, 4, 5])
        y = np.array([2, 4, 6, 8, 10])
        
        result = analyzer.linear_regression(x, y, confidence=0.95)
        
        assert result.slope == pytest.approx(2.0, rel=0.01)
        assert result.intercept == pytest.approx(0.0, abs=0.01)
        assert result.r_squared == pytest.approx(1.0, rel=0.01)
        assert result.p_value < 0.05
    
    def test_linear_regression_with_noise(self, analyzer):
        """Test linear regression with noisy data."""
        np.random.seed(42)
        x = np.linspace(0, 10, 50)
        y = 2 * x + 1 + np.random.normal(0, 0.5, 50)
        
        result = analyzer.linear_regression(x, y, confidence=0.95)
        
        assert result.slope == pytest.approx(2.0, rel=0.1)
        assert result.intercept == pytest.approx(1.0, abs=0.5)
        assert result.r_squared > 0.9
    
    def test_confidence_interval(self, analyzer):
        """Test confidence interval calculation."""
        data = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28]
        
        lower, upper = analyzer.calculate_confidence_interval(data, confidence=0.95)
        
        mean = sum(data) / len(data)
        assert lower < mean < upper
        assert upper - lower > 0
    
    def test_anomaly_detection_iqr(self, analyzer):
        """Test anomaly detection using IQR method."""
        data = [10, 12, 14, 15, 16, 17, 18, 19, 20, 100]
        
        anomalies = analyzer.detect_anomalies(data, method="iqr", threshold=1.5)
        
        assert len(anomalies) >= 1
        assert any(a["value"] == 100 for a in anomalies)
    
    def test_anomaly_detection_zscore(self, analyzer):
        """Test anomaly detection using Z-score method."""
        data = [10, 12, 14, 15, 16, 17, 18, 19, 20, 100]
        
        anomalies = analyzer.detect_anomalies(data, method="zscore", threshold=2.0)
        
        assert len(anomalies) >= 1
    
    def test_anomaly_detection_no_anomalies(self, analyzer):
        """Test anomaly detection with no anomalies."""
        data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
        
        anomalies = analyzer.detect_anomalies(data, method="iqr", threshold=1.5)
        
        assert len(anomalies) == 0
    
    def test_time_series_decomposition(self, analyzer):
        """Test time series decomposition."""
        np.random.seed(42)
        t = np.linspace(0, 4 * np.pi, 48)
        trend = t * 2
        seasonal = 5 * np.sin(t)
        noise = np.random.normal(0, 0.5, 48)
        data = (trend + seasonal + noise).tolist()
        
        result = analyzer.time_series_decomposition(data, period=12, model="additive")
        
        assert len(result.trend) == len(data)
        assert len(result.seasonal) == len(data)
        assert len(result.residual) == len(data)
    
    def test_time_series_decomposition_insufficient_data(self, analyzer):
        """Test time series decomposition with insufficient data."""
        data = [1, 2, 3, 4, 5]
        
        with pytest.raises(ValueError):
            analyzer.time_series_decomposition(data, period=12)
    
    def test_forecast_holt_winters(self, analyzer):
        """Test Holt-Winters forecasting."""
        np.random.seed(42)
        t = np.linspace(0, 4 * np.pi, 36)
        trend = t * 2
        seasonal = 5 * np.sin(t)
        noise = np.random.normal(0, 0.5, 36)
        data = (trend + seasonal + noise).tolist()
        
        result = analyzer.forecast_holt_winters(
            data,
            periods=12,
            confidence=0.95,
            seasonal_periods=12,
        )
        
        assert len(result.values) == 12
        assert len(result.lower_bound) == 12
        assert len(result.upper_bound) == 12
        assert result.confidence_level == 0.95
        
        for i in range(12):
            assert result.lower_bound[i] < result.values[i] < result.upper_bound[i]
    
    def test_calculate_financial_benchmarks(self, analyzer):
        """Test financial benchmark calculation."""
        data = {
            "roe": [10.0, 12.0, 15.0, 18.0, 20.0],
            "roa": [5.0, 6.0, 7.0, 8.0, 9.0],
        }
        
        result = analyzer.calculate_financial_benchmarks(data, industry_code="MFG")
        
        assert "roe" in result
        assert "roa" in result
        
        assert result["roe"]["min"] == 10.0
        assert result["roe"]["max"] == 20.0
        assert result["roe"]["median"] == 15.0
    
    def test_descriptive_stats(self, analyzer):
        """Test descriptive statistics calculation."""
        data = [10, 20, 30, 40, 50]
        
        stats = analyzer.calculate_descriptive_stats(data)
        
        assert stats["count"] == 5
        assert stats["mean"] == 30.0
        assert stats["median"] == 30.0
        assert stats["min"] == 10
        assert stats["max"] == 50
        assert "std" in stats
        assert "skewness" in stats
        assert "kurtosis" in stats
