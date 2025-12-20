/**
 * Alert System Type Definitions
 * Date: 2025-12-12
 */

export type AlertType =
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled'
  | 'batch_test_completed'
  | 'batch_test_failed'
  | 'scheduled_eval_completed'
  | 'scheduled_eval_failed'
  | 'scheduled_eval_disabled'
  | 'scheduled_eval_regression'
  | 'gpu_oom'
  | 'disk_warning'
  | 'timeout_warning'
  | 'daily_summary'
  | 'weekly_digest';

export type WebhookType = 'slack' | 'discord' | 'generic';

export interface UserAlertPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  email_address: string | null;
  alert_job_started: boolean;
  alert_job_completed: boolean;
  alert_job_failed: boolean;
  alert_job_cancelled: boolean;
  alert_batch_test_completed: boolean;
  alert_batch_test_failed: boolean;
  alert_scheduled_eval_completed: boolean;
  alert_scheduled_eval_failed: boolean;
  alert_scheduled_eval_disabled: boolean;
  alert_scheduled_eval_regression: boolean;
  alert_gpu_oom: boolean;
  alert_disk_warning: boolean;
  alert_timeout_warning: boolean;
  daily_summary_enabled: boolean;
  daily_summary_hour: number;
  weekly_digest_enabled: boolean;
  weekly_digest_day: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface UserWebhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  webhook_type: WebhookType;
  secret: string | null;
  alert_job_started: boolean;
  alert_job_completed: boolean;
  alert_job_failed: boolean;
  alert_job_cancelled: boolean;
  alert_batch_test_completed: boolean;
  alert_batch_test_failed: boolean;
  alert_scheduled_eval_completed: boolean;
  alert_scheduled_eval_failed: boolean;
  alert_scheduled_eval_disabled: boolean;
  alert_scheduled_eval_regression: boolean;
  alert_gpu_oom: boolean;
  alert_disk_warning: boolean;
  alert_timeout_warning: boolean;
  enabled: boolean;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlertHistoryEntry {
  id: string;
  user_id: string;
  alert_type: AlertType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  job_id: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  email_message_id: string | null;
  email_error: string | null;
  webhook_sent: boolean;
  webhook_sent_at: string | null;
  webhook_id: string | null;
  webhook_status_code: number | null;
  webhook_error: string | null;
  created_at: string;
}

export interface AlertPayload {
  type: AlertType;
  userId: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  jobId?: string;
}

export interface TrainingJobAlertData {
  jobId: string;
  userId: string;
  modelName: string | null;
  baseModel: string | null;
  status: string;
  progress: number | null;
  currentStep: number | null;
  totalSteps: number | null;
  loss: number | null;
  duration: number | null;
  errorMessage: string | null;
  errorType: string | null;
  // Enhanced details
  trainingMethod?: string | null; // SFT, DPO, ORPO, CPT, RLHF
  datasetName?: string | null;
  datasetSamples?: number | null;
  learningRate?: number | null;
  batchSize?: number | null;
  numEpochs?: number | null;
  evalLoss?: number | null;
  perplexity?: number | null;
  gpuType?: string | null;
  gpuMemoryUsed?: number | null; // in GB
  [key: string]: string | number | null | undefined;
}

export interface BatchTestAlertData {
  testRunId: string;
  userId: string;
  modelName: string | null;
  testRunName: string | null;
  status: string;
  totalPrompts: number;
  completedPrompts: number;
  failedPrompts: number;
  errorMessage: string | null;
  [key: string]: string | number | null;
}

export interface ScheduledEvaluationAlertData {
  scheduledEvaluationId: string;
  userId: string;
  scheduleName: string;
  modelId: string;
  status: string;
  totalPrompts?: number;
  successfulPrompts?: number;
  failedPrompts?: number;
  avgLatency?: number;
  avgQualityScore?: number;
  regressionDetected?: boolean;
  regressionPercent?: number;
  errorMessage: string | null;
  consecutiveFailures?: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface AlertDeliveryResult {
  success: boolean;
  channel: 'email' | 'webhook';
  messageId?: string;
  statusCode?: number;
  error?: string;
}

export interface IntegrationDeliveryResult {
  success: boolean;
  integrationType: string;
  integrationId: string;
  error?: string;
}

export interface AlertChannel {
  send(
    alert: AlertPayload,
    preferences: UserAlertPreferences,
    webhook?: UserWebhook
  ): Promise<AlertDeliveryResult>;
}

export interface WebhookPayload {
  type: AlertType;
  title: string;
  message: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: (
    | { type: string; text?: { type: string; text: string }; url?: string }
    | { type: string; text: string }
  )[];
  accessory?: Record<string, unknown>;
}

export interface SlackPayload {
  blocks: SlackBlock[];
  text?: string;
  [key: string]: SlackBlock[] | string | undefined;
}

export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordPayload {
  content?: string;
  embeds: DiscordEmbed[];
  [key: string]: string | DiscordEmbed[] | undefined;
}

export interface AlertConfig {
  emailFromAddress: string;
  appBaseUrl: string;
  maxWebhookRetries: number;
  webhookTimeoutMs: number;
  rateLimitPerHour: number;
}

export function getAlertConfig(): AlertConfig {
  return {
    emailFromAddress: process.env.EMAIL_DEFAULT_FROM || process.env.ALERT_EMAIL_FROM || 'alerts@finetunelab.ai',
    appBaseUrl: process.env.ALERT_APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://finetunelab.ai',
    maxWebhookRetries: parseInt(process.env.ALERT_WEBHOOK_MAX_RETRIES || '3', 10),
    webhookTimeoutMs: parseInt(process.env.ALERT_WEBHOOK_TIMEOUT_MS || '10000', 10),
    rateLimitPerHour: parseInt(process.env.ALERT_RATE_LIMIT_PER_HOUR || '100', 10),
  };
}

export function alertTypeToPreferenceKey(type: AlertType): keyof UserAlertPreferences | null {
  const mapping: Record<AlertType, keyof UserAlertPreferences | null> = {
    job_started: 'alert_job_started',
    job_completed: 'alert_job_completed',
    job_failed: 'alert_job_failed',
    job_cancelled: 'alert_job_cancelled',
    batch_test_completed: 'alert_batch_test_completed',
    batch_test_failed: 'alert_batch_test_failed',
    scheduled_eval_completed: 'alert_scheduled_eval_completed',
    scheduled_eval_failed: 'alert_scheduled_eval_failed',
    scheduled_eval_disabled: 'alert_scheduled_eval_disabled',
    scheduled_eval_regression: 'alert_scheduled_eval_regression',
    gpu_oom: 'alert_gpu_oom',
    disk_warning: 'alert_disk_warning',
    timeout_warning: 'alert_timeout_warning',
    daily_summary: null,
    weekly_digest: null,
  };
  return mapping[type];
}

export function alertTypeToWebhookKey(type: AlertType): keyof UserWebhook | null {
  const mapping: Record<AlertType, keyof UserWebhook | null> = {
    job_started: 'alert_job_started',
    job_completed: 'alert_job_completed',
    job_failed: 'alert_job_failed',
    job_cancelled: 'alert_job_cancelled',
    batch_test_completed: 'alert_batch_test_completed',
    batch_test_failed: 'alert_batch_test_failed',
    scheduled_eval_completed: 'alert_scheduled_eval_completed',
    scheduled_eval_failed: 'alert_scheduled_eval_failed',
    scheduled_eval_disabled: 'alert_scheduled_eval_disabled',
    scheduled_eval_regression: 'alert_scheduled_eval_regression',
    gpu_oom: 'alert_gpu_oom',
    disk_warning: 'alert_disk_warning',
    timeout_warning: 'alert_timeout_warning',
    daily_summary: null,
    weekly_digest: null,
  };
  return mapping[type];
}

/**
 * Maps alert types to integration config keys (log_* prefix)
 */
export function alertTypeToIntegrationKey(type: AlertType): string | null {
  const mapping: Record<AlertType, string | null> = {
    job_started: 'log_job_started',
    job_completed: 'log_job_completed',
    job_failed: 'log_job_failed',
    job_cancelled: 'log_job_cancelled',
    batch_test_completed: null,
    batch_test_failed: null,
    scheduled_eval_completed: null,
    scheduled_eval_failed: null,
    scheduled_eval_disabled: null,
    scheduled_eval_regression: null,
    gpu_oom: 'log_gpu_oom',
    disk_warning: null,
    timeout_warning: null,
    daily_summary: null,
    weekly_digest: null,
  };
  return mapping[type];
}
