// API routes for approval management
// GET /api/approvals/pending - List pending approvals for the authenticated user
// GET /api/approvals/history - Get approval history with filters
// Date: 2025-11-14

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApprovalManager } from '@/lib/training/approval-manager';
import type { ApprovalStatus } from '@/lib/training/types/approval-types';

export const runtime = 'nodejs';

// ============================================================================
// GET /api/approvals/pending - List pending approvals
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('type') || 'pending';
  
  try {
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

    // Handle different endpoints
    if (endpoint === 'history') {
      // Get approval history
      const workflowId = searchParams.get('workflowId') || undefined;
      const status = searchParams.get('status') || undefined;
      const startDate = searchParams.get('startDate') 
        ? new Date(searchParams.get('startDate')!) 
        : undefined;
      const endDate = searchParams.get('endDate') 
        ? new Date(searchParams.get('endDate')!) 
        : undefined;
      const limit = searchParams.get('limit') 
        ? parseInt(searchParams.get('limit')!) 
        : 100;
      const offset = searchParams.get('offset') 
        ? parseInt(searchParams.get('offset')!) 
        : 0;

      const approvals = await approvalManager.getApprovals({
        workflowId,
        status: status as ApprovalStatus | undefined,
        startDate,
        endDate,
        limit,
        offset,
      });

      return NextResponse.json({
        success: true,
        approvals,
        total: approvals.length,
      });
    } else {
      // Get pending approvals (default)
      const approvals = await approvalManager.getPendingApprovals({ userId: user.id });

      return NextResponse.json({
        success: true,
        approvals,
        total: approvals.length,
      });
    }
  } catch (error) {
    console.error('[ApprovalsAPI] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to fetch approvals',
      },
      { status: 500 }
    );
  }
}
