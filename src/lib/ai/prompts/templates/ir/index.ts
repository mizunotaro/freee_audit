import type {
  IRPromptTemplate,
  IRPromptSectionType,
  IRPromptRegistry,
  IRPromptResult,
} from './types'
import { topMessageTemplate, getTopMessageTemplate } from './top-message'
import { financialHighlightsTemplate, getFinancialHighlightsTemplate } from './financial-highlights'
import { dividendPolicyTemplate, getDividendPolicyTemplate } from './dividend-policy'
import { midtermPlanTemplate, getMidtermPlanTemplate } from './midterm-plan'
import { esgInfoTemplate, getESGInfoTemplate } from './esg-info'
import { riskFactorsTemplate, getRiskFactorsTemplate } from './risk-factors'

export type {
  IRPromptTemplate,
  IRPromptSectionType,
  IRPromptPersona,
  IRPromptVariables,
  IRPromptRegistry,
  IRPromptResult,
  LocalizedText,
} from './types'

const IR_TEMPLATES: readonly IRPromptTemplate[] = [
  topMessageTemplate,
  financialHighlightsTemplate,
  dividendPolicyTemplate,
  midtermPlanTemplate,
  esgInfoTemplate,
  riskFactorsTemplate,
] as const

const templateMap: ReadonlyMap<string, IRPromptTemplate> = new Map(
  IR_TEMPLATES.map((template) => [template.id, template])
)

const templateBySectionTypeMap: ReadonlyMap<IRPromptSectionType, IRPromptTemplate> = new Map(
  IR_TEMPLATES.map((template) => [template.sectionType, template])
)

function getBySectionType(sectionType: IRPromptSectionType): IRPromptTemplate | undefined {
  return templateBySectionTypeMap.get(sectionType)
}

function getAll(): readonly IRPromptTemplate[] {
  return IR_TEMPLATES
}

function getById(id: string): IRPromptTemplate | undefined {
  return templateMap.get(id)
}

function registerTemplate(template: IRPromptTemplate): IRPromptResult<void> {
  if (templateMap.has(template.id)) {
    return {
      success: false,
      error: {
        code: 'TEMPLATE_ALREADY_EXISTS',
        message: `Template with id "${template.id}" already exists`,
      },
    }
  }
  const mutableMap = templateMap as Map<string, IRPromptTemplate>
  mutableMap.set(template.id, template)
  return { success: true, data: undefined }
}

function getTemplate(idOrSectionType: string | IRPromptSectionType): IRPromptTemplate | undefined {
  return getById(idOrSectionType) ?? getBySectionType(idOrSectionType as IRPromptSectionType)
}

export const irPromptRegistry: IRPromptRegistry = {
  templates: templateMap,
  getBySectionType,
  getAll,
}

export {
  getBySectionType,
  getAll,
  getById,
  registerTemplate,
  getTemplate,
  getTopMessageTemplate,
  getFinancialHighlightsTemplate,
  getDividendPolicyTemplate,
  getMidtermPlanTemplate,
  getESGInfoTemplate,
  getRiskFactorsTemplate,
}

export const IR_TEMPLATES_LIST = IR_TEMPLATES
