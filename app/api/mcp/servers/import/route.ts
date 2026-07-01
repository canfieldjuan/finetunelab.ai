import { NextRequest, NextResponse } from 'next/server';
import { getSharedMcpClientManager } from '@/lib/tools/mcp/client';
import { McpServerConfigService } from '@/lib/tools/mcp/server-config.service';
import { authenticateMcpRequest } from '../auth';

export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isMcpValidationError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('[MCP]');
}

async function readJson(request: NextRequest): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function extractManifest(body: unknown): unknown {
  return isRecord(body) && 'manifest' in body ? body.manifest : body;
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

    const service = new McpServerConfigService(auth.supabase);
    const result = await service.importHttpServerManifest(auth.user.id, extractManifest(body));
    const manager = getSharedMcpClientManager();
    await Promise.all(
      [...result.updated, ...result.created].map((server) => manager.disconnect(server.id)),
    );
    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    console.error('[MCP Servers Import API] POST error:', error);
    const status = isMcpValidationError(error) ? 400 : 500;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import MCP servers',
        ...(isMcpValidationError(error) && error instanceof Error ? { details: error.message } : {}),
      },
      { status },
    );
  }
}
