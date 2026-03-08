import type { PersonaConfig, PersonaBuildContext } from '../../types'
import { getConstraints } from '../constraints'
import { getOutputFormat } from '../output-formats'

export function buildBasePrompt(
  config: PersonaConfig,
  context: PersonaBuildContext
): { systemPrompt: string; userPrompt: string } {
  const language = context.language || 'ja'
  const systemPrompt = language === 'ja' ? config.systemPromptJa : config.systemPrompt
  const constraints = getConstraints(language)
  const outputFormat = getOutputFormat(language)

  const fullSystemPrompt = `${systemPrompt}

${constraints}

${outputFormat}`

  const userPrompt = buildUserPrompt(context, language)

  return {
    systemPrompt: fullSystemPrompt,
    userPrompt,
  }
}

function buildUserPrompt(context: PersonaBuildContext, language: 'ja' | 'en'): string {
  const parts: string[] = []

  if (language === 'ja') {
    parts.push(`## 分析依頼\n\n${context.query}`)

    if (context.financialData) {
      parts.push('\n## 財務データ\n\n```json')
      parts.push(JSON.stringify(context.financialData, null, 2))
      parts.push('```')
    }

    if (context.userRole) {
      const roleMap: Record<string, string> = {
        business_owner: '経営者',
        accountant: '会計士',
        investor: '投資家',
        lender: '金融機関',
      }
      parts.push(`\n## ユーザーロール\n\n${roleMap[context.userRole] || context.userRole}`)
    }
  } else {
    parts.push(`## Analysis Request\n\n${context.query}`)

    if (context.financialData) {
      parts.push('\n## Financial Data\n\n```json')
      parts.push(JSON.stringify(context.financialData, null, 2))
      parts.push('```')
    }

    if (context.userRole) {
      parts.push(`\n## User Role\n\n${context.userRole}`)
    }
  }

  return parts.join('\n')
}
