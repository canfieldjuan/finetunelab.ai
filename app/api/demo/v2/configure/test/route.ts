/**
 * Demo V2 Connection Test API
 * POST /api/demo/v2/configure/test - Test connection to user's model endpoint
 *
 * Makes a single test call to verify the endpoint is reachable and API key is valid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptApiKey } from '@/lib/demo/encryption';
import type { TestConnectionResponse } from '@/lib/demo/types';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test timeout: 30 seconds
const TEST_TIMEOUT_MS = 30000;

/**
 * Call an OpenAI-compatible endpoint for testing
 */
async function testModelEndpoint(
  endpointUrl: string,
  apiKey: string,
  modelId: string
): Promise<{ success: boolean; latency_ms: number; response?: string; error?: string }> {
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'user', content: 'Say "Connection successful" in exactly those two words.' }
        ],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latency_ms = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        if (errorBody.length < 200) {
          errorMessage = errorBody || errorMessage;
        }
      }

      // Provide helpful error messages
      if (response.status === 401) {
        return {
          success: false,
          latency_ms,
          error: 'Invalid API key. Please check your credentials.',
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          latency_ms,
          error: `Model "${modelId}" not found. Please check the model ID.`,
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          latency_ms,
          error: 'Rate limited by the model provider. Please try again later.',
        };
      }

      return {
        success: false,
        latency_ms,
        error: `API error: ${errorMessage}`,
      };
    }

    const data = await response.json();
    const modelResponse = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      latency_ms,
      response: modelResponse.slice(0, 100), // Truncate for safety
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const latency_ms = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          latency_ms,
          error: `Connection timed out after ${TEST_TIMEOUT_MS / 1000} seconds`,
        };
      }

      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          latency_ms,
          error: 'Could not connect to the endpoint. Please check the URL.',
        };
      }

      return {
        success: false,
        latency_ms,
        error: `Connection error: ${error.message}`,
      };
    }

    return {
      success: false,
      latency_ms,
      error: 'Unknown connection error',
    };
  }
}

/**
 * POST /api/demo/v2/configure/test
 * Test connection to user's model endpoint
 */
export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session config (including encrypted API key)
    const { data: config, error: fetchError } = await supabase
      .from('demo_model_configs')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (fetchError || !config) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date(config.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 410 }
      );
    }

    // Decrypt API key
    let apiKey: string;
    try {
      apiKey = decryptApiKey(config.api_key_encrypted);
    } catch (decryptError) {
      console.error('[API/demo/v2/configure/test] Decryption error:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt API key. Session may be corrupted.' },
        { status: 500 }
      );
    }

    // Test the connection
    const testResult = await testModelEndpoint(
      config.endpoint_url,
      apiKey,
      config.model_id
    );

    // Update the config with test results
    await supabase
      .from('demo_model_configs')
      .update({
        connection_tested: testResult.success,
        connection_latency_ms: testResult.latency_ms,
        last_error: testResult.success ? null : testResult.error,
      })
      .eq('session_id', session_id);

    // Return response (never expose API key)
    const response: TestConnectionResponse = {
      success: testResult.success,
      latency_ms: testResult.latency_ms,
      error: testResult.error,
      model_response: testResult.response,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API/demo/v2/configure/test] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
