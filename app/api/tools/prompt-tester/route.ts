// API Route for Prompt Testing Tool
// Secure server-side execution of prompt tests
// Date: October 13, 2025

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIResponse } from '@/lib/llm/openai';
import type { ChatMessage } from '@/lib/llm/openai';
import { PROMPT_TESTER_OPERATIONS } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { operation, prompt, testData, options } = await req.json();

    if (!operation || !prompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: operation, prompt' },
        { status: 400 }
      );
    }

    // Only support test operation via API (others don't need LLM)
    if (operation !== PROMPT_TESTER_OPERATIONS.TEST_PROMPT) {
      return NextResponse.json(
        { error: 'Invalid operation. Use /api/tools for other operations' },
        { status: 400 }
      );
    }

    // Build messages from test data
    const messages: ChatMessage[] = testData?.messages
      ? (testData.messages as ChatMessage[])
      : [{ role: 'system', content: prompt }];

    const startTime = Date.now();

    // Execute prompt via OpenAI (server-side, secure)
    const response = await getOpenAIResponse(
      messages,
      options?.model || 'gpt-4o-mini',
      options?.temperature ?? parseFloat(process.env.PROMPT_TESTER_DEFAULT_TEMPERATURE || '0.7'),
      options?.max_tokens ?? parseInt(process.env.PROMPT_TESTER_DEFAULT_MAX_TOKENS || '1000', 10)
    );

    const latency = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        response,
        latency,
        tokens: 0, // getOpenAIResponse doesn't return token count
      },
    });
  } catch (error) {
    console.error('[PromptTester API] Error:', error);
    return NextResponse.json(
      {
        error: `Prompt test failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      },
      { status: 500 }
    );
  }
}
