# Financial Calculation Service

High-precision financial calculations using NumPy/Pandas/SciPy.

## Features

- **Cash Flow Calculation**: Supports JGAAP, USGAAP, and IFRS standards
- **KPI Calculation**: Comprehensive financial KPIs (profitability, efficiency, safety, growth)
- **Statistical Analysis**: Linear regression, time series decomposition, forecasting
- **Validation**: Financial statement consistency checks

## Architecture

```
┌──────────────────┐     HTTP/gRPC      ┌─────────────────────┐
│   Next.js API    │ ─────────────────→ │  Python FastAPI     │
│   (TypeScript)   │ ←───────────────── │  (NumPy/Pandas)     │
└──────────────────┘                    └─────────────────────┘
```

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the Service

```bash
# Development mode
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Cash Flow

- `POST /api/v1/cashflow/calculate` - Calculate cash flow statement
- `POST /api/v1/cashflow/validate` - Validate existing cash flow

### KPI

- `POST /api/v1/kpi/calculate` - Calculate all KPIs
- `POST /api/v1/kpi/profitability` - Profitability KPIs
- `POST /api/v1/kpi/efficiency` - Efficiency KPIs
- `POST /api/v1/kpi/safety` - Safety KPIs
- `POST /api/v1/kpi/growth` - Growth KPIs

### Statistics

- `POST /api/v1/statistics/regression` - Linear regression
- `POST /api/v1/statistics/decomposition` - Time series decomposition
- `POST /api/v1/statistics/forecast` - Holt-Winters forecasting
- `POST /api/v1/statistics/anomalies` - Anomaly detection
- `POST /api/v1/statistics/confidence-interval` - Confidence intervals
- `POST /api/v1/statistics/descriptive` - Descriptive statistics

### Validation

- `POST /api/v1/validation/cashflow` - Validate cash flow
- `POST /api/v1/validation/balance-sheet` - Validate balance sheet
- `POST /api/v1/validation/full` - Full financial validation

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_cashflow.py -v
```

## Docker

```bash
# Build image
docker build -t financial-calculation-service .

# Run container
docker run -p 8000:8000 financial-calculation-service
```

## Accounting Standards Support

| Standard | Interest Classification | Deferred Tax |
|----------|------------------------|--------------|
| JGAAP | Non-operating | Balance Sheet |
| USGAAP | Operating | Balance Sheet |
| IFRS | Financing | Balance Sheet |

## Precision

- Uses Python's `Decimal` type for financial calculations
- Avoids floating-point errors in monetary amounts
- Configurable precision (default: 28 digits)

## License

MIT
