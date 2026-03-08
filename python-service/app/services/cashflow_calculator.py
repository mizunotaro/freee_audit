from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import numpy as np
from numpy.typing import NDArray

from app.models.financial import (
    BalanceSheet,
    ProfitLoss,
    CashFlowStatement,
    OperatingActivities,
    InvestingActivities,
    FinancingActivities,
    AccountingStandard,
)


class CashFlowCalculator:
    """
    High-precision cash flow calculator supporting multiple accounting standards.
    
    Key features:
    - Uses Decimal for financial amounts (no floating point errors)
    - Supports JGAAP, USGAAP, IFRS
    - Proper handling of interest classification per standard
    - Deferred tax calculation
    """
    
    def __init__(self, standard: AccountingStandard = AccountingStandard.JGAAP):
        self.standard = standard
        self._configure_standard()
    
    def _configure_standard(self) -> None:
        """Configure calculation rules based on accounting standard."""
        interest_config = {
            AccountingStandard.JGAAP: False,
            AccountingStandard.USGAAP: True,
            AccountingStandard.IFRS: False,
        }
        self.interest_as_operating = interest_config[self.standard]
    
    def calculate(
        self,
        pl: ProfitLoss,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet] = None,
    ) -> CashFlowStatement:
        """
        Calculate cash flow statement using indirect method.
        
        Args:
            pl: Profit and Loss statement
            current_bs: Current period balance sheet
            previous_bs: Previous period balance sheet (for period-over-period changes)
        
        Returns:
            CashFlowStatement with all activities calculated
        """
        operating = self._calculate_operating(pl, current_bs, previous_bs)
        investing = self._calculate_investing(current_bs, previous_bs)
        financing = self._calculate_financing(current_bs, previous_bs, pl)
        
        net_change = (
            Decimal(str(operating.net_cash_from_operating)) +
            Decimal(str(investing.net_cash_from_investing)) +
            Decimal(str(financing.net_cash_from_financing))
        )
        
        beginning_cash = self._get_cash(previous_bs) if previous_bs else Decimal("0")
        ending_cash = self._get_cash(current_bs)
        
        return CashFlowStatement(
            fiscal_year=pl.fiscal_year,
            month=pl.month,
            operating_activities=operating,
            investing_activities=investing,
            financing_activities=financing,
            net_change_in_cash=float(net_change),
            beginning_cash=float(beginning_cash),
            ending_cash=float(ending_cash),
        )
    
    def _calculate_operating(
        self,
        pl: ProfitLoss,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
    ) -> OperatingActivities:
        """
        Calculate operating cash flow using indirect method.
        
        Formula:
        Operating CF = Net Income
                     + Depreciation & Amortization
                     + Deferred Tax Change
                     +/- Working Capital Changes
                     + Other Non-Cash Items
                     +/- Interest Adjustment (per standard)
        """
        net_income = Decimal(str(pl.net_income))
        depreciation = Decimal(str(pl.depreciation or 0))
        
        receivables_change = self._calculate_receivables_change(current_bs, previous_bs)
        inventory_change = self._calculate_inventory_change(current_bs, previous_bs)
        payables_change = self._calculate_payables_change(current_bs, previous_bs)
        
        deferred_tax_change = self._calculate_deferred_tax_change(current_bs, previous_bs)
        
        other_non_cash = self._calculate_other_non_cash(current_bs, previous_bs)
        
        interest_adjustment = Decimal("0")
        if not self.interest_as_operating and self.standard == AccountingStandard.IFRS:
            interest_expense = self._get_interest_expense(pl)
            interest_adjustment = interest_expense
        
        net_cash = (
            net_income +
            depreciation +
            deferred_tax_change +
            receivables_change +
            inventory_change +
            payables_change +
            other_non_cash +
            interest_adjustment
        )
        
        return OperatingActivities(
            net_income=float(net_income),
            depreciation=float(depreciation),
            amortization=0.0,
            deferred_tax_change=float(deferred_tax_change),
            increase_in_receivables=float(receivables_change),
            decrease_in_inventory=float(inventory_change),
            increase_in_payables=float(payables_change),
            other_non_cash=float(other_non_cash),
            net_cash_from_operating=float(net_cash),
        )
    
    def _get_cash(self, bs: BalanceSheet) -> Decimal:
        """Extract cash and cash equivalents from balance sheet."""
        total = Decimal("0")
        for item in bs.assets.current:
            if any(keyword in item.name for keyword in ["現金", "預金", "cash", "deposit"]):
                total += Decimal(str(item.amount))
        return total
    
    def _calculate_receivables_change(
        self,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
    ) -> Decimal:
        """
        Calculate change in receivables.
        Increase in receivables = cash outflow (negative adjustment)
        """
        current = self._get_receivables(current_bs)
        previous = self._get_receivables(previous_bs) if previous_bs else Decimal("0")
        return previous - current
    
    def _get_receivables(self, bs: BalanceSheet) -> Decimal:
        """Extract accounts receivable from balance sheet."""
        total = Decimal("0")
        for item in bs.assets.current:
            if any(keyword in item.name for keyword in ["売掛", "受取手形", "receivable"]):
                total += Decimal(str(item.amount))
        return total
    
    def _calculate_inventory_change(
        self,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
    ) -> Decimal:
        """Calculate change in inventory."""
        current = self._get_inventory(current_bs)
        previous = self._get_inventory(previous_bs) if previous_bs else Decimal("0")
        return previous - current
    
    def _get_inventory(self, bs: BalanceSheet) -> Decimal:
        """Extract inventory from balance sheet."""
        total = Decimal("0")
        for item in bs.assets.current:
            if any(keyword in item.name for keyword in ["棚卸", "商品", "製品", "inventory"]):
                total += Decimal(str(item.amount))
        return total
    
    def _calculate_payables_change(
        self,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
    ) -> Decimal:
        """Calculate change in payables."""
        current = self._get_payables(current_bs)
        previous = self._get_payables(previous_bs) if previous_bs else Decimal("0")
        return current - previous
    
    def _get_payables(self, bs: BalanceSheet) -> Decimal:
        """Extract accounts payable from balance sheet."""
        total = Decimal("0")
        for item in bs.liabilities.current:
            if any(keyword in item.name for keyword in ["買掛", "支払手形", "payable"]):
                total += Decimal(str(item.amount))
        return total
    
    def _calculate_deferred_tax_change(
        self,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
    ) -> Decimal:
        """Calculate deferred tax change."""
        current = self._get_deferred_tax(current_bs)
        previous = self._get_deferred_tax(previous_bs) if previous_bs else Decimal("0")
        return previous - current
    
    def _get_deferred_tax(self, bs: BalanceSheet) -> Decimal:
        """Calculate net deferred tax position."""
        deferred_tax_asset = Decimal("0")
        for item in bs.assets.current:
            if "繰延税金資産" in item.name:
                deferred_tax_asset += Decimal(str(item.amount))
        
        deferred_tax_liability = Decimal("0")
        for item in bs.liabilities.current + bs.liabilities.fixed:
            if "繰延税金負債" in item.name:
                deferred_tax_liability += Decimal(str(item.amount))
        
        return deferred_tax_asset - deferred_tax_liability
    
    def _get_interest_expense(self, pl: ProfitLoss) -> Decimal:
        """Extract interest expense from P&L."""
        total = Decimal("0")
        for item in pl.non_operating_expenses:
            if any(keyword in item.name for keyword in ["支払利息", "利息"]):
                total += Decimal(str(item.amount))
        return total
    
    def _calculate_other_non_cash(
        self,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
    ) -> Decimal:
        """Calculate other non-cash adjustments."""
        other = Decimal("0")
        
        current_prepaid = Decimal("0")
        for item in current_bs.assets.current:
            if any(keyword in item.name for keyword in ["前払", "前渡"]):
                current_prepaid += Decimal(str(item.amount))
        
        previous_prepaid = Decimal("0")
        if previous_bs:
            for item in previous_bs.assets.current:
                if any(keyword in item.name for keyword in ["前払", "前渡"]):
                    previous_prepaid += Decimal(str(item.amount))
        
        other -= current_prepaid - previous_prepaid
        
        current_accrued = Decimal("0")
        for item in current_bs.liabilities.current:
            if any(keyword in item.name for keyword in ["未払", "未収"]):
                current_accrued += Decimal(str(item.amount))
        
        previous_accrued = Decimal("0")
        if previous_bs:
            for item in previous_bs.liabilities.current:
                if any(keyword in item.name for keyword in ["未払", "未収"]):
                    previous_accrued += Decimal(str(item.amount))
        
        other += current_accrued - previous_accrued
        
        return other
    
    def _calculate_investing(
        self,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
    ) -> InvestingActivities:
        """Calculate investing cash flow."""
        current_fixed = self._get_fixed_assets(current_bs)
        previous_fixed = self._get_fixed_assets(previous_bs) if previous_bs else Decimal("0")
        
        change = previous_fixed - current_fixed
        purchase = min(Decimal("0"), change)
        sale = max(Decimal("0"), change)
        
        net_cash = -purchase + sale
        
        return InvestingActivities(
            purchase_of_fixed_assets=float(purchase),
            sale_of_fixed_assets=float(sale),
            net_cash_from_investing=float(net_cash),
        )
    
    def _get_fixed_assets(self, bs: BalanceSheet) -> Decimal:
        """Extract total fixed assets."""
        total = Decimal("0")
        for item in bs.assets.fixed:
            total += Decimal(str(item.amount))
        return total
    
    def _calculate_financing(
        self,
        current_bs: BalanceSheet,
        previous_bs: Optional[BalanceSheet],
        pl: ProfitLoss,
    ) -> FinancingActivities:
        """Calculate financing cash flow."""
        current_borrowing = self._get_borrowing(current_bs)
        previous_borrowing = self._get_borrowing(previous_bs) if previous_bs else Decimal("0")
        
        borrowing_change = current_borrowing - previous_borrowing
        proceeds = max(Decimal("0"), borrowing_change)
        repayment = max(Decimal("0"), -borrowing_change)
        
        dividend = Decimal("0")
        
        interest_paid = Decimal("0")
        if not self.interest_as_operating:
            interest_paid = self._get_interest_expense(pl)
        
        net_cash = proceeds - repayment - dividend - interest_paid
        
        return FinancingActivities(
            proceeds_from_borrowing=float(proceeds),
            repayment_of_borrowing=float(repayment),
            dividend_paid=float(dividend),
            interest_paid=float(interest_paid),
            net_cash_from_financing=float(net_cash),
        )
    
    def _get_borrowing(self, bs: BalanceSheet) -> Decimal:
        """Extract total borrowing from balance sheet."""
        total = Decimal("0")
        for item in bs.liabilities.current:
            if any(keyword in item.name for keyword in ["借入金", "短期借入"]):
                total += Decimal(str(item.amount))
        
        for item in bs.liabilities.fixed:
            if any(keyword in item.name for keyword in ["借入金", "長期借入"]):
                total += Decimal(str(item.amount))
        
        return total
    
    def validate_calculation(self, cf: CashFlowStatement) -> dict:
        """
        Validate cash flow calculation consistency.
        
        Returns:
            Dict with validation results including any discrepancies
        """
        issues = []
        
        if cf.operating_activities:
            op = cf.operating_activities
            calculated_op = (
                Decimal(str(op.net_income)) +
                Decimal(str(op.depreciation)) +
                Decimal(str(op.amortization)) +
                Decimal(str(op.deferred_tax_change or 0)) +
                Decimal(str(op.increase_in_receivables)) +
                Decimal(str(op.decrease_in_inventory)) +
                Decimal(str(op.increase_in_payables)) +
                Decimal(str(op.other_non_cash or 0))
            )
            actual_op = Decimal(str(op.net_cash_from_operating))
            
            if abs(calculated_op - actual_op) > Decimal("0.01"):
                issues.append({
                    "type": "operating_cf_mismatch",
                    "severity": "error",
                    "expected": float(calculated_op),
                    "actual": float(actual_op),
                    "difference": float(calculated_op - actual_op),
                })
        
        cash_change = Decimal(str(cf.ending_cash)) - Decimal(str(cf.beginning_cash))
        net_change = Decimal(str(cf.net_change_in_cash))
        
        if abs(cash_change - net_change) > Decimal("0.01"):
            issues.append({
                "type": "cash_reconciliation_error",
                "severity": "error",
                "expected": float(cash_change),
                "actual": float(net_change),
            })
        
        return {
            "is_valid": len([i for i in issues if i["severity"] == "error"]) == 0,
            "issues": issues,
            "standard": self.standard.value,
        }
