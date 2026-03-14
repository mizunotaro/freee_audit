'use client'

import * as React from 'react'
import { irReportService } from '@/services/reports/ir'
import type {
  AIGenerationRequest,
  AIGenerationResult,
  ReportSectionType,
  Language,
} from '@/types/reports/ir-report'

export interface UseIRGenerationOptions {
  reportId: string
  onGenerated?: (sectionType: ReportSectionType, content: { ja: string; en: string }) => void
  onError?: (error: string) => void
}

export interface GenerationState {
  isGenerating: boolean
  sectionType: ReportSectionType | null
  progress: number
  error: string | null
}

export interface UseIRGenerationReturn {
  state: GenerationState
  generate: (sectionType: ReportSectionType, language: Language) => Promise<AIGenerationResult>
  generateAll: () => Promise<Record<ReportSectionType, AIGenerationResult>>
  cancel: () => void
  retry: () => void
  lastResult: AIGenerationResult | null
}

const SECTION_TYPES: ReportSectionType[] = [
  'company_overview',
  'message_from_ceo',
  'business_overview',
  'financial_highlights',
  'financial_statements',
  'risk_factors',
  'corporate_governance',
  'shareholder_information',
  'sustainability',
  'outlook',
]

export function useIRGeneration(options: UseIRGenerationOptions): UseIRGenerationReturn {
  const { reportId, onGenerated, onError } = options

  const [state, setState] = React.useState<GenerationState>({
    isGenerating: false,
    sectionType: null,
    progress: 0,
    error: null,
  })

  const [lastResult, setLastResult] = React.useState<AIGenerationResult | null>(null)
  const [lastRequest, setLastRequest] = React.useState<{
    sectionType: ReportSectionType
    language: Language
  } | null>(null)
  const cancelledRef = React.useRef(false)

  const generate = React.useCallback(
    async (sectionType: ReportSectionType, language: Language): Promise<AIGenerationResult> => {
      cancelledRef.current = false
      setLastRequest({ sectionType, language })

      setState({
        isGenerating: true,
        sectionType,
        progress: 0,
        error: null,
      })

      const progressInterval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }))
      }, 500)

      try {
        const request: AIGenerationRequest = {
          sectionType,
          context: {
            companyId: reportId,
            fiscalYear: new Date().getFullYear().toString(),
          },
          language,
        }

        const result = await irReportService.generateSectionContent(request)

        clearInterval(progressInterval)

        if (cancelledRef.current) {
          return { success: false, error: 'Cancelled' }
        }

        setState((prev) => ({
          ...prev,
          isGenerating: false,
          progress: 100,
        }))

        if (result.success && result.content) {
          onGenerated?.(sectionType, result.content)
          setLastResult(result)
        } else {
          const errorMsg = result.error || 'Generation failed'
          setState((prev) => ({
            ...prev,
            error: errorMsg,
          }))
          onError?.(errorMsg)
        }

        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            progress: 0,
            sectionType: null,
          }))
        }, 500)

        return result
      } catch (err) {
        clearInterval(progressInterval)

        const errorMsg = err instanceof Error ? err.message : 'Generation failed'
        setState({
          isGenerating: false,
          sectionType: null,
          progress: 0,
          error: errorMsg,
        })
        onError?.(errorMsg)

        return { success: false, error: errorMsg }
      }
    },
    [reportId, onGenerated, onError]
  )

  const generateAll = React.useCallback(async (): Promise<
    Record<ReportSectionType, AIGenerationResult>
  > => {
    const results: Partial<Record<ReportSectionType, AIGenerationResult>> = {}
    cancelledRef.current = false

    for (let i = 0; i < SECTION_TYPES.length; i++) {
      if (cancelledRef.current) {
        break
      }

      const sectionType = SECTION_TYPES[i]
      setState({
        isGenerating: true,
        sectionType,
        progress: (i / SECTION_TYPES.length) * 100,
        error: null,
      })

      const result = await generate(sectionType, 'ja')
      results[sectionType] = result
    }

    setState({
      isGenerating: false,
      sectionType: null,
      progress: 100,
      error: null,
    })

    return results as Record<ReportSectionType, AIGenerationResult>
  }, [generate])

  const cancel = React.useCallback(() => {
    cancelledRef.current = true
    setState({
      isGenerating: false,
      sectionType: null,
      progress: 0,
      error: null,
    })
  }, [])

  const retry = React.useCallback(async () => {
    if (lastRequest) {
      return generate(lastRequest.sectionType, lastRequest.language)
    }
    return { success: false, error: 'No previous request to retry' }
  }, [lastRequest, generate])

  return {
    state,
    generate,
    generateAll,
    cancel,
    retry,
    lastResult,
  }
}

export default useIRGeneration
