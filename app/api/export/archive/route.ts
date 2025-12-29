/**
 * API Route - Archive Operations
 *
 * Handles conversation archiving, restoration, and listing.
 * POST /api/export/archive - Archive conversations
 * PATCH /api/export/archive - Restore conversations
 * GET /api/export/archive - List archived conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { archiveService } from '@/lib/export';

// Use Node.js runtime
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

/**
 * Authenticate user helper
 */
async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { error: 'Unauthorized - no auth header', user: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'Unauthorized - invalid token', user: null };
  }

  return { error: null, user };
}

/**
 * POST - Archive conversations
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await authenticateUser(req);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // Parse request body
    const { conversationIds, permanentDelete = false } = await req.json();

    // Validate conversation IDs
    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid conversationIds array' },
        { status: 400 }
      );
    }

    console.log('[Archive] Archiving conversations:', {
      userId: user.id,
      count: conversationIds.length,
      permanentDelete
    });

    // Archive conversations
    const result = await archiveService.archive(user.id, {
      conversationIds,
      permanentDelete
    });

    console.log('[Archive] Archived successfully:', {
      archivedCount: result.archivedCount
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[Archive] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Restore archived conversations
 */
export async function PATCH(req: NextRequest) {
  try {
    const { error, user } = await authenticateUser(req);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // Parse request body
    const { conversationIds } = await req.json();

    // Validate conversation IDs
    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid conversationIds array' },
        { status: 400 }
      );
    }

    console.log('[Archive] Restoring conversations:', {
      userId: user.id,
      count: conversationIds.length
    });

    // Restore conversations
    const result = await archiveService.restore(user.id, {
      conversationIds
    });

    console.log('[Archive] Restored successfully:', {
      restoredCount: result.restoredCount
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[Archive] Restore error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - List archived conversations
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await authenticateUser(req);
    if (error || !user) {
      return NextResponse.json({ error }, { status: 401 });
    }

    console.log('[Archive] Listing archived conversations for user:', user.id);

    // Get archived conversations
    const archived = await archiveService.getArchived(user.id);

    console.log('[Archive] Found', archived.length, 'archived conversations');

    return NextResponse.json({
      success: true,
      archived,
      count: archived.length
    });

  } catch (error) {
    console.error('[Archive] List error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
