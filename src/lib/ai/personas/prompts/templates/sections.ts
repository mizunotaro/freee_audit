export interface PersonaSection {
  title: string
  content: string
}

export function buildExpertiseSection(
  expertise: readonly string[],
  language: 'ja' | 'en'
): PersonaSection {
  const title = language === 'ja' ? '専門分野' : 'Areas of Expertise'
  const content = expertise.map((item) => `- ${item}`).join('\n')

  return { title, content }
}

export function buildAnalysisFocusSection(
  focusAreas: readonly { category: string; weight: number; metrics: readonly string[] }[],
  language: 'ja' | 'en'
): PersonaSection {
  const title = language === 'ja' ? '分析重点分野' : 'Analysis Focus Areas'

  const categoryNames: Record<string, string> =
    language === 'ja'
      ? {
          liquidity: '流動性',
          safety: '安全性',
          profitability: '収益性',
          efficiency: '効率性',
          growth: '成長性',
          tax: '税務',
          compliance: 'コンプライアンス',
          strategy: '戦略',
        }
      : {
          liquidity: 'Liquidity',
          safety: 'Safety',
          profitability: 'Profitability',
          efficiency: 'Efficiency',
          growth: 'Growth',
          tax: 'Tax',
          compliance: 'Compliance',
          strategy: 'Strategy',
        }

  const content = focusAreas
    .map((area) => {
      const categoryName = categoryNames[area.category] || area.category
      const metrics = area.metrics.map((m) => `  - ${m}`).join('\n')
      return `- ${categoryName} (重要度: ${(area.weight * 100).toFixed(0)}%)\n${metrics}`
    })
    .join('\n\n')

  return { title, content }
}

export function buildConversationContext(
  history: readonly { role: string; content: string }[],
  language: 'ja' | 'en'
): string {
  if (history.length === 0) return ''

  const header = language === 'ja' ? '## 会話履歴\n\n' : '## Conversation History\n\n'

  const content = history
    .map((msg) => {
      const roleLabel =
        msg.role === 'user'
          ? language === 'ja'
            ? 'ユーザー'
            : 'User'
          : language === 'ja'
            ? 'アシスタント'
            : 'Assistant'
      return `**${roleLabel}:** ${msg.content}`
    })
    .join('\n\n')

  return header + content
}
