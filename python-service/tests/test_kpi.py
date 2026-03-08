import pytest

from app.services.kpi_calculator import KPICalculator
from app.models.financial import (
    BalanceSheet,
    ProfitLoss,
    CashFlowStatement,
    OperatingActivities,
    InvestingActivities,
    FinancingActivities,
    BalanceSheetItem,
    ProfitLossItem,
    Assets,
    Liabilities,
    Equity,
)


@pytest.fixture
def sample_balance_sheet():
    return BalanceSheet(
        fiscal_year=2024,
        month=12,
        assets=Assets(
            current=[
                BalanceSheetItem(name="現金預金", amount=10_000_000),
                BalanceSheetItem(name="売掛金", amount=5_000_000),
                BalanceSheetItem(name="棚卸資産", amount=3_000_000),
            ],
            fixed=[
                BalanceSheetItem(name="有形固定資産", amount=20_000_000),
            ],
            total=38_000_000,
        ),
        liabilities=Liabilities(
            current=[
                BalanceSheetItem(name="買掛金", amount=4_000_000),
            ],
            fixed=[],
            total=4_000_000,
        ),
        equity=Equity(
            items=[BalanceSheetItem(name="資本金", amount=34_000_000)],
            total=34_000_000,
        ),
        total_assets=38_000_000,
        total_liabilities=4_000_000,
        total_equity=34_000_000,
    )


@pytest.fixture
def sample_profit_loss():
    return ProfitLoss(
        fiscal_year=2024,
        month=12,
        revenue=[ProfitLossItem(name="売上高", amount=100_000_000)],
        cost_of_sales=[ProfitLossItem(name="売上原価", amount=60_000_000)],
        gross_profit=40_000_000,
        gross_profit_margin=40.0,
        operating_income=14_000_000,
        operating_margin=14.0,
        net_income=10_700_000,
        depreciation=3_000_000,
        sga_expenses=[],
        non_operating_income=[],
        non_operating_expenses=[],
    )


@pytest.fixture
def sample_previous_profit_loss():
    return ProfitLoss(
        fiscal_year=2023,
        month=12,
        revenue=[ProfitLossItem(name="売上高", amount=80_000_000)],
        cost_of_sales=[ProfitLossItem(name="売上原価", amount=50_000_000)],
        gross_profit=30_000_000,
        gross_profit_margin=37.5,
        operating_income=10_000_000,
        operating_margin=12.5,
        net_income=7_000_000,
        depreciation=2_500_000,
        sga_expenses=[],
        non_operating_income=[],
        non_operating_expenses=[],
    )


@pytest.fixture
def sample_cash_flow():
    return CashFlowStatement(
        fiscal_year=2024,
        month=12,
        operating_activities=OperatingActivities(
            net_income=10_700_000,
            depreciation=3_000_000,
            amortization=0,
            deferred_tax_change=0,
            increase_in_receivables=-1_000_000,
            decrease_in_inventory=-500_000,
            increase_in_payables=1_000_000,
            other_non_cash=0,
            net_cash_from_operating=13_200_000,
        ),
        investing_activities=InvestingActivities(
            purchase_of_fixed_assets=-2_000_000,
            sale_of_fixed_assets=0,
            net_cash_from_investing=-2_000_000,
        ),
        financing_activities=FinancingActivities(
            proceeds_from_borrowing=0,
            repayment_of_borrowing=0,
            dividend_paid=0,
            interest_paid=0,
            net_cash_from_financing=0,
        ),
        net_change_in_cash=11_200_000,
        beginning_cash=8_000_000,
        ending_cash=19_200_000,
    )


class TestKPICalculator:
    def test_profitability_kpis(self, sample_balance_sheet, sample_profit_loss):
        """Test profitability KPI calculation."""
        calculator = KPICalculator()
        kpis = calculator.calculate_profitability_kpis(sample_balance_sheet, sample_profit_loss)
        
        assert "roe" in kpis
        assert "roa" in kpis
        assert "gross_profit_margin" in kpis
        assert "operating_margin" in kpis
        assert "ebitda_margin" in kpis
        
        assert round(kpis["gross_profit_margin"], 1) == 40.0
        assert round(kpis["operating_margin"], 1) == 14.0
    
    def test_efficiency_kpis(self, sample_balance_sheet, sample_profit_loss):
        """Test efficiency KPI calculation."""
        calculator = KPICalculator()
        kpis = calculator.calculate_efficiency_kpis(sample_balance_sheet, sample_profit_loss)
        
        assert "asset_turnover" in kpis
        assert "inventory_turnover" in kpis
        assert "receivables_turnover" in kpis
        assert "payables_turnover" in kpis
    
    def test_safety_kpis(self, sample_balance_sheet):
        """Test safety KPI calculation."""
        calculator = KPICalculator()
        kpis = calculator.calculate_safety_kpis(sample_balance_sheet)
        
        assert "current_ratio" in kpis
        assert "quick_ratio" in kpis
        assert "debt_to_equity" in kpis
        assert "equity_ratio" in kpis
    
    def test_growth_kpis_with_previous(self, sample_profit_loss, sample_previous_profit_loss):
        """Test growth KPI calculation with previous period."""
        calculator = KPICalculator()
        kpis = calculator.calculate_growth_kpis(sample_profit_loss, sample_previous_profit_loss)
        
        assert "revenue_growth" in kpis
        assert "profit_growth" in kpis
        
        assert round(kpis["revenue_growth"], 1) == 25.0
    
    def test_growth_kpis_without_previous(self, sample_profit_loss):
        """Test growth KPI calculation without previous period."""
        calculator = KPICalculator()
        kpis = calculator.calculate_growth_kpis(sample_profit_loss, None)
        
        assert kpis["revenue_growth"] == 0.0
        assert kpis["profit_growth"] == 0.0
    
    def test_cashflow_kpis(self, sample_profit_loss, sample_cash_flow):
        """Test cash flow KPI calculation."""
        calculator = KPICalculator()
        kpis = calculator.calculate_cashflow_kpis(sample_profit_loss, sample_cash_flow)
        
        assert "fcf" in kpis
        assert "fcf_margin" in kpis
        
        assert kpis["fcf"] == 11_200_000
    
    def test_all_kpis(self, sample_balance_sheet, sample_profit_loss, sample_cash_flow, sample_previous_profit_loss):
        """Test comprehensive KPI calculation."""
        calculator = KPICalculator()
        kpis = calculator.calculate_all_kpis(
            bs=sample_balance_sheet,
            pl=sample_profit_loss,
            cf=sample_cash_flow,
            previous_pl=sample_previous_profit_loss,
        )
        
        assert "profitability" in kpis
        assert "efficiency" in kpis
        assert "safety" in kpis
        assert "growth" in kpis
        assert "cash_flow" in kpis
        
        assert kpis["fiscal_year"] == 2024
        assert kpis["month"] == 12
    
    def test_division_by_zero_handling(self):
        """Test handling of division by zero."""
        calculator = KPICalculator()
        
        zero_equity_bs = BalanceSheet(
            fiscal_year=2024,
            month=12,
            assets=Assets(
                current=[BalanceSheetItem(name="現金", amount=1_000_000)],
                fixed=[],
                total=1_000_000,
            ),
            liabilities=Liabilities(
                current=[BalanceSheetItem(name="借入金", amount=1_000_000)],
                fixed=[],
                total=1_000_000,
            ),
            equity=Equity(
                items=[],
                total=0,
            ),
            total_assets=1_000_000,
            total_liabilities=1_000_000,
            total_equity=0,
        )
        
        zero_revenue_pl = ProfitLoss(
            fiscal_year=2024,
            month=12,
            revenue=[],
            cost_of_sales=[],
            gross_profit=0,
            gross_profit_margin=0,
            operating_income=0,
            operating_margin=0,
            net_income=0,
            depreciation=0,
            sga_expenses=[],
            non_operating_income=[],
            non_operating_expenses=[],
        )
        
        kpis = calculator.calculate_profitability_kpis(zero_equity_bs, zero_revenue_pl)
        
        assert kpis["roe"] == 0.0
        assert kpis["roa"] == 0.0
