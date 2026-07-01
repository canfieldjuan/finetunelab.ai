'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  Check,
  KeyRound,
  Library,
  Pencil,
  Plus,
  ServerCog,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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

interface McpServerManifestEntry {
  name: string;
  transport: 'http';
  url: string;
  enabled: boolean;
  hasAuthToken?: boolean;
  authToken?: string;
}

interface McpServerManifest {
  kind: 'finetunelab.mcp_servers';
  schemaVersion: 1;
  exportedAt?: string;
  servers: McpServerManifestEntry[];
}

interface McpServerCatalogEntry {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  requiresAuthToken: boolean;
  manifest: McpServerManifest;
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
const EMPTY_MANIFEST_TEXT = JSON.stringify(
  {
    kind: 'finetunelab.mcp_servers',
    schemaVersion: 1,
    servers: [
      {
        name: 'docs_server',
        transport: 'http',
        url: 'https://example.com/mcp',
        enabled: true,
      },
    ],
  },
  null,
  2,
);

function emptyForm(): FormState {
  return { ...EMPTY_FORM };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [catalogImportingId, setCatalogImportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<McpServerCatalogEntry[]>([]);
  const [editing, setEditing] = useState<HttpMcpServer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState(EMPTY_MANIFEST_TEXT);
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

  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const response = await fetch('/api/mcp/servers/catalog', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Failed to load MCP server catalog'));
      const data = await response.json();
      setCatalog(data.catalog || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP server catalog');
    } finally {
      setCatalogLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

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

  const openImport = () => {
    setImportOpen(true);
    setError(null);
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportText(EMPTY_MANIFEST_TEXT);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch('/api/mcp/servers/export', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Failed to export MCP servers'));
      const data = await response.json();
      downloadJson(`mcp-servers-${new Date().toISOString().slice(0, 10)}.json`, data.manifest);
      showSuccess('MCP server manifest exported');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export MCP servers');
    } finally {
      setExporting(false);
    }
  };

  const importManifest = async (
    manifest: unknown,
    options: { catalogId?: string; closeEditor?: boolean } = {},
  ) => {
    if (options.catalogId) setCatalogImportingId(options.catalogId);
    else setImporting(true);
    setError(null);

    try {
      const response = await fetch('/api/mcp/servers/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manifest }),
      });
      if (!response.ok) throw new Error(await readApiError(response, 'Failed to import MCP servers'));
      const data = await response.json();
      await fetchServers();
      if (options.closeEditor) closeImport();
      const result = data.result || {};
      showSuccess(`Imported ${result.createdCount || 0} new, updated ${result.updatedCount || 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import MCP servers');
    } finally {
      if (options.catalogId) setCatalogImportingId(null);
      else setImporting(false);
    }
  };

  const handleImportText = async () => {
    let manifest: unknown;
    try {
      manifest = JSON.parse(importText);
    } catch {
      setError('Import manifest must be valid JSON');
      return;
    }
    await importManifest(manifest, { closeEditor: true });
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
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              aria-label="Export MCP server manifest"
              onClick={handleExport}
              size="sm"
              variant="outline"
              disabled={exporting}
              className="shrink-0"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
            <Button
              aria-label="Import MCP server manifest"
              onClick={openImport}
              size="sm"
              variant="outline"
              className="shrink-0"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button onClick={openCreate} size="sm" className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          </div>
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

        {importOpen && (
          <div className="rounded-md border border-dashed p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">Import MCP Server Manifest</h3>
                <p className="text-sm text-muted-foreground">
                  Paste a FinetuneLab MCP manifest. Auth tokens are optional and write-only.
                </p>
              </div>
              <Button aria-label="Close MCP manifest import" variant="ghost" size="icon" onClick={closeImport}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcp-manifest-json">Manifest JSON</Label>
              <Textarea
                id="mcp-manifest-json"
                className="min-h-[220px] font-mono text-sm"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={closeImport} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={handleImportText} disabled={importing}>
                {importing ? 'Importing...' : 'Import Manifest'}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading MCP servers...</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Library className="h-4 w-4" />
                Catalog
              </h3>
              {catalogLoading ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading MCP catalog...</div>
              ) : catalog.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No catalog entries available.
                </div>
              ) : (
                <div className="grid gap-2">
                  {catalog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{entry.name}</span>
                          <Badge variant="outline">HTTP</Badge>
                          {!entry.requiresAuthToken && <Badge variant="secondary">No auth</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{entry.description}</p>
                        <a
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          href={entry.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button
                        aria-label={`Add ${entry.name} MCP server`}
                        variant="outline"
                        size="sm"
                        disabled={catalogImportingId === entry.id}
                        onClick={() => importManifest(entry.manifest, { catalogId: entry.id })}
                        className="shrink-0"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {catalogImportingId === entry.id ? 'Adding...' : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
