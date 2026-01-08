/**
 * Platform Detection and Utilities
 * Helper functions for platform detection and download management
 * Date: 2026-01-07
 */

import type { Platform, PlatformDownload } from './types';

/**
 * Detect user's platform from browser user agent
 * Returns 'darwin' for macOS (internal value), but UI should display as "macOS"
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'linux'; // SSR fallback

  const ua = window.navigator.userAgent.toLowerCase();

  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'darwin'; // Internal value for macOS
  return 'linux'; // Default to linux
}

/**
 * Get download information for all platforms
 * @param version - Training agent version (defaults to env var or 'v0.2.1')
 */
export function getPlatformDownloads(
  version: string = process.env.NEXT_PUBLIC_TRAINING_AGENT_VERSION || 'v0.2.1'
): PlatformDownload[] {
  return [
    {
      platform: 'linux',
      label: 'Linux (AMD64)',
      url: '/api/workers/download/linux',
      filename: 'training-agent-linux-amd64.tar.gz',
      icon: 'Terminal',
    },
    {
      platform: 'darwin',
      label: 'macOS (AMD64)',
      url: '/api/workers/download/darwin',
      filename: 'training-agent-darwin-amd64.tar.gz',
      icon: 'Apple',
    },
    {
      platform: 'windows',
      label: 'Windows (AMD64)',
      url: '/api/workers/download/windows',
      filename: 'training-agent-windows-amd64.zip',
      icon: 'MonitorSmartphone',
    },
  ];
}

/**
 * Get setup instructions for a platform
 * Instructions include both API_KEY and BACKEND_URL for poll-based system
 */
export function getSetupInstructions(platform: Platform, apiKey: string, backendUrl: string = 'https://app.finetunelab.ai'): string {
  const instructions = {
    linux: `# Step 1: Extract the downloaded file
cd ~/Downloads
mkdir -p training-agent
tar -xzf training-agent-linux-amd64.tar.gz -C training-agent
cd training-agent

# Step 2: Run installer with API key and backend URL
chmod +x scripts/install.sh
API_KEY="${apiKey}" BACKEND_URL="${backendUrl}" ./scripts/install.sh

# Step 3: Start the agent
~/.finetunelab/training-agent/scripts/agentctl start

# The agent will automatically poll for training jobs`,

    darwin: `# Step 1: Extract the downloaded file
cd ~/Downloads
mkdir -p training-agent
tar -xzf training-agent-darwin-amd64.tar.gz -C training-agent
cd training-agent

# Step 2: Run installer with API key and backend URL
chmod +x scripts/install.sh
API_KEY="${apiKey}" BACKEND_URL="${backendUrl}" ./scripts/install.sh

# Step 3: Start the agent
~/.finetunelab/training-agent/scripts/agentctl start

# The agent will automatically poll for training jobs`,

    windows: `# Step 1: Extract the downloaded file (PowerShell)
cd $env:USERPROFILE\\Downloads
New-Item -ItemType Directory -Force -Path training-agent
Expand-Archive -Path training-agent-windows-amd64.zip -DestinationPath training-agent
cd training-agent

# Step 2: Run installer with API key and backend URL
$env:API_KEY="${apiKey}"; $env:BACKEND_URL="${backendUrl}"; .\\scripts\\install.ps1

# Step 3: Start the agent (will run as scheduled task)
.\\scripts\\agentctl.ps1 start

# The agent will automatically poll for training jobs`,
  };

  return instructions[platform];
}
