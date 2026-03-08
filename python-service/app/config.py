import os
from typing import Optional


class Settings:
    ALLOWED_ORIGINS: list[str]
    SERVICE_NAME: str
    SERVICE_VERSION: str
    DEBUG: bool
    LOG_LEVEL: str
    PRECISION_DECIMALS: int
    MAX_ARRAY_LENGTH: int
    MAX_STRING_LENGTH: int
    
    def __init__(self) -> None:
        self.ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
        self.SERVICE_NAME = os.getenv("SERVICE_NAME", "financial-calculation-service")
        self.SERVICE_VERSION = os.getenv("SERVICE_VERSION", "1.0.0")
        self.DEBUG = os.getenv("DEBUG", "false").lower() == "true"
        self.LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
        self.PRECISION_DECIMALS = int(os.getenv("PRECISION_DECIMALS", "10"))
        self.MAX_ARRAY_LENGTH = int(os.getenv("MAX_ARRAY_LENGTH", "10000"))
        self.MAX_STRING_LENGTH = int(os.getenv("MAX_STRING_LENGTH", "100000"))


settings = Settings()
