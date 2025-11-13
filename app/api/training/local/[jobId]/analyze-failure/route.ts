/**
 * Training Failure Analysis API
 * GET /api/training/local/[jobId]/analyze-failure
 *
 * Purpose: Analyze a failed training job and return intelligent config suggestions
 * Phase: Intelligent Resume Implementation - Phase 3
 * Date: 2025-11-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[AnalyzeFailure] Module loaded');

/**
 * GET handler - Analyze failure and generate suggestions
 * Returns: { success, analysis: { error_type, description, suggestions } }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Await params per Next.js 15 requirements
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[AnalyzeFailure] GET request for job:', jobId);

  // Environment validation
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[AnalyzeFailure] CRITICAL: Missing Supabase environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Authentication - verify user is logged in
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('[AnalyzeFailure] No authorization header provided');
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[AnalyzeFailure] Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[AnalyzeFailure] User authenticated:', user.id);

    // Get job from database
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      console.log('[AnalyzeFailure] Job not found:', jobId);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify job is failed or cancelled
    if (!['failed', 'cancelled'].includes(job.status)) {
      console.log('[AnalyzeFailure] Job is not failed/cancelled, status:', job.status);
      return NextResponse.json(
        { error: `Can only analyze failed/cancelled jobs. Current status: ${job.status}` },
        { status: 400 }
      );
    }

    // Check if error_message exists
    if (!job.error_message) {
      console.log('[AnalyzeFailure] No error message for job:', jobId);
      return NextResponse.json({
        success: true,
        analysis: {
          error_type: 'no_error',
          error_phase: 'unknown',
          description: 'No error message available for this job',
          confidence: 'low',
          suggestions: []
        },
        job_config: job.config || {},  // Include job config for manual editing
      });
    }

    // Call Python error analyzer CLI
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const scriptPath = process.cwd() + '/lib/training/analyze_error_cli.py';

    // Escape quotes in error message and config for shell
    const errorEscaped = job.error_message.replace(/"/g, '\\"');
    const configJson = JSON.stringify(job.config || {});
    const configEscaped = configJson.replace(/"/g, '\\"');

    const analysisCommand = `${pythonPath} "${scriptPath}" --job-id "${jobId}" --error "${errorEscaped}" --config "${configEscaped}"`;

    console.log('[AnalyzeFailure] Running analysis CLI for job:', jobId);

    try {
      const { stdout, stderr } = await execAsync(analysisCommand, {
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });

      if (stderr) {
        console.warn('[AnalyzeFailure] CLI stderr:', stderr);
      }

      const analysis = JSON.parse(stdout);

      console.log('[AnalyzeFailure] Analysis complete:', {
        error_type: analysis.error_type,
        suggestions: analysis.suggestions.length
      });

      return NextResponse.json({
        success: true,
        analysis,
        job_config: job.config || {},  // Include job config for manual editing
      });

    } catch (execError) {
      console.error('[AnalyzeFailure] CLI execution error:', execError);

      // Check if it's a timeout
      if (execError instanceof Error && execError.message.includes('timeout')) {
        return NextResponse.json(
          {
            error: 'Analysis timed out',
            details: 'Error analysis took too long to complete'
          },
          { status: 504 }
        );
      }

      // Check if it's a JSON parse error (CLI returned invalid JSON)
      if (execError instanceof Error && execError.message.includes('JSON')) {
        return NextResponse.json(
          {
            error: 'Analysis failed',
            details: 'Invalid response from error analyzer'
          },
          { status: 500 }
        );
      }

      // Generic error
      return NextResponse.json(
        {
          error: 'Analysis failed',
          details: execError instanceof Error ? execError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[AnalyzeFailure] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze failure',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
