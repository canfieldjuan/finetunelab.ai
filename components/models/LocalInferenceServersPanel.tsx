"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cpu, PlayCircle, RefreshCw, Server, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ServerInfo } from './ModelCard';

interface VLLMRuntimeStatus {
  available: boolean;
  mode: 'local' | 'external' | 'unavailable';
  local_available: boolean;
  external_configured: boolean;
  cloud_runtime: boolean;
  requires_external: boolean;
  version: string | null;
  configured?: {
    executable_path: boolean;
    python_path: boolean;
  };
  message?: string;
}

interface LocalInferenceServersPanelProps {
  servers: ServerInfo[];
  sessionToken?: string;
  onRefresh: () => void | Promise<void>;
}

function statusBadgeVariant(status: ServerInfo['status']) {
  if (status === 'error') return 'destructive';
  if (status === 'running') return 'default';
  return 'secondary';
}

function formatEndpoint(server: ServerInfo): string {
  if (server.base_url) return server.base_url;
  if (server.port) return `http://localhost:${server.port}`;
  return 'No endpoint';
}

function isActionDisabled(server: ServerInfo, loadingId: string | null): boolean {
  return Boolean(loadingId) || server.status === 'starting';
}

export function LocalInferenceServersPanel({
  servers,
  sessionToken,
  onRefresh,
}: LocalInferenceServersPanelProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<VLLMRuntimeStatus | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(true);

  const localServers = useMemo(
    () => servers.filter((server) =>
      (server.server_type === 'vllm' || server.server_type === 'ollama') &&
      server.is_local !== false &&
      !server.external
    ),
    [servers]
  );
  const activeServer = localServers.find(
    (server) => server.status === 'running' || server.status === 'starting'
  );

  const fetchRuntimeStatus = useCallback(async () => {
    setRuntimeLoading(true);

    try {
      const response = await fetch('/api/training/vllm/check');
      if (!response.ok) {
        throw new Error(`vLLM status returned ${response.status}`);
      }

      const data = await response.json();
      setRuntimeStatus(data);
    } catch (error) {
      console.error('[LocalInferenceServersPanel] vLLM status check failed:', error);
      setRuntimeStatus({
        available: false,
        mode: 'unavailable',
        local_available: false,
        external_configured: false,
        cloud_runtime: false,
        requires_external: false,
        version: null,
        message: 'vLLM status check failed',
      });
    } finally {
      setRuntimeLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRuntimeStatus();
  }, [fetchRuntimeStatus]);

  async function refreshPanel() {
    await Promise.all([
      onRefresh(),
      fetchRuntimeStatus(),
    ]);
  }

  async function runServerAction(server: ServerInfo, action: 'stop' | 'swap') {
    if (!sessionToken) {
      toast.error('Authentication required');
      return;
    }

    setLoadingId(server.id);

    try {
      const response = await fetch(action === 'stop' ? '/api/servers/stop' : '/api/servers/swap', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ server_id: server.id }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.details || `Failed to ${action} server`);
      }

      toast.success(action === 'stop' ? 'Server stopped' : 'Server swap started');
      await refreshPanel();
    } catch (error) {
      console.error('[LocalInferenceServersPanel] Server action failed:', error);
      toast.error(error instanceof Error ? error.message : 'Server action failed');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="h-4 w-4" />
              Local Inference Runtime
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeServer
                ? `${activeServer.model_name || activeServer.display_name || 'A local model'} is occupying the local runtime.`
                : 'No local vLLM or Ollama server is currently occupying the runtime.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshPanel()}
            className="gap-2 sm:self-start"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">vLLM mode</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={runtimeStatus?.available ? 'default' : 'secondary'}>
                {runtimeLoading ? 'checking' : runtimeStatus?.mode || 'unavailable'}
              </Badge>
              {runtimeStatus?.version && (
                <span className="text-xs text-muted-foreground">v{runtimeStatus.version}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Configuration</div>
            <div className="mt-1 text-sm">
              {runtimeStatus?.external_configured
                ? 'External endpoint configured'
                : runtimeStatus?.configured?.executable_path
                  ? 'Executable path configured'
                  : runtimeStatus?.configured?.python_path
                    ? 'Python path configured'
                    : 'Using environment auto-detect'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">Readiness</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {runtimeLoading ? 'Checking runtime...' : runtimeStatus?.message || 'vLLM status unavailable'}
            </div>
          </div>
        </div>

        {localServers.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Server className="mx-auto mb-2 h-6 w-6" />
            Deploy or add a local vLLM/Ollama model to manage it here.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>PID</TableHead>
                <TableHead className="w-36 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localServers.map((server) => (
                <TableRow key={server.id}>
                  <TableCell>
                    <div className="font-medium">{server.display_name || server.model_name || 'Local server'}</div>
                    <div className="text-xs text-muted-foreground">
                      {server.server_type || 'local'} · {server.model_name || 'unknown model'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(server.status)}>
                      {server.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">{formatEndpoint(server)}</code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {server.process_id ?? 'none'}
                  </TableCell>
                  <TableCell className="text-right">
                    {server.status === 'running' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runServerAction(server, 'stop')}
                        disabled={isActionDisabled(server, loadingId)}
                        className="gap-1.5"
                      >
                        <StopCircle className="h-3.5 w-3.5" />
                        {loadingId === server.id ? 'Stopping' : 'Eject'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runServerAction(server, 'swap')}
                        disabled={isActionDisabled(server, loadingId)}
                        className="gap-1.5"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        {loadingId === server.id ? 'Starting' : 'Load'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
