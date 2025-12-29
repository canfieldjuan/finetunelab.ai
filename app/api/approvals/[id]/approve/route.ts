// POST /api/approvals/[id]/approve - Approve an approval request
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
    const { comment } = body;

    const approvalManager = getApprovalManager();

    // Check if user can approve
    const canApprove = await approvalManager.canApprove(id, user.id);
    if (!canApprove) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to approve this request' },
        { status: 403 }
      );
    }

    // Approve the request
    await approvalManager.approve(id, {
      userId: user.id,
      comment
    });

    // Get updated request
    const approval = await approvalManager.getRequest(id);

    return NextResponse.json({
      success: true,
      message: 'Approval request approved successfully',
      approval,
    });
  } catch (error) {
    console.error('[ApprovalsAPI] Error approving:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to approve request',
      },
      { status: 500 }
    );
  }
}
