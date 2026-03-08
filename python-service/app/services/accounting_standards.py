from typing import Any

from app.models.financial import AccountingStandard


class AccountingStandardsService:
    """
    Service for handling accounting standard-specific logic.
    """
    
    STANDARD_CONFIGS = {
        AccountingStandard.JGAAP: {
            "name": "Japanese GAAP",
            "interest_classification": "non_operating",
            "deferred_tax_recognition": "balance_sheet",
            "currency": "JPY",
            "fiscal_year_end": "march",
        },
        AccountingStandard.USGAAP: {
            "name": "US GAAP",
            "interest_classification": "operating",
            "deferred_tax_recognition": "balance_sheet",
            "currency": "USD",
            "fiscal_year_end": "december",
        },
        AccountingStandard.IFRS: {
            "name": "International Financial Reporting Standards",
            "interest_classification": "financing",
            "deferred_tax_recognition": "balance_sheet",
            "currency": "reporting_currency",
            "fiscal_year_end": "flexible",
        },
    }
    
    def get_config(self, standard: AccountingStandard) -> dict[str, Any]:
        """Get configuration for an accounting standard."""
        return self.STANDARD_CONFIGS.get(standard, self.STANDARD_CONFIGS[AccountingStandard.JGAAP])
    
    def get_interest_classification(self, standard: AccountingStandard) -> str:
        """Get how interest should be classified for a standard."""
        config = self.get_config(standard)
        return config.get("interest_classification", "non_operating")
    
    def is_interest_operating(self, standard: AccountingStandard) -> bool:
        """Check if interest is classified as operating activity."""
        return self.get_interest_classification(standard) == "operating"
