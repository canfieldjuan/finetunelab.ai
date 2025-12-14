/**
 * Integration Types
 * Date: 2025-12-12
 */

export type IntegrationType =
  | 'notion'
  | 'linear'
  | 'jira'
  | 'teams'
  | 'pagerduty'
  | 'telegram';

export interface IntegrationConfig {
  // Which events to log
  log_job_started?: boolean;
  log_job_completed?: boolean;
  log_job_failed?: boolean;
  log_job_cancelled?: boolean;
  log_gpu_oom?: boolean;
  [key: string]: boolean | string | number | undefined;
}

// Notion-specific credentials
export interface NotionCredentials {
  api_key: string;
  database_id: string;
}

// Teams webhook credentials
export interface TeamsCredentials {
  webhook_url: string;
}

// Telegram credentials
export interface TelegramCredentials {
  bot_token: string;
  chat_id: string;
}

// PagerDuty credentials
export interface PagerDutyCredentials {
  routing_key: string;
}

// Linear credentials
export interface LinearCredentials {
  api_key: string;
  team_id: string;
}

// Jira credentials
export interface JiraCredentials {
  api_token: string;
  domain: string;
  project_key: string;
  email: string;
}

// Generic credentials type
export type IntegrationCredentials =
  | NotionCredentials
  | TeamsCredentials
  | TelegramCredentials
  | PagerDutyCredentials
  | LinearCredentials
  | JiraCredentials
  | Record<string, string>;

export interface UserIntegration {
  id: string;
  user_id: string;
  integration_type: IntegrationType;
  name: string;
  credentials: IntegrationCredentials;
  config: IntegrationConfig;
  enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

// Display version without sensitive data
export interface UserIntegrationDisplay {
  id: string;
  user_id: string;
  integration_type: IntegrationType;
  name: string;
  config: IntegrationConfig;
  enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
  // Masked credentials preview
  credentials_preview: string;
  has_database_id?: boolean;
}

export interface IntegrationMetadata {
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  fields: IntegrationField[];
  docsUrl?: string;
}

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder: string;
  required: boolean;
  helpText?: string;
}

// Integration metadata registry
export const INTEGRATION_METADATA: Record<IntegrationType, IntegrationMetadata> = {
  notion: {
    type: 'notion',
    name: 'Notion',
    description: 'Log training events to a Notion database',
    icon: 'notion',
    docsUrl: 'https://developers.notion.com/docs/create-a-notion-integration',
    fields: [
      {
        key: 'api_key',
        label: 'Internal Integration Token',
        type: 'password',
        placeholder: 'secret_...',
        required: true,
        helpText: 'Create an integration at notion.so/my-integrations',
      },
      {
        key: 'database_id',
        label: 'Database ID',
        type: 'text',
        placeholder: 'abc123def456...',
        required: true,
        helpText: 'The ID from your database URL (32 characters)',
      },
    ],
  },
  linear: {
    type: 'linear',
    name: 'Linear',
    description: 'Create issues for failed training jobs',
    icon: 'linear',
    docsUrl: 'https://linear.app/settings/api',
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'lin_api_...',
        required: true,
        helpText: 'Generate at Linear Settings → API',
      },
      {
        key: 'team_id',
        label: 'Team ID',
        type: 'text',
        placeholder: 'TEAM-123',
        required: true,
      },
    ],
  },
  jira: {
    type: 'jira',
    name: 'Jira',
    description: 'Create tickets for failed training jobs',
    icon: 'jira',
    fields: [
      {
        key: 'api_token',
        label: 'API Token',
        type: 'password',
        placeholder: 'ATATT...',
        required: true,
      },
      {
        key: 'domain',
        label: 'Jira Domain',
        type: 'text',
        placeholder: 'your-org.atlassian.net',
        required: true,
      },
      {
        key: 'project_key',
        label: 'Project Key',
        type: 'text',
        placeholder: 'ML',
        required: true,
      },
      {
        key: 'email',
        label: 'Account Email',
        type: 'text',
        placeholder: 'your@email.com',
        required: true,
      },
    ],
  },
  teams: {
    type: 'teams',
    name: 'Microsoft Teams',
    description: 'Send alerts to a Teams channel',
    icon: 'teams',
    fields: [
      {
        key: 'webhook_url',
        label: 'Incoming Webhook URL',
        type: 'url',
        placeholder: 'https://outlook.office.com/webhook/...',
        required: true,
        helpText: 'Create an Incoming Webhook connector in your channel',
      },
    ],
  },
  pagerduty: {
    type: 'pagerduty',
    name: 'PagerDuty',
    description: 'Trigger incidents for critical failures',
    icon: 'pagerduty',
    fields: [
      {
        key: 'routing_key',
        label: 'Integration/Routing Key',
        type: 'password',
        placeholder: 'R...',
        required: true,
        helpText: 'Events API v2 integration key',
      },
    ],
  },
  telegram: {
    type: 'telegram',
    name: 'Telegram',
    description: 'Send alerts to a Telegram chat',
    icon: 'telegram',
    fields: [
      {
        key: 'bot_token',
        label: 'Bot Token',
        type: 'password',
        placeholder: '123456:ABC-DEF...',
        required: true,
        helpText: 'Get from @BotFather',
      },
      {
        key: 'chat_id',
        label: 'Chat ID',
        type: 'text',
        placeholder: '-1001234567890',
        required: true,
        helpText: 'Group/channel chat ID (use @userinfobot)',
      },
    ],
  },
};

// Default config for new integrations
export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  log_job_started: false,
  log_job_completed: true,
  log_job_failed: true,
  log_job_cancelled: false,
  log_gpu_oom: true,
};
