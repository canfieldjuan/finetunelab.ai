/**
 * Email HTML Formatter
 * Date: 2025-12-12
 */

import {
  AlertPayload,
  TrainingJobAlertData,
  BatchTestAlertData,
  getAlertConfig,
} from '../alert.types';

const STATUS_COLOR: Record<string, string> = {
  job_started: '#3498db',
  job_completed: '#27ae60',
  job_failed: '#e74c3c',
  job_cancelled: '#7f8c8d',
  batch_test_completed: '#27ae60',
  batch_test_failed: '#e74c3c',
  gpu_oom: '#e74c3c',
  disk_warning: '#f39c12',
  timeout_warning: '#f39c12',
  daily_summary: '#9b59b6',
  weekly_digest: '#9b59b6',
};

const STATUS_ICON: Record<string, string> = {
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatEmailAlert(alert: AlertPayload): { subject: string; html: string; text: string } {
  const config = getAlertConfig();
  const color = STATUS_COLOR[alert.type] || '#3498db';
  const icon = STATUS_ICON[alert.type] || '\u{1F514}';
  const isBatchTest = alert.type === 'batch_test_completed' || alert.type === 'batch_test_failed';
  const jobData = !isBatchTest ? (alert.metadata as TrainingJobAlertData | undefined) : undefined;
  const batchData = isBatchTest ? (alert.metadata as BatchTestAlertData | undefined) : undefined;

  const subject = `${icon} ${alert.title}`;

  let metricsHtml = '';
  let errorHtml = '';
  let buttonHtml = '';

  if (batchData) {
    const metrics: { label: string; value: string }[] = [];

    if (batchData.modelName) {
      metrics.push({ label: 'Model', value: escapeHtml(batchData.modelName) });
    }
    if (batchData.testRunName) {
      metrics.push({ label: 'Test Name', value: escapeHtml(batchData.testRunName) });
    }

    metrics.push({ label: 'Total Prompts', value: String(batchData.totalPrompts) });
    metrics.push({ label: 'Failed Prompts', value: String(batchData.failedPrompts) });

    if (metrics.length > 0) {
      metricsHtml = `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          ${metrics.map(m => `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666; width: 120px;">${m.label}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #333; font-weight: 500;">${m.value}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    if (batchData.errorMessage) {
      const truncated = batchData.errorMessage.length > 1000
        ? batchData.errorMessage.slice(0, 997) + '...'
        : batchData.errorMessage;
      errorHtml = `
        <div style="background: #fdf2f2; border: 1px solid #f5c6cb; border-radius: 4px; padding: 12px; margin: 20px 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #721c24;">
          ${escapeHtml(truncated)}
        </div>
      `;
    }

    if (batchData.testRunId) {
      const testUrl = `${config.appBaseUrl}/testing?testRunId=${batchData.testRunId}`;
      buttonHtml = `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${testUrl}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500;">View Test Run</a>
        </div>
      `;
    }
  }

  if (jobData) {
    const metrics: { label: string; value: string }[] = [];

    if (jobData.modelName) {
      metrics.push({ label: 'Model', value: escapeHtml(jobData.modelName) });
    }
    if (jobData.baseModel) {
      metrics.push({ label: 'Base Model', value: escapeHtml(jobData.baseModel) });
    }
    if (jobData.duration !== null) {
      metrics.push({ label: 'Duration', value: formatDuration(jobData.duration) });
    }
    if (jobData.loss !== null) {
      metrics.push({ label: 'Final Loss', value: formatNumber(jobData.loss) });
    }
    if (jobData.currentStep !== null && jobData.totalSteps !== null) {
      metrics.push({ label: 'Progress', value: `${jobData.currentStep}/${jobData.totalSteps}` });
    }
    if (jobData.errorType) {
      metrics.push({ label: 'Error Type', value: escapeHtml(jobData.errorType) });
    }

    if (metrics.length > 0) {
      metricsHtml = `
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          ${metrics.map(m => `
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666; width: 120px;">${m.label}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #333; font-weight: 500;">${m.value}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }

    if (jobData.errorMessage) {
      const truncated = jobData.errorMessage.length > 1000
        ? jobData.errorMessage.slice(0, 997) + '...'
        : jobData.errorMessage;
      errorHtml = `
        <div style="background: #fdf2f2; border: 1px solid #f5c6cb; border-radius: 4px; padding: 12px; margin: 20px 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #721c24;">
          ${escapeHtml(truncated)}
        </div>
      `;
    }

    if (jobData.jobId) {
      const jobUrl = `${config.appBaseUrl}/training/monitor?jobId=${jobData.jobId}`;
      buttonHtml = `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${jobUrl}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500;">View Job Details</a>
        </div>
      `;
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5;">
  <table role="presentation" style="width: 100%; background: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" style="width: 100%; max-width: 600px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: ${color}; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">${icon} ${escapeHtml(alert.title)}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 24px;">
              ${alert.message ? `<p style="color: #333; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">${escapeHtml(alert.message)}</p>` : ''}
              ${metricsHtml}
              ${errorHtml}
              ${buttonHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                Sent from Training Platform
                <br>
                <a href="${config.appBaseUrl}/settings/alerts" style="color: #666;">Manage alert preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textParts = [alert.title, '', alert.message || ''];
  if (batchData) {
    if (batchData.modelName) textParts.push(`Model: ${batchData.modelName}`);
    if (batchData.testRunName) textParts.push(`Test Name: ${batchData.testRunName}`);
    textParts.push(`Total Prompts: ${batchData.totalPrompts}`);
    textParts.push(`Failed Prompts: ${batchData.failedPrompts}`);
    if (batchData.errorMessage) textParts.push(`\nError:\n${batchData.errorMessage}`);
    if (batchData.testRunId) {
      textParts.push(`\nView details: ${config.appBaseUrl}/testing?testRunId=${batchData.testRunId}`);
    }
  } else if (jobData) {
    if (jobData.modelName) textParts.push(`Model: ${jobData.modelName}`);
    if (jobData.duration !== null) textParts.push(`Duration: ${formatDuration(jobData.duration)}`);
    if (jobData.loss !== null) textParts.push(`Final Loss: ${formatNumber(jobData.loss)}`);
    if (jobData.errorMessage) textParts.push(`\nError:\n${jobData.errorMessage}`);
    if (jobData.jobId) {
      textParts.push(`\nView details: ${config.appBaseUrl}/training/monitor?jobId=${jobData.jobId}`);
    }
  }

  return { subject, html, text: textParts.join('\n') };
}

export function formatEmailDailySummary(
  jobs: TrainingJobAlertData[],
  date: string
): { subject: string; html: string; text: string } {
  const config = getAlertConfig();
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const running = jobs.filter(j => j.status === 'running').length;

  const subject = `\u{1F4CA} Daily Training Summary - ${date}`;

  const failedJobsHtml = failed > 0
    ? `
      <h3 style="color: #e74c3c; margin-top: 24px;">Failed Jobs</h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${jobs.filter(j => j.status === 'failed').slice(0, 10).map(j => `
          <li style="margin: 8px 0;">
            <strong>${escapeHtml(j.modelName || j.jobId.slice(0, 8))}</strong>: ${escapeHtml(j.errorType || 'Unknown error')}
          </li>
        `).join('')}
      </ul>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <table style="width: 100%; max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="background: #9b59b6; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: white;">\u{1F4CA} Daily Summary</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9);">${date}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <table style="width: 100%; text-align: center;">
          <tr>
            <td style="padding: 16px;">
              <div style="font-size: 36px; color: #27ae60; font-weight: bold;">${completed}</div>
              <div style="color: #666;">Completed</div>
            </td>
            <td style="padding: 16px;">
              <div style="font-size: 36px; color: #e74c3c; font-weight: bold;">${failed}</div>
              <div style="color: #666;">Failed</div>
            </td>
            <td style="padding: 16px;">
              <div style="font-size: 36px; color: #3498db; font-weight: bold;">${running}</div>
              <div style="color: #666;">Running</div>
            </td>
          </tr>
        </table>
        ${failedJobsHtml}
        <div style="text-align: center; margin-top: 24px;">
          <a href="${config.appBaseUrl}/training" style="background: #9b59b6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">View All Jobs</a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    `Daily Training Summary - ${date}`,
    '',
    `Completed: ${completed}`,
    `Failed: ${failed}`,
    `Running: ${running}`,
    '',
    `View all: ${config.appBaseUrl}/training`,
  ].join('\n');

  return { subject, html, text };
}
