import { z } from 'zod'

export const ReasoningItemSchema = z.object({
  point: z.string().min(1).max(200),
  analysis: z.string().min(1).max(1000),
  evidence: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
})

export const AlternativeOptionSchema = z.object({
  option: z.string().min(1).max(200),
  pros: z.array(z.string().max(200)).max(5),
  cons: z.array(z.string().max(200)).max(5),
  riskLevel: z.enum(['low', 'medium', 'high']),
})

export const RiskItemSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  probability: z.number().min(0).max(1),
  mitigation: z.string().max(500).optional(),
})

export const PersonaResponseSchema = z.object({
  conclusion: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(ReasoningItemSchema).min(1).max(10),
  alternatives: z.array(AlternativeOptionSchema).max(5).optional(),
  risks: z.array(RiskItemSchema).min(1).max(10),
  recommendedAction: z.string().max(1000).optional(),
})

export type ReasoningItem = z.infer<typeof ReasoningItemSchema>
export type AlternativeOption = z.infer<typeof AlternativeOptionSchema>
export type RiskItem = z.infer<typeof RiskItemSchema>
export type PersonaResponse = z.infer<typeof PersonaResponseSchema>
