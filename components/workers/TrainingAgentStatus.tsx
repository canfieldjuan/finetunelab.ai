/**
 * Training Agent Status Component
 * Displays connected training agents with real-time status
 * Date: 2026-01-07
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  Cpu,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  Monitor,
  Apple,
  Terminal,
} from 'lucide-react';
import type { TrainingAgent } from '@/lib/workers/types';
import { getPlatformDisplayName, getTimeSinceLastPoll } from '@/lib/workers/types';

interface TrainingAgentStatusProps {
  sessionToken: string;
}

export function TrainingAgentStatus({ sessionToken }: TrainingAgentStatusProps) {
  const [agents, setAgents] = useState<TrainingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/training/agents', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      setAgents(data.agents || []);
      setError(null);
    } catch (err) {
      console.error('[Agent Status] Error fetching agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  // Initial fetch
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Poll for updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAgents();
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('Are you sure you want to remove this agent?')) return;

    try {
      const response = await fetch(`/api/training/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete agent');
      }

      // Remove from local state
      setAgents(prev => prev.filter(a => a.agent_id !== agentId));
    } catch (err) {
      console.error('[Agent Status] Error deleting agent:', err);
      alert('Failed to delete agent');
    }
  };

  const getPlatformIcon = (platform: string | null) => {
    switch (platform) {
      case 'darwin':
        return <Apple className="h-4 w-4" />;
      case 'windows':
        return <Monitor className="h-4 w-4" />;
      case 'linux':
      default:
        return <Terminal className="h-4 w-4" />;
    }
  };

  const onlineCount = agents.filter(a => a.is_online).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Connected Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Connected Agents
            {agents.length > 0 && (
              <Badge variant={onlineCount > 0 ? 'default' : 'secondary'}>
                {onlineCount} online
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-md mb-4">
            {error}
          </div>
        )}

        {agents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No agents connected</p>
            <p className="text-sm mt-1">
              Download and start a training agent to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.agent_id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  {agent.is_online ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}

                  {/* Agent info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{agent.agent_id}</span>
                      {agent.platform && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getPlatformIcon(agent.platform)}
                          {getPlatformDisplayName(agent.platform as 'linux' | 'darwin' | 'windows')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {agent.hostname && <span>{agent.hostname}</span>}
                      {agent.version && <span>v{agent.version}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getTimeSinceLastPoll(agent.last_poll_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Badge variant={agent.is_online ? 'default' : 'secondary'}>
                    {agent.is_online ? 'Online' : 'Offline'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(agent.agent_id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
