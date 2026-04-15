export interface AIError {
  code: string
  message: string
  details?: unknown
  recoverable: boolean
  retryAfter?: number
}

export const ERROR_CODES = {
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    message: '入力データが無効です',
    recoverable: false,
  },
  TOKEN_LIMIT_EXCEEDED: {
    code: 'TOKEN_LIMIT_EXCEEDED',
    message: 'トークン制限を超過しました',
    recoverable: true,
  },
  MODEL_UNAVAILABLE: {
    code: 'MODEL_UNAVAILABLE',
    message: 'モデルが一時的に利用できません',
    recoverable: true,
    retryAfter: 5000,
  },
  ANALYSIS_FAILED: {
    code: 'ANALYSIS_FAILED',
    message: '分析処理に失敗しました',
    recoverable: true,
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    message: '処理がタイムアウトしました',
    recoverable: true,
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: '認証が必要です',
    recoverable: false,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'アクセス権限がありません',
    recoverable: false,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'データが見つかりません',
    recoverable: false,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: '入力バリデーションに失敗しました',
    recoverable: false,
  },
  PARSE_ERROR: {
    code: 'PARSE_ERROR',
    message: 'レスポンスの解析に失敗しました',
    recoverable: true,
  },
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export function createAIError(code: ErrorCode, details?: unknown): AIError {
  const baseError = ERROR_CODES[code]
  return {
    ...baseError,
    details,
  }
}

export function isRecoverableError(error: AIError): boolean {
  return error.recoverable
}

export function getHttpStatus(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    INVALID_INPUT: 400,
    TOKEN_LIMIT_EXCEEDED: 400,
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    ANALYSIS_FAILED: 500,
    PARSE_ERROR: 500,
    MODEL_UNAVAILABLE: 503,
    TIMEOUT: 504,
  }
  return statusMap[code]
}
