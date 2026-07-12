import { z } from 'zod'

export const analysisTypeSchema = z.enum([
  'FINANCIAL_ANALYSIS',
  'JOURNAL_AUDIT',
  'BUDGET_VARIANCE',
  'CASH_FLOW_FORECAST',
  'KPI_ANALYSIS',
  'BOARD_REPORT',
])

export const promptBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullish(),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  variables: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string(),
      required: z.boolean(),
    })
  ),
})
