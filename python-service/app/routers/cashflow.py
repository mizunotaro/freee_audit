from fastapi import APIRouter, HTTPException

from app.models.requests import CashFlowRequest, CashFlowResponse
from app.models.financial import CashFlowStatement, AccountingStandard
from app.services.cashflow_calculator import CashFlowCalculator


router = APIRouter()


@router.post("/calculate", response_model=CashFlowResponse)
async def calculate_cash_flow(request: CashFlowRequest):
    """
    Calculate cash flow statement with high precision.
    
    - Supports JGAAP, USGAAP, IFRS
    - Uses Decimal for financial calculations
    - Returns validation results
    """
    calculator = CashFlowCalculator(request.standard)
    
    cf = calculator.calculate(
        pl=request.profit_loss,
        current_bs=request.current_balance_sheet,
        previous_bs=request.previous_balance_sheet,
    )
    
    validation = calculator.validate_calculation(cf)
    
    return CashFlowResponse(
        cash_flow=cf,
        validation=validation,
        calculation_metadata={
            "standard": request.standard.value,
            "precision": "decimal",
            "engine": "numpy",
        },
    )


@router.post("/validate")
async def validate_cash_flow(cf: CashFlowStatement, standard: AccountingStandard):
    """Validate an existing cash flow calculation."""
    calculator = CashFlowCalculator(standard)
    return calculator.validate_calculation(cf)
