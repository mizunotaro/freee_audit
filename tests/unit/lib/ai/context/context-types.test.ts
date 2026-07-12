import { describe, it, expect } from 'vitest'
import { DEFAULT_SESSION_CONFIG } from '@/lib/ai/context/context-types'
import type {
  SessionConfig,
  MessageRole,
  ContextMessage,
  TrackedEntity,
  SessionSummary,
  Session,
  ContextManagerOptions,
  StorageAdapter,
  AddMessageOptions,
  ContextFitResult,
  CompressionResult,
  ContextResult,
} from '@/lib/ai/context/context-types'
import type { PersonaType } from '@/lib/ai/personas/types'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

describe('src/lib/ai/context/context-types', () => {
  describe('DEFAULT_SESSION_CONFIG', () => {
    it('caps maxMessages at 50', () => {
      expect(DEFAULT_SESSION_CONFIG.maxMessages).toBe(50)
    })

    it('caps maxTokens at 8000', () => {
      expect(DEFAULT_SESSION_CONFIG.maxTokens).toBe(8000)
    })

    it('sets ttlMs to exactly one day (boundary)', () => {
      expect(DEFAULT_SESSION_CONFIG.ttlMs).toBe(ONE_DAY_MS)
      expect(DEFAULT_SESSION_CONFIG.ttlMs).toBe(86_400_000)
    })

    it('sets compressionThreshold to 0.8', () => {
      expect(DEFAULT_SESSION_CONFIG.compressionThreshold).toBe(0.8)
    })

    it('exposes exactly the four SessionConfig keys', () => {
      expect(Object.keys(DEFAULT_SESSION_CONFIG).sort()).toEqual([
        'compressionThreshold',
        'maxMessages',
        'maxTokens',
        'ttlMs',
      ])
    })

    it('keeps every bound positive and the threshold within (0, 1] (fail-safe defaults)', () => {
      expect(DEFAULT_SESSION_CONFIG.maxMessages).toBeGreaterThan(0)
      expect(DEFAULT_SESSION_CONFIG.maxTokens).toBeGreaterThan(0)
      expect(DEFAULT_SESSION_CONFIG.ttlMs).toBeGreaterThan(0)
      expect(DEFAULT_SESSION_CONFIG.compressionThreshold).toBeGreaterThan(0)
      expect(DEFAULT_SESSION_CONFIG.compressionThreshold).toBeLessThanOrEqual(1)
    })

    it('satisfies the SessionConfig type', () => {
      expectTypeOf(DEFAULT_SESSION_CONFIG).toMatchTypeOf<SessionConfig>()
    })

    it('declares every field as a number at the type level', () => {
      expectTypeOf<SessionConfig['maxMessages']>().toEqualTypeOf<number>()
      expectTypeOf<SessionConfig['maxTokens']>().toEqualTypeOf<number>()
      expectTypeOf<SessionConfig['ttlMs']>().toEqualTypeOf<number>()
      expectTypeOf<SessionConfig['compressionThreshold']>().toEqualTypeOf<number>()
    })
  })

  describe('SessionConfig', () => {
    it('accepts a fully-populated object', () => {
      const config: SessionConfig = {
        maxMessages: 100,
        maxTokens: 16000,
        ttlMs: ONE_DAY_MS,
        compressionThreshold: 0.9,
      }
      expect(config.maxMessages).toBe(100)
      expect(config.maxTokens).toBe(16000)
      expect(config.ttlMs).toBe(ONE_DAY_MS)
      expect(config.compressionThreshold).toBe(0.9)
    })

    it('accepts boundary zero-values that a caller might still configure', () => {
      const config: SessionConfig = {
        maxMessages: 1,
        maxTokens: 1,
        ttlMs: 1,
        compressionThreshold: 0,
      }
      expect(config.maxMessages).toBe(1)
      expect(config.compressionThreshold).toBe(0)
    })

    it('matches the SessionConfig type', () => {
      const config: SessionConfig = DEFAULT_SESSION_CONFIG
      expectTypeOf(config).toMatchTypeOf<SessionConfig>()
    })
  })

  describe('MessageRole', () => {
    it('type is exactly the user/assistant/system union', () => {
      expectTypeOf<MessageRole['type']>().toEqualTypeOf<'user' | 'assistant' | 'system'>()
    })

    it('accepts each role literal as a runtime value', () => {
      const user: MessageRole['type'] = 'user'
      const assistant: MessageRole['type'] = 'assistant'
      const system: MessageRole['type'] = 'system'
      expect(user).toBe('user')
      expect(assistant).toBe('assistant')
      expect(system).toBe('system')
    })

    it('makes persona optional and typed as PersonaType', () => {
      const withoutPersona: MessageRole = { type: 'user' }
      const withPersona: MessageRole = { type: 'assistant', persona: 'cpa' }
      expect(withoutPersona.persona).toBeUndefined()
      expect(withPersona.persona).toBe('cpa')
      expectTypeOf<MessageRole['persona']>().toEqualTypeOf<PersonaType | undefined>()
    })
  })

  describe('ContextMessage', () => {
    it('accepts the minimal required shape (persona/metadata omitted)', () => {
      const msg: ContextMessage = {
        id: 'm1',
        role: 'user',
        content: 'hello',
        timestamp: new Date(0),
        tokenCount: 0,
      }
      expect(msg.id).toBe('m1')
      expect(msg.role).toBe('user')
      expect(msg.content).toBe('hello')
      expect(msg.timestamp).toEqual(new Date(0))
      expect(msg.tokenCount).toBe(0)
      expect(msg.persona).toBeUndefined()
      expect(msg.metadata).toBeUndefined()
    })

    it('accepts the full shape with persona and metadata', () => {
      const msg: ContextMessage = {
        id: 'm2',
        role: 'assistant',
        content: 'response',
        timestamp: new Date(1),
        tokenCount: 42,
        persona: 'cfo',
        metadata: { source: 'test', weight: 2 },
      }
      expect(msg.persona).toBe('cfo')
      expect(msg.metadata).toEqual({ source: 'test', weight: 2 })
    })

    it('accepts an empty metadata record (boundary)', () => {
      const msg: ContextMessage = {
        id: 'm3',
        role: 'system',
        content: '',
        timestamp: new Date(0),
        tokenCount: 0,
        metadata: {},
      }
      expect(msg.metadata).toEqual({})
      expect(msg.content).toBe('')
    })

    it('allows every MessageRole type literal as the role', () => {
      const roles: ContextMessage['role'][] = ['user', 'assistant', 'system']
      expect(roles).toHaveLength(3)
    })
  })

  describe('TrackedEntity', () => {
    it('type is exactly the six-member entity union', () => {
      expectTypeOf<TrackedEntity['type']>().toEqualTypeOf<
        'company' | 'period' | 'account' | 'amount' | 'ratio' | 'concept'
      >()
    })

    it('accepts every entity type literal at runtime', () => {
      const types: TrackedEntity['type'][] = [
        'company',
        'period',
        'account',
        'amount',
        'ratio',
        'concept',
      ]
      expect(types).toHaveLength(6)
    })

    it('accepts an entity without an optional value', () => {
      const entity: TrackedEntity = {
        id: 'e1',
        type: 'concept',
        name: '流動比率',
        firstMentioned: new Date(0),
        lastMentioned: new Date(1),
        mentionCount: 1,
      }
      expect(entity.value).toBeUndefined()
    })

    it('accepts value as a string or as a number', () => {
      const asString: TrackedEntity = {
        id: 'e2',
        type: 'company',
        name: '株式会社サンプル',
        value: '東証プライム',
        firstMentioned: new Date(0),
        lastMentioned: new Date(0),
        mentionCount: 2,
      }
      const asNumber: TrackedEntity = {
        id: 'e3',
        type: 'amount',
        name: '売上',
        value: 1_000_000,
        firstMentioned: new Date(0),
        lastMentioned: new Date(0),
        mentionCount: 3,
      }
      expect(asString.value).toBe('東証プライム')
      expect(asNumber.value).toBe(1_000_000)
      expectTypeOf<TrackedEntity['value']>().toEqualTypeOf<string | number | undefined>()
    })

    it('accepts mentionCount of zero (boundary)', () => {
      const entity: TrackedEntity = {
        id: 'e4',
        type: 'period',
        name: '2024年度',
        firstMentioned: new Date(0),
        lastMentioned: new Date(0),
        mentionCount: 0,
      }
      expect(entity.mentionCount).toBe(0)
    })
  })

  describe('SessionSummary', () => {
    it('sentiment is exactly the positive/neutral/negative union', () => {
      expectTypeOf<SessionSummary['sentiment']>().toEqualTypeOf<
        'positive' | 'neutral' | 'negative'
      >()
    })

    it('accepts each sentiment literal at runtime', () => {
      const sentiments: SessionSummary['sentiment'][] = ['positive', 'neutral', 'negative']
      expect(sentiments).toHaveLength(3)
    })

    it('accepts a summary with empty readonly arrays (boundary)', () => {
      const summary: SessionSummary = {
        mainTopic: '決算分析',
        keyEntities: [],
        sentiment: 'neutral',
        topicCategories: [],
      }
      expect(summary.mainTopic).toBe('決算分析')
      expect(summary.keyEntities).toHaveLength(0)
      expect(summary.topicCategories).toHaveLength(0)
    })
  })

  describe('Session', () => {
    const makeSession = (): Session => ({
      id: 's1',
      userId: 'u1',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      messages: [],
      entities: [],
      tokenCount: 0,
      config: DEFAULT_SESSION_CONFIG,
    })

    it('accepts a minimal session with empty messages/entities (boundary)', () => {
      const session = makeSession()
      expect(session.id).toBe('s1')
      expect(session.userId).toBe('u1')
      expect(session.companyId).toBeUndefined()
      expect(session.summary).toBeUndefined()
      expect(session.messages).toHaveLength(0)
      expect(session.entities).toHaveLength(0)
      expect(session.tokenCount).toBe(0)
      expect(session.config).toBe(DEFAULT_SESSION_CONFIG)
    })

    it('accepts an optional companyId and summary', () => {
      const session: Session = {
        ...makeSession(),
        companyId: 'c1',
        summary: {
          mainTopic: 'topic',
          keyEntities: ['company'],
          sentiment: 'positive',
          topicCategories: ['analysis'],
        },
      }
      expect(session.companyId).toBe('c1')
      expect(session.summary?.sentiment).toBe('positive')
    })

    it('declares messages/entities as readonly arrays of the element types', () => {
      expectTypeOf<Session['messages']>().toEqualTypeOf<readonly ContextMessage[]>()
      expectTypeOf<Session['entities']>().toEqualTypeOf<readonly TrackedEntity[]>()
    })
  })

  describe('ContextManagerOptions', () => {
    it('accepts an empty object (every field optional)', () => {
      const opts: ContextManagerOptions = {}
      expect(opts.defaultConfig).toBeUndefined()
      expect(opts.storageAdapter).toBeUndefined()
    })

    it('accepts a partial defaultConfig (Partial<SessionConfig>)', () => {
      const opts: ContextManagerOptions = { defaultConfig: { maxMessages: 10 } }
      expect(opts.defaultConfig?.maxMessages).toBe(10)
    })

    it('accepts a storageAdapter alongside defaultConfig', () => {
      const adapter: StorageAdapter = {
        get: async () => null,
        set: async () => undefined,
        delete: async () => undefined,
      }
      const opts: ContextManagerOptions = {
        defaultConfig: { maxTokens: 1000 },
        storageAdapter: adapter,
      }
      expect(opts.storageAdapter).toBe(adapter)
    })
  })

  describe('StorageAdapter', () => {
    const createInMemoryAdapter = (): StorageAdapter => {
      const store = new Map<string, Session>()
      return {
        get: async (id) => store.get(id) ?? null,
        set: async (id, session) => {
          store.set(id, session)
        },
        delete: async (id) => {
          store.delete(id)
        },
      }
    }

    const makeSession = (): Session => ({
      id: 's1',
      userId: 'u1',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      messages: [],
      entities: [],
      tokenCount: 0,
      config: DEFAULT_SESSION_CONFIG,
    })

    it('get resolves to null for a missing session (safe not-found state)', async () => {
      const adapter = createInMemoryAdapter()
      await expect(adapter.get('missing')).resolves.toBeNull()
    })

    it('round-trips a session through set then get', async () => {
      const adapter = createInMemoryAdapter()
      const session = makeSession()
      await adapter.set('s1', session)
      const fetched = await adapter.get('s1')
      expect(fetched).not.toBeNull()
      expect(fetched?.id).toBe('s1')
      expect(fetched?.userId).toBe('u1')
    })

    it('set returns void', async () => {
      const adapter = createInMemoryAdapter()
      await expect(adapter.set('s1', makeSession())).resolves.toBeUndefined()
    })

    it('delete removes a stored session', async () => {
      const adapter = createInMemoryAdapter()
      await adapter.set('s1', makeSession())
      await adapter.delete('s1')
      await expect(adapter.get('s1')).resolves.toBeNull()
    })

    it('delete on a missing session resolves without throwing (idempotent fail-safe)', async () => {
      const adapter = createInMemoryAdapter()
      await expect(adapter.delete('never-existed')).resolves.toBeUndefined()
    })

    it('declares the three methods as functions returning promises', () => {
      const adapter: StorageAdapter = createInMemoryAdapter()
      expectTypeOf(adapter.get).toEqualTypeOf<(sessionId: string) => Promise<Session | null>>()
      expectTypeOf(adapter.set).toEqualTypeOf<
        (sessionId: string, session: Session) => Promise<void>
      >()
      expectTypeOf(adapter.delete).toEqualTypeOf<(sessionId: string) => Promise<void>>()
    })
  })

  describe('AddMessageOptions', () => {
    it('accepts an empty object (every field optional)', () => {
      const opts: AddMessageOptions = {}
      expect(opts.persona).toBeUndefined()
      expect(opts.metadata).toBeUndefined()
    })

    it('accepts persona alone and metadata alone', () => {
      const withPersona: AddMessageOptions = { persona: 'tax_accountant' }
      const withMeta: AddMessageOptions = { metadata: { turn: 1 } }
      expect(withPersona.persona).toBe('tax_accountant')
      expect(withMeta.metadata).toEqual({ turn: 1 })
    })
  })

  describe('ContextFitResult', () => {
    it('accepts the fits=true state with nothing to trim (everything fits, boundary)', () => {
      const result: ContextFitResult = {
        fits: true,
        messagesToFit: 10,
        tokensToTrim: 0,
        suggestedCompression: false,
      }
      expect(result.fits).toBe(true)
      expect(result.tokensToTrim).toBe(0)
      expect(result.suggestedCompression).toBe(false)
    })

    it('accepts the fits=false state requesting compression', () => {
      const result: ContextFitResult = {
        fits: false,
        messagesToFit: 0,
        tokensToTrim: 500,
        suggestedCompression: true,
      }
      expect(result.fits).toBe(false)
      expect(result.suggestedCompression).toBe(true)
    })

    it('declares the boolean discriminators as boolean', () => {
      expectTypeOf<ContextFitResult['fits']>().toEqualTypeOf<boolean>()
      expectTypeOf<ContextFitResult['suggestedCompression']>().toEqualTypeOf<boolean>()
      expectTypeOf<ContextFitResult['messagesToFit']>().toEqualTypeOf<number>()
      expectTypeOf<ContextFitResult['tokensToTrim']>().toEqualTypeOf<number>()
    })
  })

  describe('CompressionResult', () => {
    it('accepts a result without an optional summary', () => {
      const result: CompressionResult = {
        originalTokenCount: 1000,
        compressedTokenCount: 400,
        compressionRatio: 0.4,
      }
      expect(result.summary).toBeUndefined()
      expect(result.compressionRatio).toBe(0.4)
    })

    it('accepts a result with a summary', () => {
      const result: CompressionResult = {
        originalTokenCount: 1000,
        compressedTokenCount: 400,
        compressionRatio: 0.4,
        summary: '前半の会話を要約',
      }
      expect(result.summary).toBe('前半の会話を要約')
    })

    it('accepts boundary ratio values (0 = no compression, 1 = no savings)', () => {
      const none: CompressionResult = {
        originalTokenCount: 1000,
        compressedTokenCount: 1000,
        compressionRatio: 0,
      }
      const full: CompressionResult = {
        originalTokenCount: 1000,
        compressedTokenCount: 0,
        compressionRatio: 1,
      }
      expect(none.compressionRatio).toBe(0)
      expect(full.compressedTokenCount).toBe(0)
    })
  })

  describe('ContextResult<T>', () => {
    it('carries data on the success branch', () => {
      const ok: ContextResult<string> = { success: true, data: 'payload' }
      expect(ok.success).toBe(true)
      if (ok.success) {
        expect(ok.data).toBe('payload')
        expectTypeOf(ok.data).toEqualTypeOf<string>()
      }
    })

    it('carries a coded error on the failure branch', () => {
      const fail: ContextResult<string> = {
        success: false,
        error: { code: 'CONTEXT_FULL', message: 'context window exhausted' },
      }
      expect(fail.success).toBe(false)
      if (!fail.success) {
        expect(fail.error.code).toBe('CONTEXT_FULL')
        expect(fail.error.message).toBe('context window exhausted')
      }
    })

    it('narrows so the success branch exposes data and the failure branch exposes error', () => {
      const buildUnion = (): ContextResult<number> => ({ success: true, data: 7 })
      const result: ContextResult<number> = buildUnion()
      if (result.success) {
        expectTypeOf(result.data).toEqualTypeOf<number>()
        expect(result.data).toBe(7)
      } else {
        expectTypeOf(result.error.code).toEqualTypeOf<string>()
        expectTypeOf(result.error.message).toEqualTypeOf<string>()
      }
    })

    it('substitutes the generic for a complex payload type (Session)', () => {
      const session: Session = {
        id: 's1',
        userId: 'u1',
        createdAt: new Date(0),
        updatedAt: new Date(0),
        messages: [],
        entities: [],
        tokenCount: 0,
        config: DEFAULT_SESSION_CONFIG,
      }
      const ok: ContextResult<Session> = { success: true, data: session }
      if (ok.success) {
        expectTypeOf(ok.data).toEqualTypeOf<Session>()
        expect(ok.data.id).toBe('s1')
      }
    })

    it('the failure branch error shape is exactly { code: string; message: string }', () => {
      type FailureError = Exclude<ContextResult<unknown>, { success: true }>['error']
      expectTypeOf<FailureError>().toEqualTypeOf<{ code: string; message: string }>()
    })
  })
})
