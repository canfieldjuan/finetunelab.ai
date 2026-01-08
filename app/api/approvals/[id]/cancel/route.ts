// POST /api/approvals/[id]/cancel - Cancel an approval request
// Date: 2025-11-14

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovalManager } from '@/lib/training/approval-manager';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { reason } = body;

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Reason is required for cancellation' },
        { status: 400 }
      );
    }

    const approvalManager = getApprovalManager();

    // Get approval to check requester
    const approval = await approvalManager.getRequest(id);
    if (!approval) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Approval request not found' },
        { status: 404 }
      );
    }

    // Only requester can cancel
    if (approval.requestedBy !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Only the requester can cancel this approval' },
        { status: 403 }
      );
    }

    // Cancel the request
    await approvalManager.cancel(id, user.id, reason);

    // Get updated request
    const cancelledApproval = await approvalManager.getRequest(id);

    return NextResponse.json({
      success: true,
      message: 'Approval request cancelled successfully',
      approval: cancelledApproval,
    });
  } catch (error) {
    console.error('[ApprovalsAPI] Error cancelling:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to cancel request',
      },
      { status: 500 }
    );
  }
}
