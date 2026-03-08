import type { BalanceSheet, ProfitLoss, CashFlowStatement, FinancialKPIs } from '@/types'
import type { AccountingStandard, AccountingStandardConfig } from '@/types/accounting-standard'
import { getAccountingStandardConfig } from '@/types/accounting-standard'
import { getPersona } from '@/lib/ai/personas'
import { createAIProviderFromEnv } from '@/lib/integrations/ai'

export interface CalculationValidationInput {
  standard: AccountingStandard
  balanceSheet: BalanceSheet
  profitLoss: ProfitLoss
  cashFlow: CashFlowStatement
  kpis: FinancialKPIs
  calculationFormulas: CalculationFormula[]
}

export interface CalculationFormula {
  name: string
  formula: string
  inputs: Record<string, number>
  output: number
  description: string
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  category: 'formula' | 'standard_compliance' | 'data_quality' | 'assumption'
  itemName: string
  description: string
  expectedValue?: number
  actualValue?: number
  recommendation: string
  confidence: number
}

export interface CalculationValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  standardCompliance: {
    standard: AccountingStandard
    compliant: boolean
    deviations: string[]
  }
  confidence: number
  validatedAt: Date
}

export class CalculationValidator {
  async validateCashFlow(input: CalculationValidationInput): Promise<CalculationValidationResult> {
    const config = getAccountingStandardConfig(input.standard)
    const issues: ValidationIssue[] = []

    issues.push(...this.validateCashFlowConsistency(input))

    issues.push(...this.validateStandardCompliance(input, config))

    const llmIssues = await this.validateWithLLM(input, 'cpa')
    issues.push(...llmIssues)

    const confidence = this.calculateConfidence(issues)

    return {
      isValid: !issues.some((i) => i.severity === 'error'),
      issues,
      standardCompliance: {
        standard: input.standard,
        compliant: !issues.some(
          (i) => i.category === 'standard_compliance' && i.severity === 'error'
        ),
        deviations: issues
          .filter((i) => i.category === 'standard_compliance')
          .map((i) => i.description),
      },
      confidence,
      validatedAt: new Date(),
    }
  }

  private validateCashFlowConsistency(input: CalculationValidationInput): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const cf = input.cashFlow

    const op = cf.operatingActivities
    if (op) {
      const calculatedOpCF =
        op.netIncome +
        op.depreciation +
        op.increaseInReceivables +
        op.decreaseInInventory +
        op.increaseInPayables +
        op.otherNonCash

      const diff = Math.abs(calculatedOpCF - op.netCashFromOperating)
      if (diff > 1) {
        issues.push({
          severity: 'error',
          category: 'formula',
          itemName: '営業キャッシュフロー',
          description: `営業CFの計算に不整合があります。構成要素の合計と一致しません。`,
          expectedValue: calculatedOpCF,
          actualValue: op.netCashFromOperating,
          recommendation: '計算式を確認し、不足している調整項目がないか確認してください',
          confidence: 0.95,
        })
      }
    }

    const cashChange = cf.endingCash - cf.beginningCash
    if (Math.abs(cashChange - cf.netChangeInCash) > 1) {
      issues.push({
        severity: 'error',
        category: 'formula',
        itemName: '現金同等物の増減',
        description: '期首・期末現金と現金増減の整合性が取れていません',
        expectedValue: cashChange,
        actualValue: cf.netChangeInCash,
        recommendation: '現金の増減計算を確認してください',
        confidence: 0.99,
      })
    }

    return issues
  }

  private validateStandardCompliance(
    input: CalculationValidationInput,
    config: AccountingStandardConfig
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = []

    if (config.cashFlow.interestClassification === 'financing') {
      // IFRS: Interest paid should be in financing activities
      // Warning if implementation includes it in operating activities
    }

    if (config.taxEffect.deferredTaxRequired) {
      // Check if deferred tax asset/liability changes are reflected in operating CF
      // Currently assumed to be included in otherNonCash
    }

    return issues
  }

  private async validateWithLLM(
    input: CalculationValidationInput,
    personaType: 'cpa' | 'tax_accountant' | 'cfo'
  ): Promise<ValidationIssue[]> {
    try {
      const persona = getPersona(personaType)
      if (!persona) {
        return []
      }

      const provider = createAIProviderFromEnv()
      if (!provider) {
        return []
      }

      const prompt = this.buildValidationPrompt(input)
      const systemPrompt = this.getSystemPrompt(personaType)

      const response = await provider.validateEntry({
        journalEntry: {
          date: new Date().toISOString().split('T')[0],
          debitAccount: 'validation',
          creditAccount: 'validation',
          amount: 0,
          taxAmount: 0,
          description: prompt,
        },
        documentData: {
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          taxAmount: 0,
          description: systemPrompt,
          vendorName: 'Calculation Validator',
          confidence: 1,
        },
      })

      if (!response.isValid && response.issues) {
        return response.issues.map((issue) => ({
          severity: issue.severity,
          category: 'standard_compliance' as const,
          itemName: issue.field,
          description: issue.message,
          recommendation: response.suggestions?.join('. ') || '',
          confidence: 0.7,
        }))
      }

      return []
    } catch (error) {
      console.error('LLM validation failed:', error)
      return []
    }
  }

  private getSystemPrompt(personaType: string): string {
    const prompts: Record<string, string> = {
      cpa: `あなたは公認会計士として、財務計算の妥当性を検証します。
以下の観点から評価してください：
1. 計算式の正確性
2. 会計基準（JGAAP/USGAAP/IFRS）への準拠性
3. 数値の論理的整合性
4. 開示要件の充足

問題がある場合は、JSON形式で具体的な指摘事項を返してください。`,
      tax_accountant: `あなたは税理士として、税務上の観点から財務計算を検証します。
法人税法・消費税法等の観点から、計算や分類に問題がないか確認してください。`,
      cfo: `あなたはCFOとして、経営陣の視点から財務計算を検証します。
キャッシュフロー管理、資金調達戦略、投資判断の観点から評価してください。`,
    }
    return prompts[personaType] || prompts.cpa
  }

  private buildValidationPrompt(input: CalculationValidationInput): string {
    const totalRevenue = input.profitLoss.revenue.reduce((s, r) => s + r.amount, 0)

    return `
## 検証対象データ

### 会計基準
${input.standard}

### 貸借対照表（主要項目）
- 総資産: ${input.balanceSheet.totalAssets.toLocaleString()}円
- 総負債: ${input.balanceSheet.totalLiabilities.toLocaleString()}円
- 純資産: ${input.balanceSheet.totalEquity.toLocaleString()}円

### 損益計算書（主要項目）
- 売上高: ${totalRevenue.toLocaleString()}円
- 営業利益: ${input.profitLoss.operatingIncome.toLocaleString()}円
- 当期純利益: ${input.profitLoss.netIncome.toLocaleString()}円
- 減価償却費: ${input.profitLoss.depreciation?.toLocaleString() || 0}円

### キャッシュフロー計算書
- 営業CF: ${input.cashFlow.operatingActivities?.netCashFromOperating?.toLocaleString() || 'N/A'}円
- 投資CF: ${input.cashFlow.investingActivities?.netCashFromInvesting?.toLocaleString() || 'N/A'}円
- 財務CF: ${input.cashFlow.financingActivities?.netCashFromFinancing?.toLocaleString() || 'N/A'}円

### 計算式
${input.calculationFormulas.map((f) => `- ${f.name}: ${f.formula} = ${f.output}`).join('\n')}

## 検証依頼

上記の財務計算について、会計基準 ${input.standard} に照らして妥当性を検証してください。
`
  }

  private parseValidationResponse(content: string): ValidationIssue[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return []

      const parsed = JSON.parse(jsonMatch[0])
      if (!Array.isArray(parsed.issues)) return []

      return parsed.issues.map((issue: Record<string, unknown>) => ({
        severity: (issue.severity as 'error' | 'warning' | 'info') || 'info',
        category:
          (issue.category as 'formula' | 'standard_compliance' | 'data_quality' | 'assumption') ||
          'formula',
        itemName: String(issue.itemName || 'Unknown'),
        description: String(issue.description || ''),
        recommendation: String(issue.recommendation || ''),
        confidence: typeof issue.confidence === 'number' ? issue.confidence : 0.5,
      }))
    } catch {
      return []
    }
  }

  private calculateConfidence(issues: ValidationIssue[]): number {
    if (issues.length === 0) return 1.0

    const weights = { error: 0.3, warning: 0.1, info: 0.02 }
    const totalDeduction = issues.reduce((sum, issue) => {
      return sum + weights[issue.severity] * issue.confidence
    }, 0)

    return Math.max(0, 1 - totalDeduction)
  }
}

export const calculationValidator = new CalculationValidator()
