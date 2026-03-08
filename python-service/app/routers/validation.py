from fastapi import APIRouter, HTTPException

from app.models.requests import ValidationRequest
from app.services.cashflow_calculator import CashFlowCalculator
from app.services.kpi_calculator import KPICalculator


router = APIRouter()


@router.post("/cashflow")
async def validate_cashflow(request: ValidationRequest):
    """
    Validate cash flow statement consistency.
    
    Checks:
    - Operating CF components match total
    - Cash reconciliation (beginning + change = ending)
    """
    calculator = CashFlowCalculator(request.standard)
    
    validation = calculator.validate_calculation(request.cash_flow)
    
    return validation


@router.post("/balance-sheet")
async def validate_balance_sheet(request: ValidationRequest):
    """
    Validate balance sheet consistency.
    
    Checks:
    - Assets = Liabilities + Equity
    - Sub-totals match item sums
    """
    bs = request.balance_sheet
    
    issues = []
    
    calculated_total_assets = (
        sum(item.amount for item in bs.assets.current) +
        sum(item.amount for item in bs.assets.fixed)
    )
    if abs(calculated_total_assets - bs.total_assets) > 0.01:
        issues.append({
            "type": "total_assets_mismatch",
            "severity": "error",
            "expected": calculated_total_assets,
            "actual": bs.total_assets,
            "difference": calculated_total_assets - bs.total_assets,
        })
    
    calculated_total_liabilities = (
        sum(item.amount for item in bs.liabilities.current) +
        sum(item.amount for item in bs.liabilities.fixed)
    )
    if abs(calculated_total_liabilities - bs.total_liabilities) > 0.01:
        issues.append({
            "type": "total_liabilities_mismatch",
            "severity": "error",
            "expected": calculated_total_liabilities,
            "actual": bs.total_liabilities,
        })
    
    if abs(bs.total_assets - (bs.total_liabilities + bs.total_equity)) > 0.01:
        issues.append({
            "type": "balance_sheet_equation_error",
            "severity": "error",
            "message": "Assets != Liabilities + Equity",
            "assets": bs.total_assets,
            "liabilities_plus_equity": bs.total_liabilities + bs.total_equity,
        })
    
    return {
        "is_valid": len([i for i in issues if i["severity"] == "error"]) == 0,
        "issues": issues,
    }


@router.post("/full")
async def validate_full_financials(request: ValidationRequest):
    """
    Perform comprehensive validation of all financial statements.
    """
    results = {}
    
    cf_calculator = CashFlowCalculator(request.standard)
    results["cash_flow"] = cf_calculator.validate_calculation(request.cash_flow)
    
    bs_validation = await validate_balance_sheet(request)
    results["balance_sheet"] = bs_validation
    
    all_issues = []
    for section, result in results.items():
        if isinstance(result, dict) and "issues" in result:
            all_issues.extend(result.get("issues", []))
    
    return {
        "is_valid": len([i for i in all_issues if i.get("severity") == "error"]) == 0,
        "results": results,
        "total_issues": len(all_issues),
        "error_count": len([i for i in all_issues if i.get("severity") == "error"]),
    }
