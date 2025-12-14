/**
 * Slack Block Kit Formatter
 * Date: 2025-12-12
 */

import {
  AlertPayload,
  SlackPayload,
  SlackBlock,
  TrainingJobAlertData,
  BatchTestAlertData,
  getAlertConfig,
} from '../alert.types';

const STATUS_EMOJI: Record<string, string> = {
  job_started: ':rocket:',
  job_completed: ':white_check_mark:',
  job_failed: ':x:',
  job_cancelled: ':stop_sign:',
  batch_test_completed: ':white_check_mark:',
  batch_test_failed: ':x:',
  gpu_oom: ':fire:',
  disk_warning: ':warning:',
  timeout_warning: ':hourglass:',
  daily_summary: ':bar_chart:',
  weekly_digest: ':calendar:',
};

// Status colors for potential future use with Slack attachments
// const STATUS_COLOR: Record<string, string> = {
//   job_started: '#3498db',
//   job_completed: '#2ecc71',
//   job_failed: '#e74c3c',
//   job_cancelled: '#95a5a6',
//   gpu_oom: '#e74c3c',
//   disk_warning: '#f39c12',
//   timeout_warning: '#f39c12',
// };

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatNumber(num: number | null, decimals: number = 4): string {
  if (num === null || num === undefined) return 'N/A';
  return num.toFixed(decimals);
}

export function formatSlackAlert(alert: AlertPayload): SlackPayload {
  const config = getAlertConfig();
  const emoji = STATUS_EMOJI[alert.type] || ':bell:';
  const isBatchTest = alert.type === 'batch_test_completed' || alert.type === 'batch_test_failed';
  const jobData = !isBatchTest ? (alert.metadata as TrainingJobAlertData | undefined) : undefined;
  const batchData = isBatchTest ? (alert.metadata as BatchTestAlertData | undefined) : undefined;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${alert.title}`,
        emoji: true,
      },
    },
  ];

  if (alert.message) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: alert.message,
      },
    });
  }

  if (batchData) {
    const fields: { type: string; text: string }[] = [];

    if (batchData.modelName) {
      fields.push({ type: 'mrkdwn', text: `*Model:*\n${batchData.modelName}` });
    }
    if (batchData.testRunName) {
      fields.push({ type: 'mrkdwn', text: `*Test Name:*\n${batchData.testRunName}` });
    }

    fields.push({ type: 'mrkdwn', text: `*Total Prompts:*\n${batchData.totalPrompts}` });
    fields.push({ type: 'mrkdwn', text: `*Failed Prompts:*\n${batchData.failedPrompts}` });

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.slice(0, 10),
      });
    }

    if (batchData.errorMessage) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:*\n\`\`\`${batchData.errorMessage.slice(0, 500)}\`\`\``,
        },
      });
    }

    if (batchData.testRunId) {
      const testUrl = `${config.appBaseUrl}/testing?testRunId=${batchData.testRunId}`;
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Test Run',
            },
            url: testUrl,
          },
        ],
      });
    }
  } else if (jobData) {
    const fields: { type: string; text: string }[] = [];

    if (jobData.modelName) {
      fields.push({ type: 'mrkdwn', text: `*Model:*\n${jobData.modelName}` });
    }
    if (jobData.baseModel) {
      fields.push({ type: 'mrkdwn', text: `*Base:*\n${jobData.baseModel}` });
    }
    if (jobData.duration !== null) {
      fields.push({ type: 'mrkdwn', text: `*Duration:*\n${formatDuration(jobData.duration)}` });
    }
    if (jobData.loss !== null) {
      fields.push({ type: 'mrkdwn', text: `*Final Loss:*\n${formatNumber(jobData.loss)}` });
    }
    if (jobData.currentStep !== null && jobData.totalSteps !== null) {
      fields.push({ type: 'mrkdwn', text: `*Progress:*\n${jobData.currentStep}/${jobData.totalSteps}` });
    }
    if (jobData.errorType) {
      fields.push({ type: 'mrkdwn', text: `*Error Type:*\n${jobData.errorType}` });
    }

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields: fields.slice(0, 10),
      });
    }

    if (jobData.errorMessage) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:*\n\`\`\`${jobData.errorMessage.slice(0, 500)}\`\`\``,
        },
      });
    }

    if (jobData.jobId) {
      const jobUrl = `${config.appBaseUrl}/training/monitor?jobId=${jobData.jobId}`;
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Job Details',
            },
            url: jobUrl,
          },
        ],
      });
    }
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Sent at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|${new Date().toISOString()}>`,
      },
    ],
  });

  return {
    blocks,
    text: `${emoji} ${alert.title}`,
  };
}

export function formatSlackDailySummary(
  jobs: TrainingJobAlertData[],
  date: string
): SlackPayload {
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const running = jobs.filter(j => j.status === 'running').length;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:bar_chart: Daily Training Summary - ${date}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Completed:*\n:white_check_mark: ${completed}` },
        { type: 'mrkdwn', text: `*Failed:*\n:x: ${failed}` },
        { type: 'mrkdwn', text: `*Running:*\n:hourglass: ${running}` },
        { type: 'mrkdwn', text: `*Total:*\n${jobs.length}` },
      ],
    },
  ];

  if (failed > 0) {
    const failedJobs = jobs.filter(j => j.status === 'failed').slice(0, 5);
    const failedList = failedJobs
      .map(j => `- ${j.modelName || j.jobId}: ${j.errorType || 'Unknown error'}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failed Jobs:*\n${failedList}`,
      },
    });
  }

  return {
    blocks,
    text: `:bar_chart: Daily Summary: ${completed} completed, ${failed} failed`,
  };
}
