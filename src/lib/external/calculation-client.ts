import type { AccountingStandard } from '@/types/accounting-standard'
import type { BalanceSheet, ProfitLoss, CashFlowStatement } from '@/types'
import { calculateCashFlow } from '@/services/cashflow/calculator'

interface ServiceConfig {
  pythonServiceUrl: string
  rServiceUrl: string
  timeout: number
  retries: number
}

interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  metadata: {
    service: string
    duration: number
    precision: string
  }
}

class CalculationServiceClient {
  private config: ServiceConfig

  constructor(config?: Partial<ServiceConfig>) {
    this.config = {
      pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
      rServiceUrl: process.env.R_SERVICE_URL || 'http://localhost:8001',
      timeout: 30000,
      retries: 3,
      ...config,
    }
  }

  async calculateCashFlow(
    pl: ProfitLoss,
    currentBS: BalanceSheet,
    previousBS: BalanceSheet | null,
    standard: AccountingStandard = 'JGAAP'
  ): Promise<ServiceResponse<CashFlowStatement>> {
    const startTime = Date.now()

    try {
      const response = await this.fetchWithRetry(
        `${this.config.pythonServiceUrl}/api/v1/cashflow/calculate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            standard,
            profit_loss: pl,
            current_balance_sheet: currentBS,
            previous_balance_sheet: previousBS,
          }),
        }
      )

      const data = await response.json()

      return {
        success: true,
        data: data.cash_flow,
        metadata: {
          service: 'python',
          duration: Date.now() - startTime,
          precision: 'decimal',
        },
      }
    } catch (error) {
      console.warn('Python service unavailable, falling back to TypeScript implementation')
      return this.fallbackCashFlowCalculation(pl, currentBS, previousBS, standard, error)
    }
  }

  async analyzeStatistics(
    data: number[],
    analysisType: 'normality' | 'trend' | 'forecast'
  ): Promise<ServiceResponse<unknown>> {
    const startTime = Date.now()

    try {
      const endpoint = {
        normality: '/api/v1/tests/normality',
        trend: '/api/v1/analysis/trend',
        forecast: '/api/v1/forecast/arima',
      }[analysisType]

      const response = await this.fetchWithRetry(`${this.config.rServiceUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })

      const result = await response.json()

      return {
        success: true,
        data: result,
        metadata: {
          service: 'r',
          duration: Date.now() - startTime,
          precision: 'high',
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'R statistical service is unavailable',
          details: error,
        },
        metadata: {
          service: 'r',
          duration: Date.now() - startTime,
          precision: 'none',
        },
      }
    }
  }

  async calculateFinancialRatios(
    bs: BalanceSheet,
    pl: ProfitLoss,
    industryCode?: string
  ): Promise<ServiceResponse<unknown>> {
    const startTime = Date.now()

    try {
      const response = await this.fetchWithRetry(`${this.config.rServiceUrl}/api/v1/ratios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bs, pl, industry_code: industryCode }),
      })

      const result = await response.json()

      return {
        success: true,
        data: result,
        metadata: {
          service: 'r',
          duration: Date.now() - startTime,
          precision: 'high',
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'R service is unavailable',
          details: error,
        },
        metadata: {
          service: 'r',
          duration: Date.now() - startTime,
          precision: 'none',
        },
      }
    }
  }

  async calculateAltmanZScore(
    bs: BalanceSheet,
    pl: ProfitLoss
  ): Promise<ServiceResponse<{ z_score: number; interpretation: string }>> {
    const startTime = Date.now()

    try {
      const response = await this.fetchWithRetry(`${this.config.rServiceUrl}/api/v1/zscore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bs, pl }),
      })

      const result = await response.json()

      return {
        success: true,
        data: result,
        metadata: {
          service: 'r',
          duration: Date.now() - startTime,
          precision: 'high',
        },
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'R service is unavailable',
          details: error,
        },
        metadata: {
          service: 'r',
          duration: Date.now() - startTime,
          precision: 'none',
        },
      }
    }
  }

  async healthCheck(): Promise<{
    python: boolean
    r: boolean
  }> {
    const results = await Promise.allSettled([
      this.checkServiceHealth(this.config.pythonServiceUrl),
      this.checkServiceHealth(this.config.rServiceUrl),
    ])

    return {
      python: results[0].status === 'fulfilled' && results[0].value,
      r: results[1].status === 'fulfilled' && results[1].value,
    }
  }

  private async checkServiceHealth(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number = this.config.retries
  ): Promise<Response> {
    let lastError: Error | null = null

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.timeout),
        })

        if (response.ok) {
          return response
        }

        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Client error: ${response.status}`)
        }

        lastError = new Error(`Server error: ${response.status}`)
      } catch (error) {
        lastError = error as Error
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 100))
    }

    throw lastError || new Error('Max retries exceeded')
  }

  private fallbackCashFlowCalculation(
    pl: ProfitLoss,
    currentBS: BalanceSheet,
    previousBS: BalanceSheet | null,
    standard: AccountingStandard,
    error: unknown
  ): ServiceResponse<CashFlowStatement> {
    const result = calculateCashFlow(pl, currentBS, previousBS, { standard })

    return {
      success: true,
      data: result,
      error: {
        code: 'FALLBACK_USED',
        message: 'Python service unavailable, used TypeScript fallback',
        details: error,
      },
      metadata: {
        service: 'typescript-fallback',
        duration: 0,
        precision: 'float64',
      },
    }
  }
}

export const calculationClient = new CalculationServiceClient()
export { CalculationServiceClient }
