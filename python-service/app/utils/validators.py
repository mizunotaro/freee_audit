from typing import Any, Optional
from decimal import Decimal, InvalidOperation


class ValidationError(Exception):
    """Custom validation error."""
    def __init__(self, code: str, message: str, path: Optional[str] = None):
        self.code = code
        self.message = message
        self.path = path
        super().__init__(message)


def validate_amount(value: Any, min_val: float = -999_999_999_999, max_val: float = 999_999_999_999) -> Decimal:
    """Validate and convert a financial amount."""
    if value is None:
        raise ValidationError("INVALID_AMOUNT", "Amount cannot be None")
    
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError) as e:
        raise ValidationError("INVALID_AMOUNT_FORMAT", f"Cannot convert {value} to decimal: {e}")
    
    if decimal_value < Decimal(str(min_val)) or decimal_value > Decimal(str(max_val)):
        raise ValidationError(
            "AMOUNT_OUT_OF_RANGE",
            f"Amount {value} is out of range [{min_val}, {max_val}]"
        )
    
    return decimal_value


def validate_percentage(value: Any, min_val: float = -9999.99, max_val: float = 9999.99) -> Decimal:
    """Validate a percentage value."""
    if value is None:
        raise ValidationError("INVALID_PERCENTAGE", "Percentage cannot be None")
    
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, ValueError) as e:
        raise ValidationError("INVALID_PERCENTAGE_FORMAT", f"Cannot convert {value} to decimal: {e}")
    
    if decimal_value < Decimal(str(min_val)) or decimal_value > Decimal(str(max_val)):
        raise ValidationError(
            "PERCENTAGE_OUT_OF_RANGE",
            f"Percentage {value} is out of range [{min_val}, {max_val}]"
        )
    
    return decimal_value


def validate_fiscal_year(value: Any) -> int:
    """Validate a fiscal year value."""
    if not isinstance(value, int):
        try:
            value = int(value)
        except (ValueError, TypeError):
            raise ValidationError("INVALID_FISCAL_YEAR", f"Fiscal year must be an integer: {value}")
    
    if value < 1900 or value > 2100:
        raise ValidationError(
            "FISCAL_YEAR_OUT_OF_RANGE",
            f"Fiscal year {value} is out of range [1900, 2100]"
        )
    
    return value


def validate_month(value: Any) -> int:
    """Validate a month value."""
    if not isinstance(value, int):
        try:
            value = int(value)
        except (ValueError, TypeError):
            raise ValidationError("INVALID_MONTH", f"Month must be an integer: {value}")
    
    if value < 1 or value > 12:
        raise ValidationError(
            "MONTH_OUT_OF_RANGE",
            f"Month {value} is out of range [1, 12]"
        )
    
    return value


def validate_string(value: Any, max_length: int = 100_000, required: bool = True) -> str:
    """Validate and sanitize a string input."""
    if value is None:
        if required:
            raise ValidationError("REQUIRED_STRING", "String value is required")
        return ""
    
    if not isinstance(value, str):
        value = str(value)
    
    sanitized = value.replace("\x00", "").strip()
    
    if required and not sanitized:
        raise ValidationError("EMPTY_STRING", "String cannot be empty")
    
    if len(sanitized) > max_length:
        raise ValidationError(
            "STRING_TOO_LONG",
            f"String length {len(sanitized)} exceeds maximum {max_length}"
        )
    
    return sanitized


def validate_array_length(arr: Any, max_length: int = 10_000, min_length: int = 0) -> list:
    """Validate array length."""
    if not isinstance(arr, list):
        raise ValidationError("INVALID_ARRAY", f"Expected list, got {type(arr).__name__}")
    
    if len(arr) < min_length:
        raise ValidationError(
            "ARRAY_TOO_SHORT",
            f"Array length {len(arr)} is less than minimum {min_length}"
        )
    
    if len(arr) > max_length:
        raise ValidationError(
            "ARRAY_TOO_LONG",
            f"Array length {len(arr)} exceeds maximum {max_length}"
        )
    
    return arr
