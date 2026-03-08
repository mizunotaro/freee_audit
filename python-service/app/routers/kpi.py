from fastapi import APIRouter, HTTPException

from app.models.requests import KPICalculationRequest
from app.services.kpi_calculator import KPICalculator


router = APIRouter()


@router.post("/calculate")
async def calculate_kpis(request: KPICalculationRequest):
    """
    Calculate comprehensive financial KPIs.
    
    Returns:
    - Profitability KPIs (ROE, ROA, margins)
    - Efficiency KPIs (turnover ratios)
    - Safety KPIs (liquidity, leverage)
    - Growth KPIs (revenue, profit growth)
    - Cash Flow KPIs (FCF, FCF margin)
    """
    calculator = KPICalculator()
    
    kpis = calculator.calculate_all_kpis(
        bs=request.balance_sheet,
        pl=request.profit_loss,
        cf=request.cash_flow,
        previous_pl=request.previous_profit_loss,
    )
    
    return {
        "kpis": kpis,
        "calculation_metadata": {
            "standard": request.standard.value,
            "precision": "decimal",
        },
    }


@router.post("/profitability")
async def calculate_profitability_kpis(request: KPICalculationRequest):
    """Calculate profitability KPIs only."""
    calculator = KPICalculator()
    return calculator.calculate_profitability_kpis(request.balance_sheet, request.profit_loss)


@router.post("/efficiency")
async def calculate_efficiency_kpis(request: KPICalculationRequest):
    """Calculate efficiency KPIs only."""
    calculator = KPICalculator()
    return calculator.calculate_efficiency_kpis(request.balance_sheet, request.profit_loss)


@router.post("/safety")
async def calculate_safety_kpis(request: KPICalculationRequest):
    """Calculate safety KPIs only."""
    calculator = KPICalculator()
    return calculator.calculate_safety_kpis(request.balance_sheet)


@router.post("/growth")
async def calculate_growth_kpis(request: KPICalculationRequest):
    """Calculate growth KPIs only."""
    calculator = KPICalculator()
    return calculator.calculate_growth_kpis(request.profit_loss, request.previous_profit_loss)
