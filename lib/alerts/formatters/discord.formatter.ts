/**
 * Discord Embed Formatter
 * Date: 2025-12-12
 */

import {
  AlertPayload,
  DiscordPayload,
  DiscordEmbed,
  TrainingJobAlertData,
  BatchTestAlertData,
  getAlertConfig,
} from '../alert.types';

const STATUS_EMOJI: Record<string, string> = {
  job_started: '\u{1F680}',
  job_completed: '\u2705',
  job_failed: '\u274C',
  job_cancelled: '\u{1F6D1}',
  batch_test_completed: '\u2705',
  batch_test_failed: '\u274C',
  gpu_oom: '\u{1F525}',
  disk_warning: '\u26A0\uFE0F',
  timeout_warning: '\u23F3',
  daily_summary: '\u{1F4CA}',
  weekly_digest: '\u{1F4C5}',
};

const STATUS_COLOR: Record<string, number> = {
  job_started: 0x3498db,
  job_completed: 0x2ecc71,
  job_failed: 0xe74c3c,
  job_cancelled: 0x95a5a6,
  batch_test_completed: 0x2ecc71,
  batch_test_failed: 0xe74c3c,
  gpu_oom: 0xe74c3c,
  disk_warning: 0xf39c12,
  timeout_warning: 0xf39c12,
  daily_summary: 0x9b59b6,
  weekly_digest: 0x9b59b6,
};

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

export function formatDiscordAlert(alert: AlertPayload): DiscordPayload {
  const config = getAlertConfig();
  const emoji = STATUS_EMOJI[alert.type] || '\u{1F514}';
  const color = STATUS_COLOR[alert.type] || 0x7289da;
  const isBatchTest = alert.type === 'batch_test_completed' || alert.type === 'batch_test_failed';
  const jobData = !isBatchTest ? (alert.metadata as TrainingJobAlertData | undefined) : undefined;
  const batchData = isBatchTest ? (alert.metadata as BatchTestAlertData | undefined) : undefined;

  const embed: DiscordEmbed = {
    title: `${emoji} ${alert.title}`,
    description: alert.message || undefined,
    color,
    timestamp: new Date().toISOString(),
  };

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (batchData) {
    if (batchData.modelName) {
      fields.push({ name: 'Model', value: batchData.modelName, inline: true });
    }
    if (batchData.testRunName) {
      fields.push({ name: 'Test Name', value: batchData.testRunName, inline: true });
    }

    fields.push({ name: 'Total Prompts', value: String(batchData.totalPrompts), inline: true });
    fields.push({ name: 'Failed Prompts', value: String(batchData.failedPrompts), inline: true });

    if (batchData.errorMessage) {
      const truncated = batchData.errorMessage.length > 500
        ? batchData.errorMessage.slice(0, 497) + '...'
        : batchData.errorMessage;
      fields.push({ name: 'Error', value: `\`\`\`${truncated}\`\`\``, inline: false });
    }
    if (batchData.testRunId) {
      const testUrl = `${config.appBaseUrl}/testing?testRunId=${batchData.testRunId}`;
      fields.push({ name: 'Details', value: `[View Test Run](${testUrl})`, inline: false });
    }
  } else if (jobData) {
    if (jobData.modelName) {
      fields.push({ name: 'Model', value: jobData.modelName, inline: true });
    }
    if (jobData.baseModel) {
      fields.push({ name: 'Base Model', value: jobData.baseModel, inline: true });
    }
    if (jobData.duration !== null) {
      fields.push({ name: 'Duration', value: formatDuration(jobData.duration), inline: true });
    }
    if (jobData.loss !== null) {
      fields.push({ name: 'Final Loss', value: formatNumber(jobData.loss), inline: true });
    }
    if (jobData.currentStep !== null && jobData.totalSteps !== null) {
      fields.push({
        name: 'Progress',
        value: `${jobData.currentStep}/${jobData.totalSteps}`,
        inline: true,
      });
    }
    if (jobData.errorType) {
      fields.push({ name: 'Error Type', value: jobData.errorType, inline: true });
    }
    if (jobData.errorMessage) {
      const truncated = jobData.errorMessage.length > 500
        ? jobData.errorMessage.slice(0, 497) + '...'
        : jobData.errorMessage;
      fields.push({ name: 'Error', value: `\`\`\`${truncated}\`\`\``, inline: false });
    }
    if (jobData.jobId) {
      const jobUrl = `${config.appBaseUrl}/training/monitor?jobId=${jobData.jobId}`;
      fields.push({ name: 'Details', value: `[View Job](${jobUrl})`, inline: false });
    }
  }

  if (fields.length > 0) {
    embed.fields = fields.slice(0, 25);
  }

  if (jobData?.jobId) {
    embed.footer = { text: `Job ID: ${jobData.jobId}` };
  }

  return {
    embeds: [embed],
  };
}

export function formatDiscordDailySummary(
  jobs: TrainingJobAlertData[],
  date: string
): DiscordPayload {
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const running = jobs.filter(j => j.status === 'running').length;

  const embed: DiscordEmbed = {
    title: `\u{1F4CA} Daily Training Summary - ${date}`,
    color: 0x9b59b6,
    fields: [
      { name: '\u2705 Completed', value: String(completed), inline: true },
      { name: '\u274C Failed', value: String(failed), inline: true },
      { name: '\u23F3 Running', value: String(running), inline: true },
      { name: 'Total Jobs', value: String(jobs.length), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  if (failed > 0) {
    const failedJobs = jobs.filter(j => j.status === 'failed').slice(0, 5);
    const failedList = failedJobs
      .map(j => `- ${j.modelName || j.jobId.slice(0, 8)}: ${j.errorType || 'Unknown'}`)
      .join('\n');

    embed.fields?.push({
      name: 'Failed Jobs',
      value: failedList || 'None',
      inline: false,
    });
  }

  return {
    embeds: [embed],
  };
}
