import { SlackClient, createSlackClientFromEnv } from './client'
import { AuditSummary } from '@/types/audit'

export class AuditNotifier {
  private slackClient: SlackClient

  constructor(slackClient?: SlackClient) {
    this.slackClient = slackClient ?? createSlackClientFromEnv()
  }

  async notifyAuditComplete(summary: AuditSummary): Promise<boolean> {
    const statusEmoji = summary.failedCount > 0 ? ':warning:' : ':white_check_mark:'
    const hasErrors = summary.errorCount > 0

    const blocks: unknown[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} 仕訳監査結果 / Journal Audit Result`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*日付 / Date:*\n${summary.date}`,
          },
          {
            type: 'mrkdwn',
            text: `*総件数 / Total:*\n${summary.totalCount}件`,
          },
          {
            type: 'mrkdwn',
            text: `*合格 / Passed:*\n${summary.passedCount}件`,
          },
          {
            type: 'mrkdwn',
            text: `*要確認 / Review:*\n${summary.failedCount}件`,
          },
        ],
      },
    ]

    if (hasErrors) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:x: *エラー / Errors:* ${summary.errorCount}件`,
        },
      })
    }

    if (summary.issues.length > 0) {
      const issueTexts = summary.issues.slice(0, 5).map((item) => {
        const issueSummary = item.issues
          .slice(0, 2)
          .map((i) => `  - ${i.message}`)
          .join('\n')
        return `• *${item.journalId}*: ${item.description}\n${issueSummary}`
      })

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*【要確認項目 / Items to Review】*\n${issueTexts.join('\n')}${summary.issues.length > 5 ? `\n_...他 ${summary.issues.length - 5}件_` : ''}`,
        },
      })
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '詳細を確認 / View Details',
          },
          url: `${appUrl}/audit/results`,
        },
      ],
    })

    const fallbackText = `${statusEmoji} 仕訳監査完了: 合格${summary.passedCount}件, 要確認${summary.failedCount}件`

    return this.slackClient.sendMessage(fallbackText, blocks)
  }

  async notifyAuditError(error: Error, context?: string): Promise<boolean> {
    const message = context ? `監査処理エラー: ${context}` : '監査処理エラー / Audit Process Error'
    return this.slackClient.sendError(message, error)
  }

  async notifySyncComplete(
    count: number,
    dateRange: { start: string; end: string }
  ): Promise<boolean> {
    const blocks: unknown[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':arrows_counterclockwise: 仕訳同期完了 / Journal Sync Complete',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*期間 / Period:*\n${dateRange.start} - ${dateRange.end}`,
          },
          {
            type: 'mrkdwn',
            text: `*同期件数 / Count:*\n${count}件`,
          },
        ],
      },
    ]

    return this.slackClient.sendMessage(`仕訳同期完了: ${count}件`, blocks)
  }
}

export function createAuditNotifier(slackClient?: SlackClient): AuditNotifier {
  return new AuditNotifier(slackClient)
}
