// API route for collecting widget feedback
// POST /api/feedback/collect - Collect feedback from embedded widget
// Date: 2025-10-17

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequest } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

// ============================================================================
// POST /api/feedback/collect - Collect feedback from embedded widget
// Authenticates via API key, stores feedback in widget_feedback table
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[FeedbackAPI] POST /api/feedback/collect - Collecting feedback');

  try {
    // Validate API key from headers
    const validation = await validateRequest(request.headers);
    
    if (!validation.isValid) {
      console.log('[FeedbackAPI] Invalid API key:', validation.errorMessage);
      return NextResponse.json(
        {
          success: false,
          error: validation.errorMessage || 'Unauthorized',
          rateLimitExceeded: validation.rateLimitExceeded,
        },
        { status: validation.rateLimitExceeded ? 429 : 401 }
      );
    }

    console.log('[FeedbackAPI] Valid API key for user:', validation.userId);

    // Parse and validate request body
    const body = await request.json();

    // message_id is optional - allows both chat message feedback and general widget feedback
    const isMessageFeedback = !!body.message_id;
    
    console.log('[FeedbackAPI] Feedback type:', isMessageFeedback ? 'message' : 'general');

    // Validate at least one feedback type is provided
    if (!body.rating && !body.thumbs && !body.sentiment && !body.comment && !body.category_tags && !body.tags) {
      console.log('[FeedbackAPI] No feedback data provided');
      return NextResponse.json(
        {
          success: false,
          error: 'At least one feedback field required',
          options: ['rating', 'sentiment', 'thumbs', 'comment', 'tags', 'category_tags'],
        },
        { status: 400 }
      );
    }

    // Validate rating if provided (1-5)
    if (body.rating !== undefined && body.rating !== null) {
      const rating = Number(body.rating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        console.log('[FeedbackAPI] Invalid rating:', body.rating);
        return NextResponse.json(
          {
            success: false,
            error: 'Rating must be between 1 and 5',
          },
          { status: 400 }
        );
      }
    }

    // Validate thumbs if provided (up/down)
    if (body.thumbs && !['up', 'down'].includes(body.thumbs)) {
      console.log('[FeedbackAPI] Invalid thumbs:', body.thumbs);
      return NextResponse.json(
        {
          success: false,
          error: 'Thumbs must be "up" or "down"',
        },
        { status: 400 }
      );
    }

    // Validate sentiment if provided (positive/negative) - convert to thumbs format
    if (body.sentiment && !['positive', 'negative'].includes(body.sentiment)) {
      console.log('[FeedbackAPI] Invalid sentiment:', body.sentiment);
      return NextResponse.json(
        {
          success: false,
          error: 'Sentiment must be "positive" or "negative"',
        },
        { status: 400 }
      );
    }

    // Convert sentiment to thumbs for database storage
    const thumbs = body.sentiment 
      ? (body.sentiment === 'positive' ? 'up' : 'down')
      : body.thumbs || null;

    console.log('[FeedbackAPI] Storing feedback, message_id:', body.message_id || 'none (general feedback)');

    // Get client IP for tracking
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Create Supabase client with service role for insertion
    // Service role is needed because widget feedback INSERT policy requires it
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseServiceKey) {
      console.error('[FeedbackAPI] Missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
        },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from('widget_feedback')
      .insert({
        user_id: validation.userId,
        api_key_hash: validation.keyHash,
        message_id: body.message_id || null,
        rating: body.rating || null,
        thumbs: thumbs,
        comment: body.comment || null,
        category_tags: body.tags || body.category_tags || null,
        metadata: {
          page_url: body.page_url,
          user_agent: body.user_agent,
          ...(body.metadata || {}),
        },
        ip_address: clientIp,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('[FeedbackAPI] Insert error:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to store feedback',
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    console.log('[FeedbackAPI] Feedback stored successfully:', feedback?.id);
    
    // Return success with CORS headers for cross-origin requests
    return NextResponse.json({
      success: true,
      feedbackId: feedback?.id,
      message: 'Feedback received successfully',
    }, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Workspace-API-Key, Authorization',
      },
    });

  } catch (error) {
    console.error('[FeedbackAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to collect feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Workspace-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
