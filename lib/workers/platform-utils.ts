/**
 * Platform Detection and Utilities
 * Helper functions for platform detection and download management
 * Date: 2025-12-30
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
 */
export function getPlatformDownloads(version: string = 'v0.1.0'): PlatformDownload[] {
  const baseUrl = `https://github.com/FineTune-Lab/training-agent/releases/download/${version}`;

  return [
    {
      platform: 'linux',
      label: 'Linux (AMD64)',
      url: `${baseUrl}/training-agent-linux-amd64.tar.gz`,
      filename: 'training-agent-linux-amd64.tar.gz',
      icon: 'Terminal',
    },
    {
      platform: 'darwin',
      label: 'macOS (AMD64)',
      url: `${baseUrl}/training-agent-darwin-amd64.tar.gz`,
      filename: 'training-agent-darwin-amd64.tar.gz',
      icon: 'Apple',
    },
    {
      platform: 'windows',
      label: 'Windows (AMD64)',
      url: `${baseUrl}/training-agent-windows-amd64.zip`,
      filename: 'training-agent-windows-amd64.zip',
      icon: 'MonitorSmartphone',
    },
  ];
}

/**
 * Get setup instructions for a platform
 */
export function getSetupInstructions(platform: Platform, apiKey: string): string {
  const instructions = {
    linux: `# Step 1: Extract the downloaded file
cd ~/Downloads
tar -xzf training-agent-linux-amd64.tar.gz
cd training-agent

# Step 2: Run installer with API key
chmod +x scripts/install.sh
API_KEY="${apiKey}" ./scripts/install.sh

# Step 3: Fix permissions and start the agent
chmod +x ~/.finetunelab/training-agent/scripts/agentctl
~/.finetunelab/training-agent/scripts/agentctl start`,

    darwin: `# Step 1: Extract the downloaded file
cd ~/Downloads
tar -xzf training-agent-darwin-amd64.tar.gz
cd training-agent

# Step 2: Run installer with API key
chmod +x scripts/install.sh
API_KEY="${apiKey}" ./scripts/install.sh

# Step 3: Fix permissions and start the agent
chmod +x ~/.finetunelab/training-agent/scripts/agentctl
~/.finetunelab/training-agent/scripts/agentctl start`,

    windows: `# Step 1: Extract the downloaded file (PowerShell)
cd $env:USERPROFILE\\Downloads
Expand-Archive -Path training-agent-windows-amd64.zip -DestinationPath .
cd training-agent

# Step 2: Run installer with API key
$env:API_KEY="${apiKey}"; .\\scripts\\install.ps1

# Step 3: Start the agent (will run as scheduled task)
.\\scripts\\agentctl.ps1 start`,
  };

  return instructions[platform];
}
