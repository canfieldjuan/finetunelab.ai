/**
 * API Route - Anomaly Detection
 *
 * Retrieves and acknowledges detected anomalies for proactive monitoring
 *
 * GET /api/analytics/anomalies - List anomalies with filtering
 * PATCH /api/analytics/anomalies - Acknowledge anomaly
 *
 * Phase 2.2: Anomaly Detection API
 * Date: 2025-10-25
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type AnomalyStatus = 'new' | 'investigating' | 'mitigating' | 'resolved' | 'dismissed' | string;

interface AnomalyPatchRequest {
  anomaly_id: string;
  acknowledged?: boolean;
  resolution_status?: AnomalyStatus;
  resolution_notes?: string;
}

function debugLog(context: string, data: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Anomalies API - ${context}]`, data);
  }
}

/**
 * GET - List anomalies with filtering
 */
export async function GET(req: NextRequest) {
  debugLog('GET', 'Request received');

  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    debugLog('GET', `User authenticated: ${user.id}`);

    // Extract query parameters
    const { searchParams } = new URL(req.url);
    const severity = searchParams.get('severity');
    const resolution_status = searchParams.get('resolution_status') || 'pending';
    const metric_name = searchParams.get('metric_name');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    debugLog('GET', {
      severity,
      resolution_status,
      metric_name,
      limit,
      offset
    });

    // Build query
    let query = supabase
      .from('anomaly_detections')
      .select('*')
      .eq('user_id', user.id)
      .order('detected_at', { ascending: false });

    // Apply filters
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (resolution_status) {
      query = query.eq('resolution_status', resolution_status);
    }
    if (metric_name) {
      query = query.eq('metric_name', metric_name);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: anomalies, error: queryError } = await query;

    if (queryError) {
      debugLog('GET', `Query error: ${queryError.message}`);
      return NextResponse.json(
        { error: `Failed to retrieve anomalies: ${queryError.message}` },
        { status: 500 }
      );
    }

    debugLog('GET', `Retrieved ${anomalies?.length || 0} anomalies`);

    return NextResponse.json({
      success: true,
      data: anomalies,
      pagination: {
        limit,
        offset,
        total: anomalies?.length || 0
      }
    });

  } catch (error) {
    console.error('[Anomalies API - GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Acknowledge or resolve anomaly
 */
export async function PATCH(req: NextRequest) {
  debugLog('PATCH', 'Request received');

  try {
    // Authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = (await req.json()) as AnomalyPatchRequest;
    const { anomaly_id, acknowledged, resolution_status, resolution_notes } = body;

    if (!anomaly_id) {
      return NextResponse.json(
        { error: 'anomaly_id is required' },
        { status: 400 }
      );
    }

    debugLog('PATCH', `Updating anomaly ${anomaly_id}`);

    // Build update object
    type AnomalyUpdateData = {
      acknowledged?: boolean;
      acknowledged_by?: string;
      acknowledged_at?: string;
      resolution_status?: AnomalyStatus;
      resolution_notes?: string;
    };
    const updateData: AnomalyUpdateData = {};
    if (acknowledged !== undefined) {
      updateData.acknowledged = acknowledged;
      updateData.acknowledged_by = user.id;
      updateData.acknowledged_at = new Date().toISOString();
    }
    if (resolution_status) {
      updateData.resolution_status = resolution_status;
    }
    if (resolution_notes) {
      updateData.resolution_notes = resolution_notes;
    }

    // Update anomaly
    const { data: updatedAnomaly, error: updateError } = await supabase
      .from('anomaly_detections')
      .update(updateData)
      .eq('id', anomaly_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      debugLog('PATCH', `Update error: ${updateError.message}`);
      return NextResponse.json(
        { error: `Failed to update anomaly: ${updateError.message}` },
        { status: 500 }
      );
    }

    debugLog('PATCH', `Anomaly updated: ${anomaly_id}`);

    return NextResponse.json({
      success: true,
      data: updatedAnomaly
    });

  } catch (error) {
    console.error('[Anomalies API - PATCH] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
