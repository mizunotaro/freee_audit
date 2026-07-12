import { describe, it, expect } from 'vitest'
import ja from '../../../messages/ja.json'
import en from '../../../messages/en.json'

// Locks the `import` i18n namespace contract used by ImportCard / ImportPreview /
// ImportResult. Guards against key drift between locales and pins the exact source
// strings the components render (regression net for the i18n-cov-01 extraction).
const jaImport = ja.import as Record<string, string>
const enImport = en.import as Record<string, string>

describe('import i18n namespace — catalog contract', () => {
  it('exists in both locales', () => {
    expect(jaImport).toBeTruthy()
    expect(enImport).toBeTruthy()
  })

  it('has identical key sets in ja and en', () => {
    const jaKeys = Object.keys(jaImport).sort()
    const enKeys = Object.keys(enImport).sort()
    expect(enKeys).toEqual(jaKeys)
  })

  it('has no empty values in either locale', () => {
    for (const [k, v] of Object.entries(jaImport)) {
      expect(v.length, `ja.import.${k} is empty`).toBeGreaterThan(0)
    }
    for (const [k, v] of Object.entries(enImport)) {
      expect(v.length, `en.import.${k} is empty`).toBeGreaterThan(0)
    }
  })

  it('preserves the exact Japanese source strings the components depend on', () => {
    // Sample of strings asserted by the component tests — pins the ja text verbatim.
    expect(jaImport.errUnsupportedFormat).toBe(
      'サポートされていないファイル形式です。対応形式: {formats}'
    )
    expect(jaImport.errFileTooLarge).toBe('ファイルサイズは{max}MB以下にしてください')
    expect(jaImport.cardTitle).toBe('{type}インポート')
    expect(jaImport.showingErrorsOf).toBe('{total}件中 {shown}件を表示')
    expect(jaImport.partialAlertDesc).toBe(
      '一部のデータは正常にインポートされましたが、{count}件のエラーがありました。'
    )
    expect(jaImport.durationSeconds).toBe('{s}秒')
    expect(jaImport.csvRequired).toBe('CSVファイルを選択してください')
    expect(jaImport.jiTitle).toBe('仕訳データインポート')
    expect(jaImport.count).toBe('{n}件')
    expect(jaImport.rowError).toBe('行{row}: {message}')
  })

  it('declares every ICU placeholder used by the components', () => {
    // Ensures no template was accidentally stripped of its placeholder.
    const expectPlaceholder = (key: string, placeholder: string) => {
      expect(jaImport[key], `ja.import.${key}`).toContain(`{${placeholder}}`)
      expect(enImport[key], `en.import.${key}`).toContain(`{${placeholder}}`)
    }
    expectPlaceholder('errUnsupportedFormat', 'formats')
    expectPlaceholder('errFileTooLarge', 'max')
    expectPlaceholder('acceptedFormats', 'max')
    expectPlaceholder('cardTitle', 'type')
    expectPlaceholder('selectFileAria', 'type')
    expectPlaceholder('rowCount', 'count')
    expectPlaceholder('showingFirst', 'shown')
    expectPlaceholder('showingFirst', 'total')
    expectPlaceholder('showingErrorsOf', 'shown')
    expectPlaceholder('showingErrorsOf', 'total')
    expectPlaceholder('moreCount', 'count')
    expectPlaceholder('moreErrors', 'count')
    expectPlaceholder('partialAlertDesc', 'count')
    expectPlaceholder('warningsTitle', 'count')
    expectPlaceholder('validRows', 'valid')
    expectPlaceholder('validRows', 'total')
    expectPlaceholder('tooltipSuccess', 'count')
    expectPlaceholder('durationMs', 'ms')
    expectPlaceholder('durationSeconds', 's')
    expectPlaceholder('errorListCount', 'label')
    expectPlaceholder('errorListCount', 'count')
    expectPlaceholder('rowPrefix', 'row')
    expectPlaceholder('count', 'n')
    expectPlaceholder('errorsLabel', 'count')
    expectPlaceholder('rowError', 'row')
    expectPlaceholder('rowError', 'message')
  })
})
