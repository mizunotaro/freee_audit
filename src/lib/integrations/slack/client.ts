import { WebClient } from '@slack/web-api'
import { API_TIMEOUTS } from '@/lib/utils/timeout'

export interface SlackConfig {
  botToken: string
  channelId: string
}

export class SlackClient {
  private client: WebClient
  private channelId: string
  private enabled: boolean

  constructor(config: SlackConfig) {
    this.client = new WebClient(config.botToken, {
      timeout: API_TIMEOUTS.SLACK_API,
    })
    this.channelId = config.channelId
    this.enabled = !!config.botToken && !!config.channelId
  }

  async sendMessage(text: string, blocks?: unknown[]): Promise<boolean> {
    if (!this.enabled) {
      console.log('[Slack] Notification disabled - missing credentials')
      return false
    }

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        text,
        blocks: blocks as never[],
      })
      return true
    } catch (error) {
      console.error('[Slack] Failed to send message:', error)
      return false
    }
  }

  async sendError(message: string, error?: Error): Promise<boolean> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 システムエラー / System Error',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${message}*\n${error ? `\`\`\`${error.message}\`\`\`` : ''}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `発生時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
          },
        ],
      },
    ]

    return this.sendMessage(message, blocks)
  }
}

export function createSlackClient(config: SlackConfig): SlackClient {
  return new SlackClient(config)
}

export function createSlackClientFromEnv(): SlackClient {
  return new SlackClient({
    botToken: process.env.SLACK_BOT_TOKEN || '',
    channelId: process.env.SLACK_CHANNEL_ID || '',
  })
}
