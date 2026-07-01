import { NextRequest, NextResponse } from 'next/server';
import { listMcpServerCatalog } from '@/lib/tools/mcp/catalog';
import { authenticateMcpRequest } from '../auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateMcpRequest(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const catalog = listMcpServerCatalog();
    return NextResponse.json({ success: true, catalog, count: catalog.length });
  } catch (error) {
    console.error('[MCP Servers Catalog API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list MCP server catalog',
      },
      { status: 500 },
    );
  }
}
