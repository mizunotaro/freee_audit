from app.routers import cashflow, kpi, statistics, validation
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting Financial Calculation Service...")
    yield
    print("Shutting down Financial Calculation Service...")


app = FastAPI(
    title="Financial Calculation Service",
    description="High-precision financial calculations using NumPy/Pandas/SciPy",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cashflow.router, prefix="/api/v1/cashflow", tags=["Cash Flow"])
app.include_router(kpi.router, prefix="/api/v1/kpi", tags=["KPI"])
app.include_router(statistics.router, prefix="/api/v1/statistics", tags=["Statistics"])
app.include_router(validation.router, prefix="/api/v1/validation", tags=["Validation"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "python-calculation", "version": settings.SERVICE_VERSION}
