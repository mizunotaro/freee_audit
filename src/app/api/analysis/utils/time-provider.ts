/**
 * 時間プロバイダーインターフェース
 * テスト時には固定時間を返すモックを使用可能
 */
export interface TimeProvider {
  now(): Date
  timestamp(): string
}

/**
 * システム時間を使用するプロバイダー
 */
export class SystemTimeProvider implements TimeProvider {
  now(): Date {
    return new Date()
  }

  timestamp(): string {
    return new Date().toISOString()
  }
}

/**
 * 固定時間を返すモックプロバイダー（テスト用）
 */
export class MockTimeProvider implements TimeProvider {
  private fixedTime: Date

  constructor(fixedTime: Date) {
    this.fixedTime = fixedTime
  }

  now(): Date {
    return this.fixedTime
  }

  timestamp(): string {
    return this.fixedTime.toISOString()
  }

  advance(ms: number): void {
    this.fixedTime = new Date(this.fixedTime.getTime() + ms)
  }
}

let globalTimeProvider: TimeProvider = new SystemTimeProvider()

/**
 * グローバルな時間プロバイダーを設定（テスト用）
 */
export function setTimeProvider(provider: TimeProvider): void {
  globalTimeProvider = provider
}

/**
 * グローバルな時間プロバイダーをリセット
 */
export function resetTimeProvider(): void {
  globalTimeProvider = new SystemTimeProvider()
}

/**
 * 現在の時間プロバイダーを取得
 */
export function getTimeProvider(): TimeProvider {
  return globalTimeProvider
}
