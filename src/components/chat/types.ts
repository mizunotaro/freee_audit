import type { PersonaType } from '@/lib/ai/personas/types'

export type ChatWidgetState = 'closed' | 'open' | 'minimized'

export type { ChatProgressStage, ChatProgressState } from './config'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  persona?: PersonaType
  isLoading?: boolean
}

export interface ChatSession {
  id: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

export interface ChatWidgetPosition {
  x: number
  y: number
}

export interface ChatWidgetSize {
  width: number
  height: number
}

export const DEFAULT_WIDGET_SIZE: ChatWidgetSize = {
  width: 380,
  height: 500,
}

export const MIN_WIDGET_SIZE: ChatWidgetSize = {
  width: 300,
  height: 400,
}

export const MAX_WIDGET_SIZE: ChatWidgetSize = {
  width: 600,
  height: 800,
}

export const WIDGET_POSITION_OFFSET = 20
