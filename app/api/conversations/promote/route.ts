// API route for promoting conversations to knowledge graph
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { episodeService } from '@/lib/graphrag/graphiti/episode-service';
import { MESSAGE_ROLES } from '@/lib/constants';

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

export async function POST(req: NextRequest) {
  try {
    // Authenticate user - same pattern as upload route
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Get conversation ID from request body
    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId' },
        { status: 400 }
      );
    }

    console.log('[Promote] Promoting conversation:', conversationId, 'for user:', user.id);

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, title, user_id, in_knowledge_graph')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found or access denied' },
        { status: 404 }
      );
    }

    // Check if already promoted
    if (conversation.in_knowledge_graph) {
      return NextResponse.json(
        { error: 'Conversation already promoted' },
        { status: 400 }
      );
    }

    // Load last 20 messages from conversation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(parseInt(process.env.CONVERSATION_PROMOTE_MESSAGE_LIMIT || '20', 10));

    if (msgError) {
      return NextResponse.json(
        { error: 'Failed to load messages' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages to promote' },
        { status: 400 }
      );
    }

    console.log('[Promote] Loaded', messages.length, 'messages');

    // Collect training metadata from conversation
    console.log('[Promote] Collecting training metadata');

    // Count tools used in conversation (basic extraction from content)
    const toolsUsed = new Set<string>();
    let toolCallCount = 0;
    let errorCount = 0;

    // Extract from message content (if structured)
    messages.forEach(msg => {
      if (msg.role === MESSAGE_ROLES.ASSISTANT) {
        // Parse for tool calls (assuming they're logged in content)
        const toolMatches = msg.content.match(/\[TOOL: (\w+)\]/g);
        if (toolMatches) {
          toolMatches.forEach((match: string) => {
            const toolName = match.match(/\[TOOL: (\w+)\]/)?.[1];
            if (toolName) {
              toolsUsed.add(toolName);
              toolCallCount++;
            }
          });
        }

        // Count errors
        if (msg.content.includes('[ERROR]')) {
          errorCount++;
        }
      }
    });

    // Build metadata object
    const trainingMetadata = {
      sessionId: conversationId,
      toolsUsed: Array.from(toolsUsed),
      toolCallCount,
      errorCount,
      messageCount: messages.length,
      userMessageCount: messages.filter(m => m.role === MESSAGE_ROLES.USER).length,
      assistantMessageCount: messages.filter(m => m.role === MESSAGE_ROLES.ASSISTANT).length,
      promotedAt: new Date().toISOString(),
      source: 'conversation_promotion',
    };

    console.log('[Promote] Metadata:', trainingMetadata);

    // Format messages as episode text with metadata header
    const metadataHeader = `
=== Training Session Metadata ===
Session ID: ${trainingMetadata.sessionId}
Tools Used: ${trainingMetadata.toolsUsed.join(', ') || 'none'}
Tool Calls: ${trainingMetadata.toolCallCount}
Errors: ${trainingMetadata.errorCount}
Messages: ${trainingMetadata.messageCount} (User: ${trainingMetadata.userMessageCount}, Assistant: ${trainingMetadata.assistantMessageCount})
Promoted: ${trainingMetadata.promotedAt}
================================
`.trim();

    const conversationText = messages
      .map(msg => `[${msg.role}]: ${msg.content}`)
      .join('\n\n');

    const episodeText = `${metadataHeader}\n\n${conversationText}`;

    // Add to Neo4j knowledge graph via Graphiti
    console.log('[Promote] Adding conversation to knowledge graph');
    const result = await episodeService.addDocument(
      episodeText,
      user.id,
      conversation.title || 'Untitled Conversation',
      trainingMetadata
    );

    console.log('[Promote] Episode created:', result.episodeId);

    // Update conversation record with promotion tracking
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        in_knowledge_graph: true,
        neo4j_episode_id: result.episodeId,
        promoted_at: new Date().toISOString(),
        training_metadata: trainingMetadata,
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('[Promote] Failed to update conversation:', updateError);
      return NextResponse.json(
        { error: 'Failed to update conversation status' },
        { status: 500 }
      );
    }

    console.log('[Promote] Conversation promoted successfully');

    return NextResponse.json({
      success: true,
      episodeId: result.episodeId,
      messagesPromoted: messages.length,
    });

  } catch (error) {
    console.error('[Promote] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
