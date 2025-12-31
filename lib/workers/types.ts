/**
 * Worker Agent Types
 * TypeScript interfaces for worker system
 * Date: 2025-12-30
 */

// ============================================================================
// WORKER AGENT TYPES
// ============================================================================

/**
 * Worker Agent
 * Represents a local training agent running on user's machine
 */
export interface WorkerAgent {
  id: string;
  worker_id: string; // Format: wkr_xxxxxxxxxx
  user_id: string;
  api_key_id: string | null;

  // Worker information
  hostname: string;
  platform: 'windows' | 'darwin' | 'linux'; // 'darwin' = macOS (use getPlatformDisplayName() for UI)
  version: string;
  capabilities: string[];

  // Status
  status: 'online' | 'offline' | 'error';
  last_heartbeat: string | null;
  last_command_at: string | null;

  // Metrics
  current_load: number;
  max_concurrency: number;
  total_commands_executed: number;
  total_errors: number;

  // Metadata
  metadata: Record<string, any>;

  // Timestamps
  registered_at: string;
  updated_at: string;

  // Computed fields (added by frontend/API)
  is_online?: boolean;
  uptime_seconds?: number;
}

/**
 * Worker Metric
 * Time-series metrics data from worker agent
 */
export interface WorkerMetric {
  id: string;
  worker_id: string;
  user_id: string;

  // Timestamp
  timestamp: string;
  created_at: string;

  // System metrics
  cpu_percent: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
  disk_used_gb: number | null;
  network_sent_mb: number | null;
  network_recv_mb: number | null;

  // Trading metrics (if applicable)
  trading_status: string | null;
  active_trades: number | null;

  // Custom metrics
  custom_metrics: Record<string, any>;
}

/**
 * Worker Command
 * Commands sent to worker agents
 */
export interface WorkerCommand {
  id: string;
  worker_id: string;
  user_id: string;

  // Command details
  command_type: 'start_trading' | 'stop_trading' | 'update_config' | 'restart_agent' | 'collect_diagnostics';
  params: Record<string, any>;
  signature: string;
  timeout_seconds: number;

  // Status
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'timeout';
  result: Record<string, any> | null;
  error_message: string | null;

  // Timestamps
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Worker Details
 * Complete worker information including metrics and commands
 */
export interface WorkerDetails {
  worker: WorkerAgent;
  metrics: WorkerMetric[];
  commands: WorkerCommand[];
}

// ============================================================================
// PLATFORM TYPES
// ============================================================================

/**
 * Platform type
 * NOTE: Uses 'darwin' internally for macOS (database constraint requirement)
 * Use getPlatformDisplayName() to show "macOS" to users
 */
export type Platform = 'windows' | 'darwin' | 'linux';

/**
 * Platform Download Information
 */
export interface PlatformDownload {
  platform: Platform;
  label: string;
  url: string;
  filename: string;
  icon: string; // Lucide icon name
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to create a worker command
 */
export interface CreateWorkerCommandRequest {
  worker_id: string;
  command_type: WorkerCommand['command_type'];
  params?: Record<string, any>;
  timeout_seconds?: number;
}

/**
 * Response from creating a worker command
 */
export interface CreateWorkerCommandResponse {
  command: WorkerCommand;
}

/**
 * Response from listing workers
 */
export interface ListWorkersResponse {
  workers: WorkerAgent[];
}

/**
 * Response from getting worker details
 */
export interface GetWorkerDetailsResponse {
  worker: WorkerAgent;
  metrics: WorkerMetric[];
  commands: WorkerCommand[];
}

/**
 * Request to generate worker API key
 */
export interface GenerateWorkerApiKeyRequest {
  name: string;
  scopes: ['worker'];
}

/**
 * Response from generating worker API key
 */
export interface GenerateWorkerApiKeyResponse {
  apiKey: {
    id: string;
    key: string; // Full API key (shown only once)
    key_prefix: string;
    name: string;
    scopes: string[];
    created_at: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user-friendly platform display name
 * Converts 'darwin' to 'macOS' for better UX
 */
export function getPlatformDisplayName(platform: Platform): string {
  switch (platform) {
    case 'darwin':
      return 'macOS';
    case 'windows':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return platform;
  }
}

/**
 * Get platform icon name (for Lucide icons)
 */
export function getPlatformIcon(platform: Platform): string {
  switch (platform) {
    case 'darwin':
      return 'Apple';
    case 'windows':
      return 'MonitorSmartphone';
    case 'linux':
      return 'Terminal';
    default:
      return 'HardDrive';
  }
}
