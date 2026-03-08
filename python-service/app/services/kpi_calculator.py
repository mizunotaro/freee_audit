from typing import Optional
from decimal import Decimal

from app.models.financial import BalanceSheet, ProfitLoss, CashFlowStatement, AccountingStandard


def safe_divide(a: float, b: float) -> float:
    if b == 0:
        return 0.0
    return a / b


def round_to_2(value: float) -> float:
    return round(value * 100) / 100


class KPICalculator:
    """
    Financial KPI Calculator with high precision.
    """
    
    def calculate_profitability_kpis(
        self,
        bs: BalanceSheet,
        pl: ProfitLoss,
    ) -> dict:
        total_assets = bs.total_assets
        equity = bs.total_equity
        revenue = self._get_total_revenue(pl)
        
        roe = safe_divide(pl.net_income, equity) * 100
        roa = safe_divide(pl.net_income, total_assets) * 100
        ros = safe_divide(pl.operating_income, revenue) * 100
        gross_profit_margin = pl.gross_profit_margin
        operating_margin = pl.operating_margin
        ebitda_margin = self._calculate_ebitda_margin(pl)
        
        return {
            "roe": round_to_2(roe),
            "roa": round_to_2(roa),
            "ros": round_to_2(ros),
            "gross_profit_margin": round_to_2(gross_profit_margin),
            "operating_margin": round_to_2(operating_margin),
            "ebitda_margin": round_to_2(ebitda_margin),
        }
    
    def calculate_efficiency_kpis(
        self,
        bs: BalanceSheet,
        pl: ProfitLoss,
    ) -> dict:
        revenue = self._get_total_revenue(pl)
        cost_of_sales = self._get_total_cost_of_sales(pl)
        
        total_assets = bs.total_assets
        inventory = self._get_inventory(bs)
        receivables = self._get_receivables(bs)
        payables = self._get_payables(bs)
        
        asset_turnover = safe_divide(revenue, total_assets)
        inventory_turnover = safe_divide(cost_of_sales, inventory) if inventory > 0 else 0.0
        receivables_turnover = safe_divide(revenue, receivables) if receivables > 0 else 0.0
        payables_turnover = safe_divide(cost_of_sales, payables) if payables > 0 else 0.0
        
        return {
            "asset_turnover": round_to_2(asset_turnover),
            "inventory_turnover": round_to_2(inventory_turnover),
            "receivables_turnover": round_to_2(receivables_turnover),
            "payables_turnover": round_to_2(payables_turnover),
        }
    
    def calculate_safety_kpis(
        self,
        bs: BalanceSheet,
    ) -> dict:
        current_assets = sum(item.amount for item in bs.assets.current)
        current_liabilities = sum(item.amount for item in bs.liabilities.current)
        inventory = self._get_inventory(bs)
        total_liabilities = bs.total_liabilities
        equity = bs.total_equity
        total_assets = bs.total_assets
        
        current_ratio = safe_divide(current_assets, current_liabilities) * 100
        quick_ratio = safe_divide(current_assets - inventory, current_liabilities) * 100
        debt_to_equity = safe_divide(total_liabilities, equity)
        equity_ratio = safe_divide(equity, total_assets) * 100
        
        return {
            "current_ratio": round_to_2(current_ratio),
            "quick_ratio": round_to_2(quick_ratio),
            "debt_to_equity": round_to_2(debt_to_equity),
            "equity_ratio": round_to_2(equity_ratio),
        }
    
    def calculate_growth_kpis(
        self,
        pl: ProfitLoss,
        previous_pl: Optional[ProfitLoss] = None,
    ) -> dict:
        if not previous_pl:
            return {
                "revenue_growth": 0.0,
                "profit_growth": 0.0,
            }
        
        current_revenue = self._get_total_revenue(pl)
        previous_revenue = self._get_total_revenue(previous_pl)
        current_profit = pl.net_income
        previous_profit = previous_pl.net_income
        
        revenue_growth = self._calculate_growth_rate(current_revenue, previous_revenue)
        profit_growth = self._calculate_growth_rate(current_profit, previous_profit)
        
        return {
            "revenue_growth": round_to_2(revenue_growth),
            "profit_growth": round_to_2(profit_growth),
        }
    
    def calculate_cashflow_kpis(
        self,
        pl: ProfitLoss,
        cf: CashFlowStatement,
    ) -> dict:
        fcf = self._calculate_free_cash_flow(cf)
        revenue = self._get_total_revenue(pl)
        fcf_margin = safe_divide(fcf, revenue) * 100
        
        return {
            "fcf": round(fcf),
            "fcf_margin": round_to_2(fcf_margin),
        }
    
    def calculate_all_kpis(
        self,
        bs: BalanceSheet,
        pl: ProfitLoss,
        cf: Optional[CashFlowStatement] = None,
        previous_pl: Optional[ProfitLoss] = None,
    ) -> dict:
        kpis = {
            "fiscal_year": pl.fiscal_year,
            "month": pl.month,
            "profitability": self.calculate_profitability_kpis(bs, pl),
            "efficiency": self.calculate_efficiency_kpis(bs, pl),
            "safety": self.calculate_safety_kpis(bs),
            "growth": self.calculate_growth_kpis(pl, previous_pl),
        }
        
        if cf:
            kpis["cash_flow"] = self.calculate_cashflow_kpis(pl, cf)
        
        return kpis
    
    def _get_total_revenue(self, pl: ProfitLoss) -> float:
        return sum(item.amount for item in pl.revenue)
    
    def _get_total_cost_of_sales(self, pl: ProfitLoss) -> float:
        return sum(item.amount for item in pl.cost_of_sales)
    
    def _get_inventory(self, bs: BalanceSheet) -> float:
        return sum(
            item.amount for item in bs.assets.current
            if any(kw in item.name for kw in ["棚卸", "商品", "製品", "inventory"])
        )
    
    def _get_receivables(self, bs: BalanceSheet) -> float:
        return sum(
            item.amount for item in bs.assets.current
            if any(kw in item.name for kw in ["売掛", "受取手形", "receivable"])
        )
    
    def _get_payables(self, bs: BalanceSheet) -> float:
        return sum(
            item.amount for item in bs.liabilities.current
            if any(kw in item.name for kw in ["買掛", "支払手形", "payable"])
        )
    
    def _calculate_ebitda_margin(self, pl: ProfitLoss) -> float:
        ebitda = pl.operating_income + (pl.depreciation or 0)
        revenue = self._get_total_revenue(pl)
        return safe_divide(ebitda, revenue) * 100
    
    def _calculate_growth_rate(self, current: float, previous: float) -> float:
        if previous == 0:
            return 0.0
        return ((current - previous) / abs(previous)) * 100
    
    def _calculate_free_cash_flow(self, cf: CashFlowStatement) -> float:
        operating = cf.operating_activities.net_cash_from_operating if cf.operating_activities else 0.0
        investing = cf.investing_activities.net_cash_from_investing if cf.investing_activities else 0.0
        return operating + investing
