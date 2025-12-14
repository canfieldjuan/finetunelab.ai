/**
 * Integrations API
 * GET /api/integrations - List user's integrations
 * POST /api/integrations - Create new integration
 * Date: 2025-12-12
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { integrationService } from '@/lib/integrations/integration.service';
import { IntegrationType, INTEGRATION_METADATA, DEFAULT_INTEGRATION_CONFIG } from '@/lib/integrations/integration.types';

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

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const integrations = await integrationService.getUserIntegrations(user.id);

    // Also return available integration types
    const availableTypes = Object.keys(INTEGRATION_METADATA) as IntegrationType[];

    return NextResponse.json({
      integrations,
      available: availableTypes.map(type => ({
        type,
        ...INTEGRATION_METADATA[type],
        configured: integrations.some(i => i.integration_type === type),
      })),
    });
  } catch (err) {
    console.error('[IntegrationsAPI] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { integration_type, credentials, config, name } = body;

    if (!integration_type || !INTEGRATION_METADATA[integration_type as IntegrationType]) {
      return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
    }

    if (!credentials || typeof credentials !== 'object') {
      return NextResponse.json({ error: 'Credentials are required' }, { status: 400 });
    }

    // Validate required fields
    const metadata = INTEGRATION_METADATA[integration_type as IntegrationType];
    for (const field of metadata.fields) {
      if (field.required && !credentials[field.key]) {
        return NextResponse.json({ error: `${field.label} is required` }, { status: 400 });
      }
    }

    const integration = await integrationService.upsertIntegration(
      user.id,
      integration_type as IntegrationType,
      credentials,
      config || DEFAULT_INTEGRATION_CONFIG,
      name
    );

    return NextResponse.json({ integration });
  } catch (err) {
    console.error('[IntegrationsAPI] POST error:', err);
    return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 });
  }
}
