// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpServerManagement } from '../McpServerManagement';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;

function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const httpServer = {
  id: 'srv-1',
  name: 'github_docs',
  transport: 'http',
  url: 'https://api.example.com/mcp',
  enabled: true,
  hasAuthToken: true,
};

describe('McpServerManagement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders user HTTP servers and host stdio servers without command details', async () => {
    stubFetch((url, init) => {
      expect(init?.headers).toEqual({ Authorization: 'Bearer session-token' });
      if (url === '/api/mcp/servers') {
        return jsonResponse({
          servers: [httpServer],
          hostServers: [
            {
              id: 'host-stdio:filesystem',
              name: 'filesystem',
              transport: 'stdio',
              enabled: true,
              managedBy: 'host',
            },
          ],
        });
      }
      if (url === '/api/mcp/servers/catalog') {
        return jsonResponse({ catalog: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<McpServerManagement sessionToken="session-token" />);

    expect(await screen.findByText('github_docs')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com/mcp')).toBeInTheDocument();
    expect(screen.getByText('filesystem')).toBeInTheDocument();
    expect(screen.getByText(/Configured by MCP_STDIO_SERVERS/)).toBeInTheDocument();
    expect(screen.queryByText('npx')).not.toBeInTheDocument();
    expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
  });

  it('creates an HTTP MCP server without sending stdio fields', async () => {
    const postBodies: Array<Record<string, unknown>> = [];
    let servers: unknown[] = [];
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/mcp/servers' && !init?.method) {
        return jsonResponse({ servers, hostServers: [] });
      }
      if (url === '/api/mcp/servers/catalog') {
        return jsonResponse({ catalog: [] });
      }
      if (url === '/api/mcp/servers' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        postBodies.push(body);
        servers = [{ ...httpServer, name: body.name, url: body.url, hasAuthToken: true }];
        return jsonResponse({ success: true, server: servers[0] }, 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<McpServerManagement sessionToken="session-token" />);

    await screen.findByText('No user-managed MCP servers configured.');
    fireEvent.click(screen.getByRole('button', { name: 'Add Server' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'docs_server' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://docs.example.com/mcp' } });
    fireEvent.change(screen.getByLabelText('Bearer Token'), { target: { value: 'secret-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Server' }));

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toEqual({
      name: 'docs_server',
      url: 'https://docs.example.com/mcp',
      enabled: true,
      authToken: 'secret-token',
    });
    expect(postBodies[0]).not.toHaveProperty('transport');
    expect(postBodies[0]).not.toHaveProperty('command');
    expect(postBodies[0]).not.toHaveProperty('args');
    expect(postBodies[0]).not.toHaveProperty('env');
    expect(await screen.findByText('docs_server')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/mcp/servers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
      }),
    );
  });

  it('toggles and deletes configured HTTP servers', async () => {
    const patchBodies: Array<Record<string, unknown>> = [];
    const deleteUrls: string[] = [];
    vi.stubGlobal('confirm', vi.fn(() => true));
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/mcp/servers' && !init?.method) {
        return jsonResponse({ servers: [httpServer], hostServers: [] });
      }
      if (url === '/api/mcp/servers/catalog') {
        return jsonResponse({ catalog: [] });
      }
      if (url === '/api/mcp/servers/srv-1' && init?.method === 'PATCH') {
        patchBodies.push(JSON.parse(init.body as string));
        return jsonResponse({ success: true, server: { ...httpServer, enabled: false } });
      }
      if (url === '/api/mcp/servers/srv-1' && init?.method === 'DELETE') {
        deleteUrls.push(url);
        return jsonResponse({ success: true });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<McpServerManagement sessionToken="session-token" />);

    expect(await screen.findByText('github_docs')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Disable github_docs'));
    await waitFor(() => expect(patchBodies).toEqual([{ enabled: false }]));

    fireEvent.click(screen.getByRole('button', { name: 'Delete github_docs' }));
    await waitFor(() => expect(deleteUrls).toEqual(['/api/mcp/servers/srv-1']));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/mcp/servers/srv-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('exports a token-redacted MCP server manifest', async () => {
    const createObjectURL = vi.fn<typeof URL.createObjectURL>(() => 'blob:mcp-manifest');
    const revokeObjectURL = vi.fn<typeof URL.revokeObjectURL>(() => {});
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    stubFetch((url) => {
      if (url === '/api/mcp/servers') {
        return jsonResponse({ servers: [httpServer], hostServers: [] });
      }
      if (url === '/api/mcp/servers/catalog') {
        return jsonResponse({ catalog: [] });
      }
      if (url === '/api/mcp/servers/export') {
        return jsonResponse({
          manifest: {
            kind: 'finetunelab.mcp_servers',
            schemaVersion: 1,
            servers: [
              {
                name: 'github_docs',
                transport: 'http',
                url: 'https://api.example.com/mcp',
                enabled: true,
                hasAuthToken: true,
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<McpServerManagement sessionToken="session-token" />);

    expect(await screen.findByText('github_docs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export MCP server manifest' }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mcp-manifest');
    expect(await screen.findByText('MCP server manifest exported')).toBeInTheDocument();
  });

  it('imports pasted manifests through the manifest endpoint', async () => {
    const importBodies: unknown[] = [];
    let servers: unknown[] = [];
    stubFetch((url, init) => {
      if (url === '/api/mcp/servers' && !init?.method) {
        return jsonResponse({ servers, hostServers: [] });
      }
      if (url === '/api/mcp/servers/catalog') {
        return jsonResponse({ catalog: [] });
      }
      if (url === '/api/mcp/servers/import' && init?.method === 'POST') {
        importBodies.push(JSON.parse(init.body as string));
        servers = [{ ...httpServer, name: 'learn_docs', url: 'https://learn.microsoft.com/api/mcp' }];
        return jsonResponse({ success: true, result: { createdCount: 1, updatedCount: 0 } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<McpServerManagement sessionToken="session-token" />);

    await screen.findByText('No user-managed MCP servers configured.');
    fireEvent.click(screen.getByRole('button', { name: 'Import MCP server manifest' }));
    fireEvent.change(screen.getByLabelText('Manifest JSON'), {
      target: {
        value: JSON.stringify({
          kind: 'finetunelab.mcp_servers',
          schemaVersion: 1,
          servers: [
            {
              name: 'learn_docs',
              transport: 'http',
              url: 'https://learn.microsoft.com/api/mcp',
              enabled: true,
            },
          ],
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import Manifest' }));

    await waitFor(() => expect(importBodies).toHaveLength(1));
    expect(importBodies[0]).toEqual({
      manifest: {
        kind: 'finetunelab.mcp_servers',
        schemaVersion: 1,
        servers: [
          {
            name: 'learn_docs',
            transport: 'http',
            url: 'https://learn.microsoft.com/api/mcp',
            enabled: true,
          },
        ],
      },
    });
    expect(await screen.findByText('learn_docs')).toBeInTheDocument();
    expect(screen.getByText('Imported 1 new, updated 0')).toBeInTheDocument();
  });

  it('adds catalog entries through the same import endpoint', async () => {
    const importBodies: unknown[] = [];
    const catalogEntry = {
      id: 'microsoft-learn',
      name: 'Microsoft Learn',
      description: 'Search Microsoft docs',
      sourceUrl: 'https://learn.microsoft.com/en-us/training/support/mcp',
      requiresAuthToken: false,
      manifest: {
        kind: 'finetunelab.mcp_servers',
        schemaVersion: 1,
        servers: [
          {
            name: 'microsoft_learn',
            transport: 'http',
            url: 'https://learn.microsoft.com/api/mcp',
            enabled: true,
          },
        ],
      },
    };
    let servers: unknown[] = [];
    stubFetch((url, init) => {
      if (url === '/api/mcp/servers' && !init?.method) {
        return jsonResponse({ servers, hostServers: [] });
      }
      if (url === '/api/mcp/servers/catalog') {
        return jsonResponse({ catalog: [catalogEntry] });
      }
      if (url === '/api/mcp/servers/import' && init?.method === 'POST') {
        importBodies.push(JSON.parse(init.body as string));
        servers = [{ ...httpServer, name: 'microsoft_learn', url: 'https://learn.microsoft.com/api/mcp' }];
        return jsonResponse({ success: true, result: { createdCount: 1, updatedCount: 0 } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<McpServerManagement sessionToken="session-token" />);

    expect(await screen.findByText('Microsoft Learn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Microsoft Learn MCP server' }));

    await waitFor(() => expect(importBodies).toHaveLength(1));
    expect(importBodies[0]).toEqual({ manifest: catalogEntry.manifest });
    expect(await screen.findByText('microsoft_learn')).toBeInTheDocument();
  });
});
