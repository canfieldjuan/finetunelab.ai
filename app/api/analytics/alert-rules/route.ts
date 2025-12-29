/**
 * Metric Alert Rules API
 * Manage metric-based alert rules for traces and anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET - List all alert rules for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's alert rules
    const { data: rules, error: rulesError } = await supabase
      .from('metric_alert_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (rulesError) {
      console.error('[Alert Rules API] Error fetching rules:', rulesError);
      return NextResponse.json({ error: rulesError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rules: rules || [],
    });
  } catch (error) {
    console.error('[Alert Rules API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new alert rule
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate required fields
    const {
      rule_name,
      metric_type,
      threshold_value,
      comparison_operator,
      time_window_minutes,
      aggregation_method,
    } = body;

    if (!rule_name || !metric_type || threshold_value === undefined || !comparison_operator || !time_window_minutes || !aggregation_method) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate metric_type
    const validMetricTypes = ['latency', 'error_rate', 'cost', 'throughput', 'ttft', 'token_usage', 'anomaly_severity'];
    if (!validMetricTypes.includes(metric_type)) {
      return NextResponse.json(
        { error: `Invalid metric_type. Must be one of: ${validMetricTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate comparison_operator
    const validOperators = ['>', '<', '>=', '<=', '==', '!='];
    if (!validOperators.includes(comparison_operator)) {
      return NextResponse.json(
        { error: `Invalid comparison_operator. Must be one of: ${validOperators.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate aggregation_method
    const validAggregations = ['p50', 'p95', 'p99', 'avg', 'max', 'min', 'count', 'sum'];
    if (!validAggregations.includes(aggregation_method)) {
      return NextResponse.json(
        { error: `Invalid aggregation_method. Must be one of: ${validAggregations.join(', ')}` },
        { status: 400 }
      );
    }

    // Create the alert rule
    const { data: rule, error: createError } = await supabase
      .from('metric_alert_rules')
      .insert({
        user_id: user.id,
        rule_name,
        description: body.description || null,
        metric_type,
        threshold_value,
        comparison_operator,
        time_window_minutes,
        aggregation_method,
        model_filter: body.model_filter || null,
        operation_filter: body.operation_filter || null,
        status_filter: body.status_filter || null,
        notify_email: body.notify_email !== undefined ? body.notify_email : true,
        notify_webhooks: body.notify_webhooks !== undefined ? body.notify_webhooks : false,
        notify_integrations: body.notify_integrations !== undefined ? body.notify_integrations : false,
        cooldown_minutes: body.cooldown_minutes || 30,
        enabled: body.enabled !== undefined ? body.enabled : true,
      })
      .select()
      .single();

    if (createError) {
      console.error('[Alert Rules API] Error creating rule:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rule,
    }, { status: 201 });
  } catch (error) {
    console.error('[Alert Rules API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update an existing alert rule
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { rule_id, ...updates } = body;

    if (!rule_id) {
      return NextResponse.json({ error: 'rule_id is required' }, { status: 400 });
    }

    // Update the rule (RLS ensures user can only update their own rules)
    const { data: rule, error: updateError } = await supabase
      .from('metric_alert_rules')
      .update(updates)
      .eq('id', rule_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[Alert Rules API] Error updating rule:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('[Alert Rules API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete an alert rule
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('rule_id');

    if (!ruleId) {
      return NextResponse.json({ error: 'rule_id parameter is required' }, { status: 400 });
    }

    // Delete the rule (RLS ensures user can only delete their own rules)
    const { error: deleteError } = await supabase
      .from('metric_alert_rules')
      .delete()
      .eq('id', ruleId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[Alert Rules API] Error deleting rule:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('[Alert Rules API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
