/**
 * Individual Integration API
 * GET /api/integrations/[type] - Get integration details
 * PUT /api/integrations/[type] - Update integration
 * DELETE /api/integrations/[type] - Delete integration
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { integrationService } from '@/lib/integrations/integration.service';
import { IntegrationType, INTEGRATION_METADATA } from '@/lib/integrations/integration.types';

export const runtime = 'nodejs';

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await params;

  if (!INTEGRATION_METADATA[type as IntegrationType]) {
    return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
  }

  try {
    const integrations = await integrationService.getUserIntegrations(user.id);
    const integration = integrations.find(i => i.integration_type === type);

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    return NextResponse.json({ integration });
  } catch (err) {
    console.error('[IntegrationAPI] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch integration' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await params;

  if (!INTEGRATION_METADATA[type as IntegrationType]) {
    return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { credentials, config, enabled, name } = body;

    // Handle enable/disable toggle
    if (enabled !== undefined && !credentials && !config) {
      await integrationService.toggleEnabled(user.id, type as IntegrationType, enabled);
      const integrations = await integrationService.getUserIntegrations(user.id);
      const integration = integrations.find(i => i.integration_type === type);
      return NextResponse.json({ integration });
    }

    // Handle config update only
    if (config && !credentials) {
      const integration = await integrationService.updateConfig(user.id, type as IntegrationType, config);
      return NextResponse.json({ integration });
    }

    // Handle full update with credentials
    if (credentials) {
      const integration = await integrationService.upsertIntegration(
        user.id,
        type as IntegrationType,
        credentials,
        config,
        name
      );
      return NextResponse.json({ integration });
    }

    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  } catch (err) {
    console.error('[IntegrationAPI] PUT error:', err);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await params;

  if (!INTEGRATION_METADATA[type as IntegrationType]) {
    return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
  }

  try {
    await integrationService.deleteIntegration(user.id, type as IntegrationType);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[IntegrationAPI] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 });
  }
}
