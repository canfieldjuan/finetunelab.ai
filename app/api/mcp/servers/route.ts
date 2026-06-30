import { NextRequest, NextResponse } from 'next/server';
import { loadHostStdioServers } from '@/lib/tools/mcp/host-config';
import { McpServerConfigService } from '@/lib/tools/mcp/server-config.service';
import { authenticateMcpRequest } from './auth';

export const runtime = 'nodejs';

interface HostMcpServerSummary {
  id: string;
  name: string;
  transport: 'stdio';
  enabled: boolean;
  managedBy: 'host';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function rejectStdioShape(body: Record<string, unknown>): string | null {
  if ('transport' in body && body.transport !== 'http') {
    return 'Only HTTP MCP servers can be managed from the portal';
  }
  for (const field of ['command', 'args', 'env']) {
    if (field in body) return 'Stdio MCP servers are host-config-only';
  }
  return null;
}

function requiredString(body: Record<string, unknown>, field: string): string | null {
  const value = body[field];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalToken(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalEnabled(body: Record<string, unknown>): boolean | undefined {
  if (!('enabled' in body)) return undefined;
  return body.enabled === true;
}

function hostServerSummary(server: { id: string; name: string; enabled: boolean }): HostMcpServerSummary {
  return {
    id: server.id,
    name: server.name,
    transport: 'stdio',
    enabled: server.enabled,
    managedBy: 'host',
  };
}

function isMcpValidationError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('[MCP]');
}

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateMcpRequest(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const service = new McpServerConfigService(auth.supabase);
    const servers = await service.listUserServers(auth.user.id);
    const hostServers = loadHostStdioServers()
      .filter((server) => server.enabled)
      .map(hostServerSummary);

    return NextResponse.json({
      success: true,
      servers,
      hostServers,
      count: servers.length,
      hostCount: hostServers.length,
    });
  } catch (error) {
    console.error('[MCP Servers API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list MCP servers',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateMcpRequest(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJson(request);
    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const stdioError = rejectStdioShape(body);
    if (stdioError) {
      return NextResponse.json({ success: false, error: stdioError }, { status: 400 });
    }

    const name = requiredString(body, 'name');
    const url = requiredString(body, 'url');
    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields', required: ['name', 'url'] },
        { status: 400 },
      );
    }
    if ('enabled' in body && typeof body.enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 });
    }
    if ('authToken' in body && body.authToken !== null && typeof body.authToken !== 'string') {
      return NextResponse.json({ success: false, error: 'authToken must be a string' }, { status: 400 });
    }

    const service = new McpServerConfigService(auth.supabase);
    const server = await service.createHttpServer(auth.user.id, {
      name,
      url,
      authToken: optionalToken(body.authToken),
      enabled: optionalEnabled(body),
    });

    return NextResponse.json({ success: true, server }, { status: 201 });
  } catch (error) {
    console.error('[MCP Servers API] POST error:', error);
    const status = isMcpValidationError(error) ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create MCP server',
        ...(isMcpValidationError(error) && error instanceof Error ? { details: error.message } : {}),
      },
      { status },
    );
  }
}
