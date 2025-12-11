/**
 * API Route: Validation Sets
 * POST /api/validation-sets - Upload a new validation set
 * GET /api/validation-sets - List user's validation sets
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { episodeService } from '@/lib/graphrag/graphiti/episode-service';

export const runtime = 'nodejs';

interface ValidationSetTestCase {
  prompt: string;
  expected_response: string;
  keywords_required?: string[];
  tone?: string;
  max_length?: number;
  [key: string]: unknown;
}

interface ValidationSetUpload {
  name: string;
  description?: string;
  test_cases: ValidationSetTestCase[];
}

/**
 * POST /api/validation-sets
 * Upload a new validation set
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: ValidationSetUpload = await request.json();

    // Validate required fields
    if (!body.name || !body.test_cases || !Array.isArray(body.test_cases)) {
      return NextResponse.json(
        { error: 'Invalid validation set format. Must include "name" and "test_cases" array.' },
        { status: 400 }
      );
    }

    if (body.test_cases.length === 0) {
      return NextResponse.json(
        { error: 'Validation set must have at least one test case.' },
        { status: 400 }
      );
    }

    // Validate each test case has required fields
    for (let i = 0; i < body.test_cases.length; i++) {
      const testCase = body.test_cases[i];
      if (!testCase.prompt || !testCase.expected_response) {
        return NextResponse.json(
          { error: `Test case ${i + 1} must have "prompt" and "expected_response" fields.` },
          { status: 400 }
        );
      }
    }

    console.log('[ValidationSets] Uploading validation set:', body.name, 'with', body.test_cases.length, 'test cases');

    // Add each test case to Graphiti as an episode
    const episodeIds: string[] = [];
    console.log('[ValidationSets] Adding test cases to Graphiti...');

    for (let i = 0; i < body.test_cases.length; i++) {
      const testCase = body.test_cases[i];
      try {
        const result = await episodeService.addValidationTestCase(
          testCase,
          user.id,
          body.name
        );
        episodeIds.push(result.episodeId);
        console.log(
          `[ValidationSets] Added test case ${i + 1}/${body.test_cases.length} to Graphiti:`,
          result.episodeId,
          `(${result.entitiesCreated} entities, ${result.relationsCreated} relations)`
        );
      } catch (error) {
        console.error(`[ValidationSets] Failed to add test case ${i + 1} to Graphiti:`, error);
        // Continue with other test cases - we'll store partial results
        episodeIds.push(''); // Empty string to maintain index alignment
      }
    }

    console.log(`[ValidationSets] Added ${episodeIds.filter(id => id).length}/${body.test_cases.length} test cases to Graphiti`);

    // Insert into database with Neo4j episode IDs
    const { data, error } = await supabase
      .from('validation_sets')
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description || null,
        test_cases: body.test_cases,
        neo4j_episode_ids: episodeIds,
      })
      .select()
      .single();

    if (error) {
      console.error('[ValidationSets] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save validation set', details: error.message },
        { status: 500 }
      );
    }

    console.log('[ValidationSets] Validation set created:', data.id);

    return NextResponse.json({
      success: true,
      id: data.id,
      name: data.name,
      test_case_count: body.test_cases.length,
      created_at: data.created_at,
    });
  } catch (error) {
    console.error('[ValidationSets] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to upload validation set', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/validation-sets
 * List user's validation sets
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all validation sets for this user
    const { data, error } = await supabase
      .from('validation_sets')
      .select('id, name, description, test_cases, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ValidationSets] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch validation sets', details: error.message },
        { status: 500 }
      );
    }

    // Add test case count to each set
    const validationSets = (data || []).map(set => ({
      id: set.id,
      name: set.name,
      description: set.description,
      test_case_count: Array.isArray(set.test_cases) ? set.test_cases.length : 0,
      created_at: set.created_at,
      updated_at: set.updated_at,
    }));

    return NextResponse.json({
      success: true,
      validation_sets: validationSets,
    });
  } catch (error) {
    console.error('[ValidationSets] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch validation sets', details: errorMessage },
      { status: 500 }
    );
  }
}
