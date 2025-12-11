// Agent Status Component
// Phase 3: Web UI Integration - Visual status indicator

'use client';

import { useState } from 'react';
import { useAgentStatus } from '@/hooks/useAgentStatus';
import { agentConfig } from '@/lib/config/agent';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Server } from 'lucide-react';
import { AgentSetupDialog } from './AgentSetupDialog';

export function AgentStatus() {
  const agentStatus = useAgentStatus({
    pollInterval: agentConfig.healthCheck.pollInterval,
    enabled: true
  });
  const [showSetup, setShowSetup] = useState(false);

  const statusIcon = agentStatus.isChecking ? (
    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  ) : agentStatus.isConnected ? (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  ) : (
    <AlertCircle className="h-4 w-4 text-destructive" />
  );

  const statusText = agentStatus.isChecking
    ? 'Checking...'
    : agentStatus.isConnected
      ? 'Connected'
      : 'Disconnected';

  const statusColor = agentStatus.isConnected
    ? 'text-green-600 dark:text-green-400'
    : 'text-destructive';

  // Hidden component - health checks run in background but no UI is shown
  return null;
}
