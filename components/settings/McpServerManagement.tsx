'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  KeyRound,
  Pencil,
  Plus,
  ServerCog,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface McpServerManagementProps {
  sessionToken: string;
}

interface HttpMcpServer {
  id: string;
  name: string;
  transport: 'http';
  url?: string;
  enabled: boolean;
  hasAuthToken: boolean;
}

interface HostMcpServer {
  id: string;
  name: string;
  transport: 'stdio';
  enabled: boolean;
  managedBy: 'host';
}

interface FormState {
  name: string;
  url: string;
  authToken: string;
  enabled: boolean;
  clearAuthToken: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  url: '',
  authToken: '',
  enabled: true,
  clearAuthToken: false,
};

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function emptyForm(): FormState {
  return { ...EMPTY_FORM };
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.details || fallback;
  } catch {
    return fallback;
  }
}

export function McpServerManagement({ sessionToken }: McpServerManagementProps) {
  const [servers, setServers] = useState<HttpMcpServer[]>([]);
  const [hostServers, setHostServers] = useState<HostMcpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<HttpMcpServer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/mcp/servers', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Failed to load MCP servers'));
      const data = await response.json();
      setServers(data.servers || []);
      setHostServers(data.hostServers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
    setError(null);
  };

  const openEdit = (server: HttpMcpServer) => {
    setEditing(server);
    setForm({
      name: server.name,
      url: server.url || '',
      authToken: '',
      enabled: server.enabled,
      clearAuthToken: false,
    });
    setFormOpen(true);
    setError(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const validateForm = (): string | null => {
    if (!NAME_PATTERN.test(form.name.trim())) {
      return 'Name must be 1-100 characters using letters, numbers, underscores, or hyphens.';
    }
    try {
      const url = new URL(form.url.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return 'URL must start with http:// or https://.';
      }
    } catch {
      return 'Enter a valid MCP server URL.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        url: form.url.trim(),
        enabled: form.enabled,
      };
      const token = form.authToken.trim();
      if (editing) {
        if (form.clearAuthToken) body.authToken = null;
        else if (token) body.authToken = token;
      } else if (token) {
        body.authToken = token;
      }

      const response = await fetch(editing ? `/api/mcp/servers/${editing.id}` : '/api/mcp/servers', {
        method: editing ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, editing ? 'Failed to update MCP server' : 'Failed to add MCP server'));
      }

      closeForm();
      await fetchServers();
      showSuccess(editing ? 'MCP server updated' : 'MCP server added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save MCP server');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (server: HttpMcpServer) => {
    setError(null);
    try {
      const response = await fetch(`/api/mcp/servers/${server.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: !server.enabled }),
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Failed to update MCP server'));
      await fetchServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update MCP server');
    }
  };

  const handleDelete = async (server: HttpMcpServer) => {
    if (!window.confirm(`Remove MCP server "${server.name}"?`)) return;

    setDeletingId(server.id);
    setError(null);
    try {
      const response = await fetch(`/api/mcp/servers/${server.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Failed to delete MCP server'));
      await fetchServers();
      showSuccess('MCP server removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete MCP server');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerCog className="h-5 w-5 shrink-0" />
              <span>MCP Tool Servers</span>
            </CardTitle>
            <CardDescription>
              Connect remote HTTP MCP servers to chat. Host stdio servers are operator-managed.
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm" className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Add Server
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <Check className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {formOpen && (
          <div className="rounded-md border border-dashed p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{editing ? 'Edit HTTP MCP Server' : 'Add HTTP MCP Server'}</h3>
                <p className="text-sm text-muted-foreground">
                  Use a public Streamable HTTP MCP endpoint. Stdio servers stay in host config.
                </p>
              </div>
              <Button aria-label="Close MCP server form" variant="ghost" size="icon" onClick={closeForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mcp-server-name">Name</Label>
                <Input
                  id="mcp-server-name"
                  placeholder="github_docs"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-server-url">URL</Label>
                <Input
                  id="mcp-server-url"
                  placeholder="https://example.com/mcp"
                  value={form.url}
                  onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mcp-server-token">Bearer Token</Label>
                <Input
                  id="mcp-server-token"
                  type="password"
                  placeholder={editing?.hasAuthToken ? 'Leave blank to keep saved token' : 'Optional'}
                  value={form.authToken}
                  disabled={form.clearAuthToken}
                  onChange={(event) => setForm((current) => ({ ...current, authToken: event.target.value }))}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    aria-label="Enable MCP server"
                    checked={form.enabled}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))}
                  />
                  Enabled
                </label>
                {editing?.hasAuthToken && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.clearAuthToken}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          clearAuthToken: event.target.checked,
                          authToken: event.target.checked ? '' : current.authToken,
                        }))
                      }
                    />
                    Clear saved token
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeForm} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Server'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading MCP servers...</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Configured HTTP Servers</h3>
              {servers.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No user-managed MCP servers configured.
                </div>
              ) : (
                <div className="grid gap-2">
                  {servers.map((server) => (
                    <div
                      key={server.id}
                      className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{server.name}</span>
                          <Badge variant={server.enabled ? 'default' : 'secondary'}>
                            {server.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {server.hasAuthToken && (
                            <Badge variant="outline" className="gap-1">
                              <KeyRound className="h-3 w-3" />
                              Token
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{server.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          aria-label={`${server.enabled ? 'Disable' : 'Enable'} ${server.name}`}
                          checked={server.enabled}
                          onCheckedChange={() => handleToggle(server)}
                        />
                        <Button
                          aria-label={`Edit ${server.name}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(server)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`Delete ${server.name}`}
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === server.id}
                          onClick={() => handleDelete(server)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Host Stdio Servers</h3>
              {hostServers.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No host-managed stdio MCP servers are active.
                </div>
              ) : (
                <div className="grid gap-2">
                  {hostServers.map((server) => (
                    <div
                      key={server.id}
                      className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{server.name}</span>
                          <Badge variant="outline" className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Host managed
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Configured by MCP_STDIO_SERVERS and read-only in the portal.
                        </p>
                      </div>
                      <Badge variant={server.enabled ? 'default' : 'secondary'}>
                        {server.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
