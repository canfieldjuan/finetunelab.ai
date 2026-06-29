import { NextRequest, NextResponse } from 'next/server';
import { McpServerConfigService, type UpdateHttpServerInput } from '@/lib/tools/mcp/server-config.service';
import { authenticateMcpRequest } from '../auth';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
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

function readOptionalString(body: Record<string, unknown>, field: string): string | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  return typeof value === 'string' ? value.trim() : undefined;
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

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const patch: UpdateHttpServerInput = {};
    const name = readOptionalString(body, 'name');
    const url = readOptionalString(body, 'url');
    if ('name' in body) {
      if (!name) return NextResponse.json({ success: false, error: 'name must be a non-empty string' }, { status: 400 });
      patch.name = name;
    }
    if ('url' in body) {
      if (!url) return NextResponse.json({ success: false, error: 'url must be a non-empty string' }, { status: 400 });
      patch.url = url;
    }
    if ('enabled' in body) {
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 });
      }
      patch.enabled = body.enabled;
    }
    if ('authToken' in body) {
      if (body.authToken !== null && typeof body.authToken !== 'string') {
        return NextResponse.json({ success: false, error: 'authToken must be a string or null' }, { status: 400 });
      }
      if (typeof body.authToken === 'string' && !body.authToken.trim()) {
        return NextResponse.json({ success: false, error: 'authToken must be non-empty or null' }, { status: 400 });
      }
      patch.authToken = body.authToken === null ? null : body.authToken.trim();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: 'No supported fields to update' }, { status: 400 });
    }

    const { id } = await context.params;
    const service = new McpServerConfigService(auth.supabase);
    const server = await service.updateHttpServer(auth.user.id, id, patch);
    return NextResponse.json({ success: true, server });
  } catch (error) {
    console.error('[MCP Servers API] PATCH error:', error);
    const status = isMcpValidationError(error) ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update MCP server',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await authenticateMcpRequest(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const service = new McpServerConfigService(auth.supabase);
    await service.deleteServer(auth.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MCP Servers API] DELETE error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete MCP server',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
