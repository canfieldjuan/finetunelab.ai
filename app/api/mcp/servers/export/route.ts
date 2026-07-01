import { NextRequest, NextResponse } from 'next/server';
import { McpServerConfigService } from '@/lib/tools/mcp/server-config.service';
import { authenticateMcpRequest } from '../auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateMcpRequest(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const service = new McpServerConfigService(auth.supabase);
    const manifest = await service.exportUserServers(auth.user.id);
    return NextResponse.json({ success: true, manifest });
  } catch (error) {
    console.error('[MCP Servers Export API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export MCP servers',
      },
      { status: 500 },
    );
  }
}
