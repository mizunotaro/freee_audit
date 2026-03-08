import type {
  Session,
  ContextMessage,
  TrackedEntity,
  SessionConfig,
  ContextManagerOptions,
  AddMessageOptions,
  ContextFitResult,
  CompressionResult,
  ContextResult,
  StorageAdapter,
} from './context-types'
import { DEFAULT_SESSION_CONFIG } from './context-types'
import { countTokens } from './token-counter'

export class ContextManager {
  private readonly sessions: Map<string, Session> = new Map()
  private readonly defaultConfig: SessionConfig
  private readonly storageAdapter?: StorageAdapter

  constructor(options: ContextManagerOptions = {}) {
    this.defaultConfig = {
      maxMessages: options.defaultConfig?.maxMessages ?? DEFAULT_SESSION_CONFIG.maxMessages,
      maxTokens: options.defaultConfig?.maxTokens ?? DEFAULT_SESSION_CONFIG.maxTokens,
      ttlMs: options.defaultConfig?.ttlMs ?? DEFAULT_SESSION_CONFIG.ttlMs,
      compressionThreshold:
        options.defaultConfig?.compressionThreshold ?? DEFAULT_SESSION_CONFIG.compressionThreshold,
    }
    this.storageAdapter = options.storageAdapter
  }

  async createSession(
    userId: string,
    companyId?: string,
    config?: Partial<SessionConfig>
  ): Promise<ContextResult<Session>> {
    const sessionId = generateSessionId()
    const sessionConfig: SessionConfig = { ...this.defaultConfig, ...config }

    const session: Session = {
      id: sessionId,
      userId,
      companyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      entities: [],
      tokenCount: 0,
      config: sessionConfig,
    }

    this.sessions.set(sessionId, session)
    await this.persistSession(session)

    return { success: true, data: session }
  }

  async getSession(sessionId: string): Promise<ContextResult<Session>> {
    let session = this.sessions.get(sessionId)

    if (!session && this.storageAdapter) {
      const stored = await this.storageAdapter.get(sessionId)
      if (stored) {
        session = stored
        this.sessions.set(sessionId, stored)
      }
    }

    if (!session) {
      return {
        success: false,
        error: { code: 'session_not_found', message: `Session ${sessionId} not found` },
      }
    }

    if (this.isSessionExpired(session)) {
      await this.deleteSession(sessionId)
      return {
        success: false,
        error: { code: 'session_expired', message: 'Session has expired' },
      }
    }

    return { success: true, data: session }
  }

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    options?: AddMessageOptions
  ): Promise<ContextResult<Session>> {
    const sessionResult = await this.getSession(sessionId)
    if (!sessionResult.success) return sessionResult

    const session = sessionResult.data
    const tokenCount = countTokens(content)

    const message: ContextMessage = {
      id: generateMessageId(),
      role,
      content,
      timestamp: new Date(),
      tokenCount,
      persona: options?.persona,
      metadata: options?.metadata,
    }

    let updatedMessages = [...session.messages, message]
    let updatedTokenCount = session.tokenCount + tokenCount
    let entities = session.entities

    if (updatedMessages.length > session.config.maxMessages) {
      const trimmed = this.trimMessages(updatedMessages, session.config.maxMessages)
      updatedMessages = trimmed.messages
      updatedTokenCount = this.calculateTokenCount(updatedMessages)
    }

    if (updatedTokenCount > session.config.maxTokens * session.config.compressionThreshold) {
      const compression = this.compressMessages(updatedMessages, session.config.maxTokens)
      updatedMessages = compression.messages
      updatedTokenCount = compression.tokenCount
    }

    if (role === 'user') {
      entities = this.extractAndUpdateEntities(content, entities)
    }

    const updatedSession: Session = {
      ...session,
      messages: updatedMessages,
      entities,
      tokenCount: updatedTokenCount,
      updatedAt: new Date(),
    }

    this.sessions.set(sessionId, updatedSession)
    await this.persistSession(updatedSession)

    return { success: true, data: updatedSession }
  }

  async deleteSession(sessionId: string): Promise<ContextResult<void>> {
    this.sessions.delete(sessionId)

    if (this.storageAdapter) {
      await this.storageAdapter.delete(sessionId)
    }

    return { success: true, data: undefined }
  }

  checkContextFit(session: Session, additionalTokens: number): ContextFitResult {
    const projectedTokens = session.tokenCount + additionalTokens
    const maxTokens = session.config.maxTokens

    const fits = projectedTokens <= maxTokens
    const tokensToTrim = fits ? 0 : projectedTokens - maxTokens
    const messagesToFit = this.countMessagesToFit(session.messages, maxTokens - additionalTokens)

    return {
      fits,
      messagesToFit,
      tokensToTrim,
      suggestedCompression: projectedTokens > maxTokens * session.config.compressionThreshold,
    }
  }

  getRelevantContext(session: Session, query: string, maxTokens: number): ContextMessage[] {
    const queryKeywords = this.extractKeywords(query)
    const scoredMessages = session.messages.map((msg) => ({
      message: msg,
      score: this.calculateRelevanceScore(msg, queryKeywords),
    }))

    scoredMessages.sort((a, b) => b.score - a.score)

    const selectedMessages: ContextMessage[] = []
    let tokenSum = 0

    for (const { message } of scoredMessages) {
      if (tokenSum + message.tokenCount <= maxTokens) {
        selectedMessages.push(message)
        tokenSum += message.tokenCount
      }
    }

    return selectedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  compressContext(session: Session): CompressionResult {
    const result = this.compressMessages(session.messages, session.config.maxTokens)
    return {
      originalTokenCount: session.tokenCount,
      compressedTokenCount: result.tokenCount,
      compressionRatio: session.tokenCount > 0 ? result.tokenCount / session.tokenCount : 1,
      summary: result.summary,
    }
  }

  getEntities(session: Session, type?: TrackedEntity['type']): TrackedEntity[] {
    if (!type) return [...session.entities]
    return session.entities.filter((e) => e.type === type)
  }

  private isSessionExpired(session: Session): boolean {
    const age = Date.now() - session.updatedAt.getTime()
    return age > session.config.ttlMs
  }

  private trimMessages(
    messages: readonly ContextMessage[],
    maxCount: number
  ): { messages: ContextMessage[]; removedCount: number } {
    if (messages.length <= maxCount) {
      return { messages: [...messages], removedCount: 0 }
    }

    const systemMessages = messages.filter((m) => m.role === 'system')
    const otherMessages = messages.filter((m) => m.role !== 'system')
    const keepCount = maxCount - systemMessages.length

    const trimmedOther = otherMessages.slice(-keepCount)
    const ordered = this.orderMessages([...systemMessages, ...trimmedOther])

    return {
      messages: ordered,
      removedCount: messages.length - ordered.length,
    }
  }

  private compressMessages(
    messages: readonly ContextMessage[],
    maxTokens: number
  ): { messages: ContextMessage[]; tokenCount: number; summary?: string } {
    if (messages.length === 0) {
      return { messages: [], tokenCount: 0 }
    }

    const systemMessages = messages.filter((m) => m.role === 'system')
    const conversationMessages = messages.filter((m) => m.role !== 'system')

    if (conversationMessages.length <= 2) {
      return {
        messages: [...messages],
        tokenCount: this.calculateTokenCount(messages),
      }
    }

    const recentMessages = conversationMessages.slice(-4)
    const olderMessages = conversationMessages.slice(0, -4)

    const summary = this.generateConversationSummary(olderMessages)
    const summaryTokenCount = countTokens(summary)

    const summaryMessage: ContextMessage = {
      id: generateMessageId(),
      role: 'system',
      content: `[Previous conversation summary]\n${summary}`,
      timestamp: olderMessages[0]?.timestamp ?? new Date(),
      tokenCount: summaryTokenCount,
    }

    const compressed = [...systemMessages, summaryMessage, ...recentMessages]
    const tokenCount = this.calculateTokenCount(compressed)

    if (tokenCount > maxTokens) {
      const fitted = this.fitToTokenLimit(compressed, maxTokens)
      return { messages: fitted.messages, tokenCount: fitted.tokenCount }
    }

    return { messages: compressed, tokenCount, summary }
  }

  private fitToTokenLimit(
    messages: ContextMessage[],
    maxTokens: number
  ): { messages: ContextMessage[]; tokenCount: number } {
    const systemMessages = messages.filter((m) => m.role === 'system')
    const otherMessages = messages.filter((m) => m.role !== 'system')

    const selectedOther: ContextMessage[] = []
    let tokenSum = this.calculateTokenCount(systemMessages)

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      if (tokenSum + otherMessages[i].tokenCount <= maxTokens) {
        selectedOther.unshift(otherMessages[i])
        tokenSum += otherMessages[i].tokenCount
      } else {
        break
      }
    }

    const fitted = this.orderMessages([...systemMessages, ...selectedOther])
    return { messages: fitted, tokenCount: this.calculateTokenCount(fitted) }
  }

  private generateConversationSummary(messages: readonly ContextMessage[]): string {
    if (messages.length === 0) return ''

    const userQueries = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content.slice(0, 100))
      .slice(0, 3)

    const keyTopics = userQueries.map((q) => `- ${q}`).join('\n')

    return `Discussed topics:\n${keyTopics}`
  }

  private orderMessages(messages: ContextMessage[]): ContextMessage[] {
    return [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  private calculateTokenCount(messages: readonly ContextMessage[]): number {
    return messages.reduce((sum, m) => sum + m.tokenCount, 0)
  }

  private countMessagesToFit(messages: readonly ContextMessage[], maxTokens: number): number {
    let count = 0
    let tokenSum = 0

    for (let i = messages.length - 1; i >= 0; i--) {
      if (tokenSum + messages[i].tokenCount <= maxTokens) {
        count++
        tokenSum += messages[i].tokenCount
      } else {
        break
      }
    }

    return count
  }

  private extractAndUpdateEntities(
    content: string,
    existingEntities: readonly TrackedEntity[]
  ): TrackedEntity[] {
    const extracted = this.extractEntities(content)
    const updated = [...existingEntities]
    const now = new Date()

    for (const entity of extracted) {
      const existingIndex = updated.findIndex((e) => e.id === entity.id)

      if (existingIndex >= 0) {
        updated[existingIndex] = {
          ...updated[existingIndex],
          lastMentioned: now,
          mentionCount: updated[existingIndex].mentionCount + 1,
        }
      } else {
        updated.push({
          ...entity,
          firstMentioned: now,
          lastMentioned: now,
          mentionCount: 1,
        })
      }
    }

    return updated
  }

  private extractEntities(
    content: string
  ): Omit<TrackedEntity, 'firstMentioned' | 'lastMentioned' | 'mentionCount'>[] {
    const entities: Omit<TrackedEntity, 'firstMentioned' | 'lastMentioned' | 'mentionCount'>[] = []

    const periodPatterns = [/(\d{4})年度?/g, /(\d{4})[/-](\d{1,2})月?/g, /(第\d四半期|Q[1-4])/gi]

    for (const pattern of periodPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        entities.push({
          id: `period_${match[0]}`,
          type: 'period',
          name: match[0],
          value: match[0],
        })
      }
    }

    const amountPattern = /([¥￥$]?\s*[\d,]+(?:\.\d+)?(?:万|億|兆)?(?:円|ドル)?)/g
    let amountMatch
    while ((amountMatch = amountPattern.exec(content)) !== null) {
      entities.push({
        id: `amount_${amountMatch[0]}`,
        type: 'amount',
        name: amountMatch[0],
        value: amountMatch[0],
      })
    }

    return entities
  }

  private extractKeywords(text: string): Set<string> {
    const words = text.toLowerCase().split(/[\s\u3000、。!?！？]+/)
    return new Set(words.filter((w) => w.length >= 2))
  }

  private calculateRelevanceScore(message: ContextMessage, queryKeywords: Set<string>): number {
    const messageWords = this.extractKeywords(message.content)
    let matchCount = 0

    for (const keyword of queryKeywords) {
      if (messageWords.has(keyword)) {
        matchCount++
      }
    }

    const recencyBonus = Math.max(
      0,
      1 - (Date.now() - message.timestamp.getTime()) / (30 * 60 * 1000)
    )

    return matchCount / Math.max(1, queryKeywords.size) + recencyBonus * 0.2
  }

  private async persistSession(session: Session): Promise<void> {
    if (this.storageAdapter) {
      await this.storageAdapter.set(session.id, session)
    }
  }
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createContextManager(options?: ContextManagerOptions): ContextManager {
  return new ContextManager(options)
}
