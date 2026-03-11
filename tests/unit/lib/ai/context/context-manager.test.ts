import { ContextManager, createContextManager } from '@/lib/ai/context/context-manager'
import type { Session, StorageAdapter } from '@/lib/ai/context/context-types'
import { DEFAULT_SESSION_CONFIG } from '@/lib/ai/context/context-types'
import { vi } from 'vitest'

const createMockStorageAdapter = () => {
  const adapter = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
  return adapter as unknown as StorageAdapter & typeof adapter
}

describe('ContextManager', () => {
  describe('createContextManager', () => {
    it('should create context manager instance', () => {
      const manager = createContextManager()
      expect(manager).toBeInstanceOf(ContextManager)
    })

    it('should accept custom options', () => {
      const manager = createContextManager({
        defaultConfig: {
          maxMessages: 100,
          maxTokens: 16000,
        },
      })
      expect(manager).toBeInstanceOf(ContextManager)
    })
  })

  describe('createSession', () => {
    it('should create a new session', async () => {
      const manager = createContextManager()
      const result = await manager.createSession('user-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeDefined()
        expect(result.data.userId).toBe('user-1')
        expect(result.data.id).toMatch(/^sess_/)
        expect(result.data.messages).toEqual([])
        expect(result.data.tokenCount).toBe(0)
      }
    })

    it('should create session with company id', async () => {
      const manager = createContextManager()
      const result = await manager.createSession('user-1', 'company-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.companyId).toBe('company-1')
      }
    })

    it('should create session with custom config', async () => {
      const manager = createContextManager()
      const result = await manager.createSession('user-1', undefined, {
        maxMessages: 20,
        maxTokens: 4000,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.config.maxMessages).toBe(20)
        expect(result.data.config.maxTokens).toBe(4000)
      }
    })

    it('should use default config when not specified', async () => {
      const manager = createContextManager()
      const result = await manager.createSession('user-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.config.maxMessages).toBe(DEFAULT_SESSION_CONFIG.maxMessages)
        expect(result.data.config.maxTokens).toBe(DEFAULT_SESSION_CONFIG.maxTokens)
      }
    })

    it('should persist session via storage adapter', async () => {
      const adapter = createMockStorageAdapter()
      const manager = createContextManager({ storageAdapter: adapter })
      await manager.createSession('user-1')

      expect(adapter.set).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSession', () => {
    it('should return existing session', async () => {
      const manager = createContextManager()
      const createResult = await manager.createSession('user-1')

      expect(createResult.success).toBe(true)
      if (!createResult.success) return

      const result = await manager.getSession(createResult.data.id)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(createResult.data.id)
      }
    })

    it('should return error for non-existent session', async () => {
      const manager = createContextManager()
      const result = await manager.getSession('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('session_not_found')
      }
    })

    it('should load session from storage adapter if not in memory', async () => {
      const adapter = createMockStorageAdapter()
      const storedSession: Session = {
        id: 'stored-session-1',
        userId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
        entities: [],
        tokenCount: 0,
        config: DEFAULT_SESSION_CONFIG,
      }
      adapter.get.mockResolvedValue(storedSession)

      const manager = createContextManager({ storageAdapter: adapter })
      const result = await manager.getSession('stored-session-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('stored-session-1')
      }
    })

    it('should return error for expired session', async () => {
      const manager = createContextManager({
        defaultConfig: { ttlMs: 1, maxMessages: 50, maxTokens: 8000, compressionThreshold: 0.8 },
      })
      const createResult = await manager.createSession('user-1')

      expect(createResult.success).toBe(true)
      if (!createResult.success) return

      await new Promise((resolve) => setTimeout(resolve, 10))
      const result = await manager.getSession(createResult.data.id)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('session_expired')
      }
    })
  })

  describe('addMessage', () => {
    it('should add message to session', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'user', 'Hello')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages).toHaveLength(1)
        expect(result.data.messages[0].content).toBe('Hello')
        expect(result.data.messages[0].role).toBe('user')
      }
    })

    it('should add assistant message', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'assistant', 'Hi there!')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages[0].role).toBe('assistant')
      }
    })

    it('should add system message', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'system', 'System message')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages[0].role).toBe('system')
      }
    })

    it('should update token count', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'user', 'Hello world')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.tokenCount).toBeGreaterThan(0)
      }
    })

    it('should return error for non-existent session', async () => {
      const manager = createContextManager()
      const result = await manager.addMessage('non-existent', 'user', 'Hello')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('session_not_found')
      }
    })

    it('should add message with persona', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'assistant', 'Response', {
        persona: 'cpa',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages[0].persona).toBe('cpa')
      }
    })

    it('should add message with metadata', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'user', 'Hello', {
        metadata: { source: 'web' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages[0].metadata).toEqual({ source: 'web' })
      }
    })

    it('should trim messages when exceeding max messages', async () => {
      const manager = createContextManager({
        defaultConfig: {
          maxMessages: 3,
          maxTokens: 8000,
          ttlMs: 86400000,
          compressionThreshold: 0.8,
        },
      })
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'system', 'System')
      await manager.addMessage(session.data.id, 'user', 'Message 1')
      await manager.addMessage(session.data.id, 'assistant', 'Response 1')
      await manager.addMessage(session.data.id, 'user', 'Message 2')
      await manager.addMessage(session.data.id, 'assistant', 'Response 2')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages.length).toBeLessThanOrEqual(3)
      }
    })

    it('should preserve system messages when trimming', async () => {
      const manager = createContextManager({
        defaultConfig: {
          maxMessages: 2,
          maxTokens: 8000,
          ttlMs: 86400000,
          compressionThreshold: 0.8,
        },
      })
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'system', 'System')
      await manager.addMessage(session.data.id, 'user', 'Message 1')
      await manager.addMessage(session.data.id, 'user', 'Message 2')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const systemMessages = result.data.messages.filter((m) => m.role === 'system')
        expect(systemMessages).toHaveLength(1)
      }
    })

    it('should extract entities from user messages', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', '2024年度の売上を教えて')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.entities.length).toBeGreaterThan(0)
        expect(result.data.entities[0].type).toBe('period')
      }
    })

    it('should extract amount entities', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', '売上は1000万円です')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const amountEntities = result.data.entities.filter((e) => e.type === 'amount')
        expect(amountEntities.length).toBeGreaterThan(0)
      }
    })
  })

  describe('deleteSession', () => {
    it('should delete existing session', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.deleteSession(session.data.id)

      expect(result.success).toBe(true)
      const getResult = await manager.getSession(session.data.id)
      expect(getResult.success).toBe(false)
    })

    it('should delete session from storage adapter', async () => {
      const adapter = createMockStorageAdapter()
      const manager = createContextManager({ storageAdapter: adapter })
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.deleteSession(session.data.id)

      expect(adapter.delete).toHaveBeenCalledWith(session.data.id)
    })
  })

  describe('checkContextFit', () => {
    it('should return fits true when tokens fit', async () => {
      const manager = createContextManager({
        defaultConfig: {
          maxMessages: 50,
          maxTokens: 1000,
          ttlMs: 86400000,
          compressionThreshold: 0.8,
        },
      })
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', 'Hello')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const fitResult = manager.checkContextFit(result.data, 10)
        expect(fitResult.fits).toBe(true)
        expect(fitResult.tokensToTrim).toBe(0)
      }
    })

    it('should return fits false when tokens exceed limit', async () => {
      const manager = createContextManager({
        defaultConfig: {
          maxMessages: 50,
          maxTokens: 10,
          ttlMs: 86400000,
          compressionThreshold: 0.8,
        },
      })
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(
        session.data.id,
        'user',
        'This is a longer message that exceeds the limit'
      )

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const fitResult = manager.checkContextFit(result.data, 100)
        expect(fitResult.fits).toBe(false)
        expect(fitResult.tokensToTrim).toBeGreaterThan(0)
      }
    })

    it('should suggest compression when threshold reached', async () => {
      const manager = createContextManager({
        defaultConfig: {
          maxMessages: 50,
          maxTokens: 50,
          ttlMs: 86400000,
          compressionThreshold: 0.5,
        },
      })
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(
        session.data.id,
        'user',
        'Test message content here with enough tokens to exceed threshold'
      )

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const fitResult = manager.checkContextFit(result.data, 30)
        expect(fitResult.suggestedCompression).toBe(true)
      }
    })
  })

  describe('getRelevantContext', () => {
    it('should return relevant messages based on query', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', '財務分析について')
      await manager.addMessage(session.data.id, 'assistant', '財務分析の回答')
      await manager.addMessage(session.data.id, 'user', '税務について')
      await manager.addMessage(session.data.id, 'assistant', '税務の回答')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const relevant = manager.getRelevantContext(result.data, '財務', 1000)
        expect(relevant.length).toBeGreaterThan(0)
      }
    })

    it('should respect max tokens limit', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', 'First message with some content')
      await manager.addMessage(session.data.id, 'user', 'Second message with more content')
      await manager.addMessage(session.data.id, 'user', 'Third message')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const relevant = manager.getRelevantContext(result.data, 'message', 20)
        let totalTokens = 0
        for (const msg of relevant) {
          totalTokens += msg.tokenCount
        }
        expect(totalTokens).toBeLessThanOrEqual(20)
      }
    })
  })

  describe('compressContext', () => {
    it('should compress context', async () => {
      const manager = createContextManager({
        defaultConfig: {
          maxMessages: 50,
          maxTokens: 1000,
          ttlMs: 86400000,
          compressionThreshold: 0.8,
        },
      })
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      for (let i = 0; i < 10; i++) {
        await manager.addMessage(session.data.id, 'user', `Message number ${i}`)
        await manager.addMessage(session.data.id, 'assistant', `Response number ${i}`)
      }

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const compression = manager.compressContext(result.data)
        expect(compression.originalTokenCount).toBeGreaterThan(0)
        expect(compression.compressedTokenCount).toBeLessThanOrEqual(compression.originalTokenCount)
      }
    })

    it('should return compression ratio', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', 'Test message')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const compression = manager.compressContext(result.data)
        expect(compression.compressionRatio).toBeGreaterThanOrEqual(0)
        expect(compression.compressionRatio).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('getEntities', () => {
    it('should return all entities when type not specified', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', '2024年度の100万円について')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const entities = manager.getEntities(result.data)
        expect(entities.length).toBeGreaterThan(0)
      }
    })

    it('should filter entities by type', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      await manager.addMessage(session.data.id, 'user', '2024年度の100万円について')

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
      if (result.success) {
        const periodEntities = manager.getEntities(result.data, 'period')
        expect(periodEntities.every((e) => e.type === 'period')).toBe(true)
      }
    })
  })

  describe('stability', () => {
    it('should handle null content gracefully', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'user', null as unknown as string)

      expect(result.success).toBe(true)
    })

    it('should handle empty content', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'user', '')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages[0].tokenCount).toBe(0)
      }
    })

    it('should handle concurrent access to same session', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const promises = [
        manager.addMessage(session.data.id, 'user', 'Message 1'),
        manager.addMessage(session.data.id, 'user', 'Message 2'),
        manager.addMessage(session.data.id, 'user', 'Message 3'),
      ]

      await Promise.all(promises)

      const result = await manager.getSession(session.data.id)
      expect(result.success).toBe(true)
    })
  })

  describe('security', () => {
    it('should isolate sessions between users', async () => {
      const manager = createContextManager()

      const session1 = await manager.createSession('user-1')
      const session2 = await manager.createSession('user-2')

      expect(session1.success).toBe(true)
      expect(session2.success).toBe(true)
      if (!session1.success || !session2.success) return

      await manager.addMessage(session1.data.id, 'user', 'User 1 message')

      const result2 = await manager.getSession(session2.data.id)
      expect(result2.success).toBe(true)
      if (result2.success) {
        expect(result2.data.messages).toHaveLength(0)
      }
    })

    it('should store content as-is (sanitization handled by token-counter)', async () => {
      const manager = createContextManager()
      const session = await manager.createSession('user-1')

      expect(session.success).toBe(true)
      if (!session.success) return

      const result = await manager.addMessage(session.data.id, 'user', 'Hello\x00\x01\x02World')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.messages[0].content).toBeDefined()
        expect(result.data.messages[0].tokenCount).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('storage adapter integration', () => {
    it('should fallback gracefully when storage fails', async () => {
      const adapter = createMockStorageAdapter()
      adapter.set.mockRejectedValue(new Error('Storage error'))

      const manager = createContextManager({ storageAdapter: adapter })
      const result = await manager.createSession('user-1')

      expect(result.success).toBe(true)
    })

    it('should continue when storage get returns null', async () => {
      const adapter = createMockStorageAdapter()
      adapter.get.mockResolvedValue(null)

      const manager = createContextManager({ storageAdapter: adapter })
      const result = await manager.getSession('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('session_not_found')
      }
    })
  })
})
