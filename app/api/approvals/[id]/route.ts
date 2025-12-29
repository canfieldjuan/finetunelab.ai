// API routes for individual approval operations
// GET /api/approvals/[id] - Get approval details
// POST /api/approvals/[id]/approve - Approve request
// POST /api/approvals/[id]/reject - Reject request
// POST /api/approvals/[id]/cancel - Cancel request
// Date: 2025-11-14

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovalManager } from '@/lib/training/approval-manager';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/approvals/[id] - Get approval details
// ============================================================================

export async function GET(
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

    const approvalManager = getApprovalManager();
    const approval = await approvalManager.getRequest(id);

    if (!approval) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Approval request not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to view this approval
    const canView =
      approval.requestedBy === user.id ||
      approval.notifyUsers?.includes(user.id) ||
      approval.allowedApprovers?.includes(user.id) ||
      (approval.allowedApprovers?.length === 0); // Anyone can approve

    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to view this approval' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      approval,
    });
  } catch (error) {
    console.error('[ApprovalsAPI] Error getting approval:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to get approval',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/approvals/[id]/* - Handle approval actions
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get action from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const action = pathParts[pathParts.length - 1]; // approve, reject, or cancel

    // Validate action
    if (!['approve', 'reject', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid action. Must be approve, reject, or cancel' },
        { status: 400 }
      );
    }

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
    const { comment, reason } = body;

    const approvalManager = getApprovalManager();

    // Handle different actions
    if (action === 'approve') {
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
    } else if (action === 'reject') {
      // Validate reason
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Reason is required for rejection' },
          { status: 400 }
        );
      }

      // Check if user can approve (same permission for reject)
      const canApprove = await approvalManager.canApprove(id, user.id);
      if (!canApprove) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You do not have permission to reject this request' },
          { status: 403 }
        );
      }

      // Reject the request
      await approvalManager.reject(id, {
        userId: user.id,
        reason,
        comment
      });

      // Get updated request
      const approval = await approvalManager.getRequest(id);

      return NextResponse.json({
        success: true,
        message: 'Approval request rejected successfully',
        approval,
      });
    } else if (action === 'cancel') {
      // Only requester can cancel
      const approval = await approvalManager.getRequest(id);
      if (!approval) {
        return NextResponse.json(
          { error: 'Not Found', message: 'Approval request not found' },
          { status: 404 }
        );
      }

      if (approval.requestedBy !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Only the requester can cancel this approval' },
          { status: 403 }
        );
      }

      // Validate reason
      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Reason is required for cancellation' },
          { status: 400 }
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
    }

    // Should never reach here
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Unknown error occurred' },
      { status: 500 }
    );
  } catch (error) {
    console.error('[ApprovalsAPI] Error processing action:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to process action',
      },
      { status: 500 }
    );
  }
}
