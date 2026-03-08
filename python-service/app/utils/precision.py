from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Union

getcontext().prec = 28


def to_decimal(value: Union[float, int, str, Decimal]) -> Decimal:
    """Convert a value to Decimal with proper precision."""
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def round_decimal(value: Decimal, places: int = 2) -> Decimal:
    """Round a Decimal to specified decimal places."""
    quantize_str = "0." + "0" * places
    return value.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP)


def decimal_add(*values: Union[float, int, str, Decimal]) -> Decimal:
    """Add multiple values with Decimal precision."""
    result = Decimal("0")
    for v in values:
        result += to_decimal(v)
    return result


def decimal_subtract(a: Union[float, int, str, Decimal], b: Union[float, int, str, Decimal]) -> Decimal:
    """Subtract two values with Decimal precision."""
    return to_decimal(a) - to_decimal(b)


def decimal_multiply(a: Union[float, int, str, Decimal], b: Union[float, int, str, Decimal]) -> Decimal:
    """Multiply two values with Decimal precision."""
    return to_decimal(a) * to_decimal(b)


def decimal_divide(a: Union[float, int, str, Decimal], b: Union[float, int, str, Decimal]) -> Decimal:
    """Divide two values with Decimal precision. Returns 0 if divisor is 0."""
    divisor = to_decimal(b)
    if divisor == 0:
        return Decimal("0")
    return to_decimal(a) / divisor


def is_close(a: Decimal, b: Decimal, tolerance: Decimal = Decimal("0.01")) -> bool:
    """Check if two Decimal values are close within tolerance."""
    return abs(a - b) <= tolerance


def percentage(value: Union[float, int, str, Decimal], total: Union[float, int, str, Decimal]) -> Decimal:
    """Calculate percentage with Decimal precision."""
    v = to_decimal(value)
    t = to_decimal(total)
    if t == 0:
        return Decimal("0")
    return round_decimal((v / t) * 100)


def format_currency(value: Decimal, currency: str = "¥") -> str:
    """Format Decimal as currency string."""
    return f"{currency}{value:,.0f}"
