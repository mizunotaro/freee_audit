export type ChatProgressStage =
  | 'idle'
  | 'connecting'
  | 'analyzing'
  | 'searching'
  | 'synthesizing'
  | 'generating'
  | 'complete'
  | 'error'

export interface ChatProgressState {
  stage: ChatProgressStage
  progress: number
  message: string
  subMessage?: string
  startTime: number
  estimatedRemainingMs?: number
}

export interface ChatWidgetConfig {
  connectionTimeoutMs: number
  processingTimeoutMs: number
  streamingChunkMs: number
  maxMessageLength: number
  enableProgressAnimation: boolean
}

export const DEFAULT_CHAT_CONFIG: ChatWidgetConfig = {
  connectionTimeoutMs: 10000,
  processingTimeoutMs: 120000,
  streamingChunkMs: 30000,
  maxMessageLength: 4000,
  enableProgressAnimation: true,
}

export const PROGRESS_STAGES: Record<
  ChatProgressStage,
  { label: string; description: string; weight: number }
> = {
  idle: { label: '待機中', description: '', weight: 0 },
  connecting: { label: '接続中', description: 'サーバーに接続しています...', weight: 0.1 },
  analyzing: { label: '分析中', description: '質問を分析しています...', weight: 0.2 },
  searching: { label: '検索中', description: '関連情報を検索しています...', weight: 0.3 },
  synthesizing: { label: '統合中', description: '情報を統合しています...', weight: 0.2 },
  generating: { label: '生成中', description: '回答を生成しています...', weight: 0.2 },
  complete: { label: '完了', description: '', weight: 0 },
  error: { label: 'エラー', description: '', weight: 0 },
}

export function calculateProgress(stage: ChatProgressStage, elapsedMs: number): number {
  const stages: ChatProgressStage[] = [
    'connecting',
    'analyzing',
    'searching',
    'synthesizing',
    'generating',
  ]
  const stageIndex = stages.indexOf(stage)

  if (stageIndex === -1) {
    return stage === 'complete' ? 100 : 0
  }

  let baseProgress = 0
  for (let i = 0; i < stageIndex; i++) {
    baseProgress += PROGRESS_STAGES[stages[i]].weight * 100
  }

  const currentStageWeight = PROGRESS_STAGES[stage].weight * 100
  const stageElapsed = Math.min(elapsedMs / 10000, 1)
  const stageProgress = currentStageWeight * stageElapsed

  return Math.min(Math.round(baseProgress + stageProgress), 95)
}

export function estimateRemaining(elapsedMs: number, avgProcessingMs: number): number | undefined {
  if (elapsedMs < 3000) return undefined

  const remaining = avgProcessingMs - elapsedMs
  return remaining > 0 ? remaining : undefined
}
