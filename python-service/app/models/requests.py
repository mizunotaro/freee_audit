from pydantic import BaseModel, Field
from typing import Optional
from app.models.financial import (
    BalanceSheet,
    ProfitLoss,
    CashFlowStatement,
    AccountingStandard,
)


class CashFlowRequest(BaseModel):
    standard: AccountingStandard = AccountingStandard.JGAAP
    profit_loss: ProfitLoss
    current_balance_sheet: BalanceSheet
    previous_balance_sheet: Optional[BalanceSheet] = None


class CashFlowResponse(BaseModel):
    cash_flow: CashFlowStatement
    validation: dict
    calculation_metadata: dict


class KPICalculationRequest(BaseModel):
    balance_sheet: BalanceSheet
    profit_loss: ProfitLoss
    cash_flow: Optional[CashFlowStatement] = None
    previous_profit_loss: Optional[ProfitLoss] = None
    standard: AccountingStandard = AccountingStandard.JGAAP


class LinearRegressionRequest(BaseModel):
    x: list[float] = Field(..., min_length=2)
    y: list[float] = Field(..., min_length=2)
    confidence: float = Field(0.95, ge=0.0, le=1.0)


class TimeSeriesDecompositionRequest(BaseModel):
    data: list[float] = Field(..., min_length=24)
    period: int = Field(12, ge=2)
    model: str = Field("additive", pattern="^(additive|multiplicative)$")


class ForecastRequest(BaseModel):
    data: list[float] = Field(..., min_length=24)
    periods: int = Field(12, ge=1, le=60)
    confidence: float = Field(0.95, ge=0.0, le=1.0)
    seasonal_periods: int = Field(12, ge=2)


class AnomalyDetectionRequest(BaseModel):
    data: list[float] = Field(..., min_length=5)
    method: str = Field("iqr", pattern="^(iqr|zscore)$")
    threshold: float = Field(1.5, ge=0.0)


class ValidationRequest(BaseModel):
    cash_flow: CashFlowStatement
    balance_sheet: BalanceSheet
    profit_loss: ProfitLoss
    standard: AccountingStandard = AccountingStandard.JGAAP
