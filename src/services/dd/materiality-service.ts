import { Result, createAppError } from '@/types/result'
import type { MaterialityCalculation, MaterialityOptions } from './types'
import { DEFAULT_MATERALITY_PERCENTAGES, DEFAULT_MINIMUM_MATERALITY_THRESHOLD } from './types'

export class MaterialityService {
  calculate(options: MaterialityOptions): Result<MaterialityCalculation> {
    try {
      const basis = options.basis ?? 'REVENUE'
      const minimumThreshold = options.minimumThreshold ?? DEFAULT_MINIMUM_MATERALITY_THRESHOLD

      let basisAmount: number
      let percentage: number

      if (basis === 'CUSTOM' && options.customBasisAmount) {
        basisAmount = options.customBasisAmount
        percentage = options.percentage ?? 1.0
      } else {
        basisAmount = this.getBasisAmount(basis, options)
        percentage =
          options.percentage ??
          DEFAULT_MATERALITY_PERCENTAGES[basis as keyof typeof DEFAULT_MATERALITY_PERCENTAGES]
      }

      const calculatedAmount = basisAmount * (percentage / 100)
      const finalAmount = Math.max(calculatedAmount, minimumThreshold)

      const calculation: MaterialityCalculation = {
        basis,
        basisAmount,
        percentage,
        calculatedAmount,
        minimumThreshold,
        finalAmount,
      }

      return { success: true, data: calculation }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'CALCULATION_ERROR',
          error instanceof Error ? error.message : 'Failed to calculate materiality',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  calculatePerformanceMateriality(
    revenue: number,
    netIncome: number,
    _totalAssets: number
  ): Result<{
    overall: MaterialityCalculation
    performance: MaterialityCalculation
    trivial: number
  }> {
    try {
      const overall = this.calculateFromValues('REVENUE', revenue, 0.5, 10_000_000)
      const performance = this.calculateFromValues('NET_INCOME', netIncome, 5.0, 10_000_000)
      const trivial = Math.min(overall.finalAmount, performance.finalAmount) * 0.05

      return {
        success: true,
        data: {
          overall,
          performance,
          trivial,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'CALCULATION_ERROR',
          error instanceof Error ? error.message : 'Failed to calculate performance materiality',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  calculateForMergersAndAcquisitions(
    revenue: number,
    _ebitda: number,
    totalAssets: number
  ): Result<{
    overall: MaterialityCalculation
    deal: MaterialityCalculation
  }> {
    try {
      const overall = this.calculateFromValues('REVENUE', revenue, 0.5, 10_000_000)
      const deal = this.calculateFromValues('TOTAL_ASSETS', totalAssets, 1.0, 10_000_000)

      return {
        success: true,
        data: {
          overall,
          deal,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: createAppError(
          'CALCULATION_ERROR',
          error instanceof Error ? error.message : 'Failed to calculate M&A materiality',
          { cause: error instanceof Error ? error : undefined }
        ),
      }
    }
  }

  private getBasisAmount(
    basis: 'REVENUE' | 'TOTAL_ASSETS' | 'NET_INCOME' | 'CUSTOM',
    options: MaterialityOptions
  ): number {
    switch (basis) {
      case 'REVENUE':
        return this.getRevenueAmount(options)
      case 'TOTAL_ASSETS':
        return this.getTotalAssetsAmount(options)
      case 'NET_INCOME':
        return this.getNetIncomeAmount(options)
      case 'CUSTOM':
        return options.customBasisAmount ?? 0
      default:
        return 0
    }
  }

  private getRevenueAmount(_options: MaterialityOptions): number {
    return 1_000_000_000
  }

  private getTotalAssetsAmount(_options: MaterialityOptions): number {
    return 500_000_000
  }

  private getNetIncomeAmount(_options: MaterialityOptions): number {
    return 50_000_000
  }

  private calculateFromValues(
    basis: 'REVENUE' | 'TOTAL_ASSETS' | 'NET_INCOME',
    basisAmount: number,
    percentage: number,
    minimumThreshold: number
  ): MaterialityCalculation {
    const calculatedAmount = basisAmount * (percentage / 100)
    const finalAmount = Math.max(calculatedAmount, minimumThreshold)

    return {
      basis,
      basisAmount,
      percentage,
      calculatedAmount,
      minimumThreshold,
      finalAmount,
    }
  }
}

export const materialityService = new MaterialityService()
