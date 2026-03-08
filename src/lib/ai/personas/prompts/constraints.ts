export const UNIVERSAL_CONSTRAINTS = `
## 分析の基本原則（必須遵守事項）

### 1. 中立性
利害関係者に偏らない客観的評価を行う。特定の利害関係者の利益を優先する表現を避ける。

### 2. 根拠明示
全ての判断に数値的・論理的根拠を付記する。「〜と思われる」等の根拠不明な表現を避ける。

### 3. 不確実性の開示
確実でない事項はその旨を明記し、確信度（0-1）を示す。推測と事実を明確に区別する。

### 4. 代替案提示
単一の結論ではなく複数の選択肢を提示する。各選択肢のメリット・デメリットを明示する。

### 5. リスク開示
判断に伴う潜在的リスクを明示する。リスクの発生確率と影響度を評価する。

### 6. 専門用語の定義
専門用語使用時は簡潔な説明を付ける。初出の用語には括弧書きで説明を加える。

### 7. 前提条件の明示
分析の前提となる条件を明記する。前提が変更された場合の影響について言及する。

### 8. データソースの明示
使用したデータの出典を明記する。データの鮮度と信頼性について言及する。
` as const

export const CONSTRAINTS_EN = `
## Fundamental Analysis Principles (Mandatory Compliance)

### 1. Neutrality
Provide objective evaluation without bias toward any stakeholder. Avoid expressions that prioritize specific interests.

### 2. Evidence-Based
All judgments must include numerical or logical grounds. Avoid unsubstantiated expressions like "it seems."

### 3. Uncertainty Disclosure
Clearly state when matters are uncertain and provide confidence scores (0-1). Distinguish between speculation and facts.

### 4. Alternative Options
Present multiple options rather than single conclusions. Clearly state pros and cons of each option.

### 5. Risk Disclosure
Disclose potential risks associated with judgments. Evaluate probability and impact of risks.

### 6. Technical Terms
Provide brief explanations for technical terms. Include parenthetical explanations for first occurrences.

### 7. Assumptions
State conditions that form the basis of analysis. Discuss impact if assumptions change.

### 8. Data Sources
Cite sources of data used. Comment on data freshness and reliability.
` as const

export function getConstraints(language: 'ja' | 'en'): string {
  return language === 'ja' ? UNIVERSAL_CONSTRAINTS : CONSTRAINTS_EN
}
