/**
 * Training Agent Types
 * TypeScript interfaces for poll-based training agent system
 * Date: 2026-01-07
 */

// ============================================================================
// TRAINING AGENT TYPES
// ============================================================================

/**
 * Training Agent
 * Represents a local training agent running on user's machine
 * Uses poll-based job dispatch instead of registration/heartbeat
 */
export interface TrainingAgent {
  id: string;
  user_id: string;
  agent_id: string; // Format: agent_xxxxxxxxxxxxxxxx

  // Agent information
  hostname: string | null;
  platform: Platform | null;
  version: string | null;

  // Status (computed from last_poll_at)
  status: 'online' | 'offline';
  last_poll_at: string | null;

  // Timestamps
  registered_at: string;

  // Metadata
  metadata: Record<string, unknown>;

  // Computed fields (added by frontend/API)
  is_online?: boolean;
}

/**
 * Training Agent with job stats
 * Extended agent info including current job status
 */
export interface TrainingAgentWithStats extends TrainingAgent {
  active_job_id?: string | null;
  total_jobs_completed?: number;
  last_job_at?: string | null;
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
 * Response from listing training agents
 */
export interface ListTrainingAgentsResponse {
  agents: TrainingAgent[];
}

/**
 * Response from getting training agent details
 */
export interface GetTrainingAgentResponse {
  agent: TrainingAgentWithStats;
}

/**
 * Request to generate training API key
 */
export interface GenerateTrainingApiKeyRequest {
  name: string;
  scopes: ['training'];
}

/**
 * Response from generating training API key
 */
export interface GenerateTrainingApiKeyResponse {
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

/**
 * Check if agent is online based on last poll time
 * Agent is considered online if it polled within the last 60 seconds
 */
export function isAgentOnline(lastPollAt: string | null, thresholdSeconds: number = 60): boolean {
  if (!lastPollAt) return false;
  const lastPoll = new Date(lastPollAt);
  const now = new Date();
  const diffSeconds = (now.getTime() - lastPoll.getTime()) / 1000;
  return diffSeconds <= thresholdSeconds;
}

/**
 * Get time since last poll in human-readable format
 */
export function getTimeSinceLastPoll(lastPollAt: string | null): string {
  if (!lastPollAt) return 'Never';

  const lastPoll = new Date(lastPollAt);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - lastPoll.getTime()) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}
