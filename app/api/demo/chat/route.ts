/**
 * Demo Chat API
 * Simple non-streaming endpoint for demo model comparisons
 * POST /api/demo/chat
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// Rate limiting: simple in-memory tracking
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 50; // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `demo:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

export async function POST(req: NextRequest) {
  const rateLimitKey = getRateLimitKey(req);
  const { allowed, remaining } = checkRateLimit(rateLimitKey);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: { 'X-RateLimit-Remaining': '0' },
      }
    );
  }

  try {
    const { messages, model_id } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 }
      );
    }

    if (!model_id) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Determine provider and call appropriate API
    let response: string;

    if (model_id.startsWith('gpt-') || model_id.startsWith('o1') || model_id.startsWith('o3')) {
      // OpenAI models
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key not configured' },
          { status: 500 }
        );
      }

      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: model_id,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        max_tokens: 1024,
      });

      response = completion.choices[0]?.message?.content || '';
    } else if (model_id.startsWith('claude-')) {
      // Anthropic models
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Anthropic API key not configured' },
          { status: 500 }
        );
      }

      const anthropic = new Anthropic({ apiKey });

      // Extract system message if present
      const systemMessage = messages.find((m: { role: string }) => m.role === 'system');
      const nonSystemMessages = messages.filter((m: { role: string }) => m.role !== 'system');

      const completion = await anthropic.messages.create({
        model: model_id,
        max_tokens: 1024,
        system: systemMessage?.content || undefined,
        messages: nonSystemMessages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      response = completion.content[0]?.type === 'text'
        ? completion.content[0].text
        : '';
    } else {
      return NextResponse.json(
        { error: `Unknown model provider for model: ${model_id}` },
        { status: 400 }
      );
    }

    const latency = Date.now() - startTime;

    return NextResponse.json(
      {
        response,
        latency,
        model_id,
      },
      {
        headers: { 'X-RateLimit-Remaining': String(remaining) },
      }
    );
  } catch (error) {
    console.error('[API/demo/chat] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific API errors
    if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
      return NextResponse.json(
        { error: 'API authentication failed. Check your API keys.' },
        { status: 401 }
      );
    }

    if (errorMessage.includes('403') || errorMessage.includes('does not have access')) {
      return NextResponse.json(
        { error: 'Your API key does not have access to this model. Please select a different model.' },
        { status: 403 }
      );
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return NextResponse.json(
        { error: 'Model API rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Model request failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
