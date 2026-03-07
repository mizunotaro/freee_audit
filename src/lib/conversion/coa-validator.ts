import type { AccountCategory, ChartOfAccountItem, ChartOfAccounts } from '@/types/conversion'

export interface ValidationError {
  code: string
  message: string
  field?: string
  itemId?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

const VALID_CATEGORIES: AccountCategory[] = [
  'current_asset',
  'fixed_asset',
  'deferred_asset',
  'current_liability',
  'fixed_liability',
  'deferred_liability',
  'equity',
  'revenue',
  'cogs',
  'sga_expense',
  'non_operating_income',
  'non_operating_expense',
  'extraordinary_income',
  'extraordinary_loss',
]

const MAX_HIERARCHY_LEVEL = 5

export class COAValidator {
  validateItem(item: Partial<ChartOfAccountItem>): ValidationError[] {
    const errors: ValidationError[] = []

    if (!item.code || item.code.trim() === '') {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: '勘定科目コードは必須です',
        field: 'code',
        itemId: item.id,
      })
    } else if (!/^[A-Za-z0-9_-]+$/.test(item.code)) {
      errors.push({
        code: 'INVALID_CODE_FORMAT',
        message: '勘定科目コードは英数字、ハイフン、アンダースコアのみ使用可能です',
        field: 'code',
        itemId: item.id,
      })
    }

    if (!item.name || item.name.trim() === '') {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: '勘定科目名（日本語）は必須です',
        field: 'name',
        itemId: item.id,
      })
    }

    if (!item.nameEn || item.nameEn.trim() === '') {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: '勘定科目名（英語）は必須です',
        field: 'nameEn',
        itemId: item.id,
      })
    }

    if (!item.category) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'カテゴリは必須です',
        field: 'category',
        itemId: item.id,
      })
    } else if (!VALID_CATEGORIES.includes(item.category)) {
      errors.push({
        code: 'INVALID_CATEGORY',
        message: `無効なカテゴリです: ${item.category}`,
        field: 'category',
        itemId: item.id,
      })
    }

    if (!item.normalBalance) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: '借方/貸方は必須です',
        field: 'normalBalance',
        itemId: item.id,
      })
    } else if (!['debit', 'credit'].includes(item.normalBalance)) {
      errors.push({
        code: 'INVALID_NORMAL_BALANCE',
        message: `無効な借方/貸方の値です: ${item.normalBalance}`,
        field: 'normalBalance',
        itemId: item.id,
      })
    }

    if (item.level !== undefined && (item.level < 0 || item.level > MAX_HIERARCHY_LEVEL)) {
      errors.push({
        code: 'INVALID_LEVEL',
        message: `階層レベルは0〜${MAX_HIERARCHY_LEVEL}の範囲で指定してください`,
        field: 'level',
        itemId: item.id,
      })
    }

    return errors
  }

  validateCOA(
    coa: Partial<ChartOfAccounts> & { items: Partial<ChartOfAccountItem>[] }
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    if (!coa.companyId) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: '会社IDは必須です',
        field: 'companyId',
      })
    }

    if (!coa.standard) {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: '会計基準は必須です',
        field: 'standard',
      })
    }

    if (!coa.name || coa.name.trim() === '') {
      errors.push({
        code: 'REQUIRED_FIELD',
        message: 'COA名は必須です',
        field: 'name',
      })
    }

    if (!coa.items || coa.items.length === 0) {
      errors.push({
        code: 'NO_ITEMS',
        message: '勘定科目が登録されていません',
      })
      return { isValid: false, errors, warnings }
    }

    for (const item of coa.items) {
      const itemErrors = this.validateItem(item)
      errors.push(...itemErrors)
    }

    const codeSet = new Set<string>()
    const codeDuplicates: string[] = []
    for (const item of coa.items) {
      if (item.code) {
        if (codeSet.has(item.code)) {
          if (!codeDuplicates.includes(item.code)) {
            codeDuplicates.push(item.code)
            errors.push({
              code: 'DUPLICATE_CODE',
              message: `勘定科目コードが重複しています: ${item.code}`,
              field: 'code',
              itemId: item.id,
            })
          }
        } else {
          codeSet.add(item.code)
        }
      }
    }

    const circularErrors = this.detectCircularReferences(coa.items)
    errors.push(...circularErrors)

    const hierarchyErrors = this.validateHierarchyLevels(coa.items)
    errors.push(...hierarchyErrors)

    const orphanWarnings = this.detectOrphanItems(coa.items)
    warnings.push(...orphanWarnings)

    if (coa.items.length > 1000) {
      warnings.push({
        code: 'MANY_ITEMS',
        message: `勘定科目数が多いため、パフォーマンスに影響する可能性があります（現在: ${coa.items.length}件）`,
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private detectCircularReferences(items: Partial<ChartOfAccountItem>[]): ValidationError[] {
    const errors: ValidationError[] = []
    const itemMap = new Map<string, Partial<ChartOfAccountItem>>()
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    for (const item of items) {
      if (item.id) {
        itemMap.set(item.id, item)
      }
    }

    const hasCycle = (itemId: string, path: string[]): boolean => {
      if (recursionStack.has(itemId)) {
        return true
      }
      if (visited.has(itemId)) {
        return false
      }

      visited.add(itemId)
      recursionStack.add(itemId)

      const item = itemMap.get(itemId)
      if (item?.parentId) {
        if (hasCycle(item.parentId, [...path, itemId])) {
          return true
        }
      }

      recursionStack.delete(itemId)
      return false
    }

    for (const item of items) {
      if (item.id && !visited.has(item.id)) {
        if (hasCycle(item.id, [])) {
          errors.push({
            code: 'CIRCULAR_REFERENCE',
            message: `循環参照が検出されました: ${item.code || item.id}`,
            itemId: item.id,
            field: 'parentId',
          })
        }
      }
    }

    return errors
  }

  private validateHierarchyLevels(items: Partial<ChartOfAccountItem>[]): ValidationError[] {
    const errors: ValidationError[] = []
    const itemMap = new Map<string, Partial<ChartOfAccountItem>>()

    for (const item of items) {
      if (item.id) {
        itemMap.set(item.id, item)
      }
    }

    const getLevel = (item: Partial<ChartOfAccountItem>, visited: Set<string>): number => {
      if (!item.parentId) return 0
      if (visited.has(item.id || '')) return 0

      visited.add(item.id || '')
      const parent = itemMap.get(item.parentId)
      if (!parent) return 0

      return 1 + getLevel(parent, visited)
    }

    for (const item of items) {
      if (item.id && item.level !== undefined) {
        const calculatedLevel = getLevel(item, new Set())
        if (item.level !== calculatedLevel) {
          errors.push({
            code: 'LEVEL_MISMATCH',
            message: `階層レベルが不正です。実際: ${calculatedLevel}, 指定: ${item.level}`,
            itemId: item.id,
            field: 'level',
          })
        }
      }
    }

    return errors
  }

  private detectOrphanItems(items: Partial<ChartOfAccountItem>[]): ValidationError[] {
    const warnings: ValidationError[] = []
    const itemIdSet = new Set(items.filter((i) => i.id).map((i) => i.id))

    for (const item of items) {
      if (item.parentId && !itemIdSet.has(item.parentId)) {
        warnings.push({
          code: 'ORPHAN_ITEM',
          message: `親科目が見つかりません: ${item.code} (parentId: ${item.parentId})`,
          itemId: item.id,
          field: 'parentId',
        })
      }
    }

    return warnings
  }

  validateCategoryConsistency(items: Partial<ChartOfAccountItem>[]): ValidationError[] {
    const errors: ValidationError[] = []
    const itemMap = new Map<string, Partial<ChartOfAccountItem>>()

    for (const item of items) {
      if (item.id) {
        itemMap.set(item.id, item)
      }
    }

    for (const item of items) {
      if (item.parentId && item.category) {
        const parent = itemMap.get(item.parentId)
        if (parent && parent.category && parent.category !== item.category) {
          errors.push({
            code: 'CATEGORY_MISMATCH',
            message: `親科目とカテゴリが異なります。子: ${item.category}, 親: ${parent.category}`,
            itemId: item.id,
            field: 'category',
          })
        }
      }
    }

    return errors
  }
}
