import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SlackClient,
  createSlackClient,
  createSlackClientFromEnv,
} from '@/lib/integrations/slack/client'

vi.mock('@slack/web-api', () => {
  const mockPostMessage = vi.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' })
  const mockAuthTest = vi.fn().mockResolvedValue({ ok: true, user: 'Test Bot' })

  class MockWebClient {
    chat = { postMessage: mockPostMessage }
    auth = { test: mockAuthTest }
  }

  return {
    WebClient: MockWebClient,
  }
})

describe('SlackClient', () => {
  let client: SlackClient

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SLACK_BOT_TOKEN = 'test-token'
    process.env.SLACK_CHANNEL_ID = 'C12345'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_CHANNEL_ID
  })

  describe('constructor', () => {
    it('should create client with config', () => {
      const configClient = new SlackClient({
        botToken: 'xoxb-test-token',
        channelId: 'C12345',
      })
      expect(configClient).toBeInstanceOf(SlackClient)
    })

    it('should create enabled client with valid credentials', () => {
      client = new SlackClient({
        botToken: 'xoxb-test-token',
        channelId: 'C12345',
      })
      expect(client).toBeInstanceOf(SlackClient)
    })

    it('should create disabled client with missing token', () => {
      client = new SlackClient({
        botToken: '',
        channelId: 'C12345',
      })
      expect(client).toBeInstanceOf(SlackClient)
    })

    it('should create disabled client with missing channel', () => {
      client = new SlackClient({
        botToken: 'xoxb-test-token',
        channelId: '',
      })
      expect(client).toBeInstanceOf(SlackClient)
    })
  })

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      client = createSlackClientFromEnv()
      const result = await client.sendMessage('Test message')

      expect(result).toBe(true)
    })

    it('should send message with blocks', async () => {
      client = createSlackClientFromEnv()
      const blocks = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'Test block' },
        },
      ]
      const result = await client.sendMessage('Test message', blocks)

      expect(result).toBe(true)
    })

    it('should return false when credentials missing', async () => {
      delete process.env.SLACK_BOT_TOKEN
      client = createSlackClientFromEnv()
      const result = await client.sendMessage('Test message')

      expect(result).toBe(false)
    })

    it('should return false when channel ID missing', async () => {
      delete process.env.SLACK_CHANNEL_ID
      client = createSlackClientFromEnv()
      const result = await client.sendMessage('Test message')

      expect(result).toBe(false)
    })
  })

  describe('sendError', () => {
    it('should send error message', async () => {
      client = createSlackClientFromEnv()
      const error = new Error('Test error')
      const result = await client.sendError('Error occurred', error)

      expect(result).toBe(true)
    })

    it('should send error message without error object', async () => {
      client = createSlackClientFromEnv()
      const result = await client.sendError('Error occurred')

      expect(result).toBe(true)
    })

    it('should return false when credentials missing', async () => {
      delete process.env.SLACK_BOT_TOKEN
      client = createSlackClientFromEnv()
      const error = new Error('Test error')
      const result = await client.sendError('Error occurred', error)

      expect(result).toBe(false)
    })
  })
})

describe('createSlackClient', () => {
  it('should create client with config', () => {
    const client = createSlackClient({
      botToken: 'xoxb-test-token',
      channelId: 'C12345',
    })
    expect(client).toBeInstanceOf(SlackClient)
  })
})

describe('createSlackClientFromEnv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_CHANNEL_ID
  })

  it('should create client from environment variables', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-env-token'
    process.env.SLACK_CHANNEL_ID = 'C67890'

    const client = createSlackClientFromEnv()
    expect(client).toBeInstanceOf(SlackClient)
  })

  it('should create disabled client when env vars missing', () => {
    delete process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_CHANNEL_ID

    const client = createSlackClientFromEnv()
    expect(client).toBeInstanceOf(SlackClient)
  })

  it('should use empty string for missing token', () => {
    delete process.env.SLACK_BOT_TOKEN
    process.env.SLACK_CHANNEL_ID = 'C12345'

    const client = createSlackClientFromEnv()
    expect(client).toBeInstanceOf(SlackClient)
  })

  it('should use empty string for missing channel ID', () => {
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token'
    delete process.env.SLACK_CHANNEL_ID

    const client = createSlackClientFromEnv()
    expect(client).toBeInstanceOf(SlackClient)
  })
})

describe('SlackClient Edge Cases', () => {
  let client: SlackClient

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SLACK_BOT_TOKEN = 'test-token'
    process.env.SLACK_CHANNEL_ID = 'C12345'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_CHANNEL_ID
  })

  it('should handle empty message', async () => {
    client = createSlackClientFromEnv()
    const result = await client.sendMessage('')

    expect(result).toBe(true)
  })

  it('should handle very long message', async () => {
    client = createSlackClientFromEnv()
    const longMessage = 'A'.repeat(10000)
    const result = await client.sendMessage(longMessage)

    expect(result).toBe(true)
  })

  it('should handle special characters in message', async () => {
    client = createSlackClientFromEnv()
    const specialMessage = 'Test <>&"\'\\n\\t message'
    const result = await client.sendMessage(specialMessage)

    expect(result).toBe(true)
  })

  it('should handle Japanese characters in message', async () => {
    client = createSlackClientFromEnv()
    const japaneseMessage = 'テストメッセージ 日本語'
    const result = await client.sendMessage(japaneseMessage)

    expect(result).toBe(true)
  })

  it('should handle emoji in message', async () => {
    client = createSlackClientFromEnv()
    const emojiMessage = 'Test message 🎉 ✅ ❌'
    const result = await client.sendMessage(emojiMessage)

    expect(result).toBe(true)
  })

  it('should handle complex blocks structure', async () => {
    client = createSlackClientFromEnv()
    const complexBlocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Header' },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Bold* _italic_ `code`' },
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: 'Context 1' },
          { type: 'mrkdwn', text: 'Context 2' },
        ],
      },
    ]
    const result = await client.sendMessage('Test message', complexBlocks)

    expect(result).toBe(true)
  })
})
