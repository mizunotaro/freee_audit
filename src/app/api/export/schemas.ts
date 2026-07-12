import { z } from 'zod'

export const reportTypeSchema = z.enum([
  'balance_sheet',
  'profit_loss',
  'cash_flow',
  'cash_flow_statement',
  'monthly',
  'quarterly',
  'annual',
  'kpi',
])

export const exportOptionsSchema = z
  .object({
    language: z.enum(['ja', 'en', 'dual']).optional(),
    currency: z.enum(['JPY', 'USD', 'dual']).optional(),
    includeCharts: z.boolean().optional(),
    paperSize: z.enum(['A4', 'A3', 'Letter']).optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    exchangeRate: z.number().finite().positive().optional(),
  })
  .optional()

export const exportBodySchema = z.object({
  reportType: reportTypeSchema,
  fiscalYear: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  options: exportOptionsSchema,
})

export const exportQuerySchema = z.object({
  reportType: reportTypeSchema,
  fiscalYear: z.coerce.number().int().min(1900).max(2100),
  month: z.coerce.number().int().min(1).max(12).optional(),
  language: z.enum(['ja', 'en', 'dual']).optional(),
  currency: z.enum(['JPY', 'USD', 'dual']).optional(),
})
