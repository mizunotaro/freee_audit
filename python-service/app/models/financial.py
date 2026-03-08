from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class BalanceSheetItem(BaseModel):
    name: str
    amount: float
    code: Optional[str] = None


class CurrentAssets(BaseModel):
    current: list[BalanceSheetItem] = Field(default_factory=list)
    total: float = 0.0


class FixedAssets(BaseModel):
    fixed: list[BalanceSheetItem] = Field(default_factory=list)
    total: float = 0.0


class Assets(BaseModel):
    current: list[BalanceSheetItem] = Field(default_factory=list)
    fixed: list[BalanceSheetItem] = Field(default_factory=list)
    total: float = 0.0


class CurrentLiabilities(BaseModel):
    current: list[BalanceSheetItem] = Field(default_factory=list)
    total: float = 0.0


class FixedLiabilities(BaseModel):
    fixed: list[BalanceSheetItem] = Field(default_factory=list)
    total: float = 0.0


class Liabilities(BaseModel):
    current: list[BalanceSheetItem] = Field(default_factory=list)
    fixed: list[BalanceSheetItem] = Field(default_factory=list)
    total: float = 0.0


class Equity(BaseModel):
    items: list[BalanceSheetItem] = Field(default_factory=list)
    total: float = 0.0


class BalanceSheet(BaseModel):
    fiscal_year: int
    month: int
    assets: Assets
    liabilities: Liabilities
    equity: Equity
    total_assets: float
    total_liabilities: float
    total_equity: float


class ProfitLossItem(BaseModel):
    name: str
    amount: float


class ProfitLoss(BaseModel):
    fiscal_year: int
    month: int
    revenue: list[ProfitLossItem] = Field(default_factory=list)
    cost_of_sales: list[ProfitLossItem] = Field(default_factory=list)
    gross_profit: float = 0.0
    gross_profit_margin: float = 0.0
    operating_income: float = 0.0
    operating_margin: float = 0.0
    ordinary_income: float = 0.0
    net_income: float = 0.0
    depreciation: Optional[float] = None
    sga_expenses: list[ProfitLossItem] = Field(default_factory=list)
    non_operating_income: list[ProfitLossItem] = Field(default_factory=list)
    non_operating_expenses: list[ProfitLossItem] = Field(default_factory=list)


class OperatingActivities(BaseModel):
    net_income: float = 0.0
    depreciation: float = 0.0
    amortization: float = 0.0
    deferred_tax_change: float = 0.0
    increase_in_receivables: float = 0.0
    decrease_in_inventory: float = 0.0
    increase_in_payables: float = 0.0
    other_non_cash: float = 0.0
    net_cash_from_operating: float = 0.0


class InvestingActivities(BaseModel):
    purchase_of_fixed_assets: float = 0.0
    sale_of_fixed_assets: float = 0.0
    net_cash_from_investing: float = 0.0


class FinancingActivities(BaseModel):
    proceeds_from_borrowing: float = 0.0
    repayment_of_borrowing: float = 0.0
    dividend_paid: float = 0.0
    interest_paid: float = 0.0
    net_cash_from_financing: float = 0.0


class CashFlowStatement(BaseModel):
    fiscal_year: int
    month: int
    operating_activities: Optional[OperatingActivities] = None
    investing_activities: Optional[InvestingActivities] = None
    financing_activities: Optional[FinancingActivities] = None
    net_change_in_cash: float = 0.0
    beginning_cash: float = 0.0
    ending_cash: float = 0.0


class AccountingStandard(str, Enum):
    JGAAP = "JGAAP"
    USGAAP = "USGAAP"
    IFRS = "IFRS"
