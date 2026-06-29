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
});
