/**
 * Demo V2 Model Configuration API
 * POST /api/demo/v2/configure - Create a new demo session with model config
 *
 * Security:
 * - API keys are encrypted at rest using AES-256-GCM
 * - Sessions expire after 1 hour
 * - Endpoint URLs are validated (no internal IPs)
 * - Rate limited to 1 session per IP at a time
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptApiKey } from '@/lib/demo/encryption';
import type {
  ConfigureModelRequest,
  ConfigureModelResponse,
} from '@/lib/demo/types';
import crypto from 'crypto';
import dns from 'dns/promises';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

// Session TTL: 1 hour
const SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Validate endpoint URL for security
 * Blocks internal IPs to prevent SSRF attacks
 */
async function validateEndpointUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const parsed = new URL(url);

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTPS protocol in production' };
    }

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Restrict to standard ports
    if (parsed.port && !['80', '443'].includes(parsed.port)) {
      return { valid: false, error: 'Only standard ports (80 and 443) are allowed' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      // Allow localhost for development with explicit flag
      if (process.env.DEMO_ALLOW_LOCALHOST !== 'true') {
        return { valid: false, error: 'Localhost URLs are not allowed in production' };
      }
    }

    // Resolve DNS to check for private IPs
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const address of addresses) {
        // Block private IP ranges
        const privateRanges = [
          /^10\./,                    // 10.0.0.0/8
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
          /^192\.168\./,              // 192.168.0.0/16
          /^169\.254\./,              // Link-local
          /^0\./,                     // 0.0.0.0/8
          /^fd[0-9a-f]{2}:/,           // ULA IPv6
          /^fe80:/,                   // Link-local IPv6
        ];

        for (const range of privateRanges) {
          if (range.test(address.address)) {
            return { valid: false, error: 'Private IP addresses are not allowed' };
          }
        }
      }
    } catch (e) {
      return { valid: false, error: 'Failed to resolve hostname' };
    }


    // URL looks valid
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Get client IP for rate limiting
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Check if IP already has an active session in the database
 */
async function checkActiveSession(ip: string): Promise<{ hasSession: boolean; session_id?: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('demo_model_configs')
    .select('session_id')
    .eq('ip_address', ip)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // Ignore "No rows found" error
    console.error('[checkActiveSession] Supabase error:', error);
  }

  return { hasSession: !!data, session_id: data?.session_id };
}

/**
 * POST /api/demo/v2/configure
 * Create a new demo session with encrypted model configuration
 */
export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  try {
    // Check for existing active session
    const { hasSession, session_id: existingSessionId } = await checkActiveSession(clientIp);
    if (hasSession) {
      return NextResponse.json(
        {
          error: 'You already have an active demo session',
          session_id: existingSessionId,
          message: 'Complete or wait for your current session to expire (1 hour)',
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body: ConfigureModelRequest = await req.json();
    const { endpoint_url, api_key, model_id, model_name } = body;

    // Validate required fields
    if (!endpoint_url || !api_key || !model_id) {
      return NextResponse.json(
        { error: 'Missing required fields: endpoint_url, api_key, model_id' },
        { status: 400 }
      );
    }

    // Validate endpoint URL
    const urlValidation = await validateEndpointUrl(endpoint_url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error },
        { status: 400 }
      );
    }

    // Generate session ID
    const session_id = `demo-${crypto.randomBytes(16).toString('hex')}`;

    // Encrypt API key
    const api_key_encrypted = encryptApiKey(api_key);

    // Calculate expiration
    const expires_at = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    // Store in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: insertError } = await supabase
      .from('demo_model_configs')
      .insert({
        session_id,
        endpoint_url,
        api_key_encrypted,
        model_id,
        model_name: model_name || model_id,
        expires_at,
        connection_tested: false,
        ip_address: clientIp,
      });

    if (insertError) {
      console.error('[API/demo/v2/configure] Database error:', insertError);

      // Handle table not existing
      if (insertError.code === '42P01') {
        return NextResponse.json(
          {
            error: 'Demo v2 tables not yet created. Please run the migration.',
            details: 'Run: supabase/migrations/20251215100000_create_demo_v2_tables.sql',
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create demo session' },
        { status: 500 }
      );
    }

    // Return success response (never expose encrypted key)
    const response: ConfigureModelResponse = {
      session_id,
      expires_at,
      model_id,
      model_name: model_name || model_id,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[API/demo/v2/configure] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/demo/v2/configure
 * Delete a demo session and all associated data
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');
    const clientIp = getClientIp(req);

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session to verify IP
    const { data: session, error: sessionError } = await supabase
      .from('demo_model_configs')
      .select('ip_address')
      .eq('session_id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.ip_address !== clientIp) {
      return NextResponse.json({ error: 'IP address does not match session' }, { status: 403 });
    }

    // Delete batch test results for this session
    await supabase
      .from('demo_batch_test_results')
      .delete()
      .eq('demo_session_id', session_id);

    // Delete batch test runs for this session
    await supabase
      .from('demo_batch_test_runs')
      .delete()
      .eq('demo_session_id', session_id);

    // Delete model config
    const { error: deleteError } = await supabase
      .from('demo_model_configs')
      .delete()
      .eq('session_id', session_id);

    if (deleteError) {
      console.error('[API/demo/v2/configure] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session and all associated data deleted',
    });
  } catch (error) {
    console.error('[API/demo/v2/configure] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/demo/v2/configure
 * Get session status (without exposing API key)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');
    const clientIp = getClientIp(req);

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('demo_model_configs')
      .select('session_id, endpoint_url, model_id, model_name, created_at, expires_at, connection_tested, connection_latency_ms, last_error, ip_address')
      .eq('session_id', session_id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }
    
    if (data.ip_address !== clientIp) {
      return NextResponse.json({ error: 'IP address does not match session' }, { status: 403 });
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired', expired: true },
        { status: 410 }
      );
    }

    // Omit ip_address from the response
    const { ip_address, ...returnData } = data;

    return NextResponse.json(returnData);
  } catch (error) {
    console.error('[API/demo/v2/configure] Get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
