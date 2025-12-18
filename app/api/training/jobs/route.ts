/**
 * @swagger
 * /api/training/jobs:
 *   get:
 *     summary: List training jobs
 *     description: |
 *       Retrieve all training jobs for the authenticated user.
 *
 *       Returns recent training jobs with their current status, including jobs
 *       running locally, on RunPod, Lambda Labs, or other platforms.
 *
 *       The system automatically reconciles job statuses with the backend to
 *       detect stale or orphaned jobs.
 *
 *       **Use Cases:**
 *       - Monitor all training jobs in one place
 *       - Check job status and progress
 *       - Review training history
 *       - Filter and search past jobs
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 15
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "job_abc123"
 *                       model_name:
 *                         type: string
 *                         example: "meta-llama/Llama-2-7b-hf"
 *                       status:
 *                         type: string
 *                         enum: [pending, queued, running, completed, failed, cancelled]
 *                         example: "running"
 *                       started_at:
 *                         type: string
 *                         format: date-time
 *                       completed_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { STATUS } from '@/lib/constants';
import type { TrainingJob } from '@/lib/hooks/useTrainingJobsRealtime';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

interface ReconciledTrainingJob extends TrainingJob {
  _stale?: boolean;
  _originalStatus?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  console.log('[Training Jobs API] GET request');

  try {
    let userId: string | null = null;

    // Try API key authentication first (for SDK access)
    const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');

    if (apiKeyValidation.isValid && apiKeyValidation.userId) {
      userId = apiKeyValidation.userId;
      console.log('[Training Jobs API] Authenticated via API key:', userId);
    } else {
      // Fallback to Bearer token authentication (for web UI)
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Missing authorization' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        console.error('[Training Jobs API] Auth error:', authError);
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      userId = user.id;
      console.log('[Training Jobs API] Authenticated via Bearer token:', userId);
    }

    console.log('[Training Jobs API] Fetching jobs for user:', userId);

    // Fetch recent training jobs (last 50 for search/filter, but display will show 5 by default)
    const { data: jobs, error: fetchError } = await supabase
      .from('local_training_jobs')
      .select('id, model_name, status, started_at, completed_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(process.env.TRAINING_JOBS_LIST_LIMIT || '50', 10));

    if (fetchError) {
      console.error('[Training Jobs API] Fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch training jobs' },
        { status: 500 }
      );
    }

    console.log('[Training Jobs API] Found', jobs?.length || 0, 'jobs');

    // PHASE 2: Reconcile job status against backend
    // For jobs showing as running/pending/queued, verify they're actually active
    if (jobs && jobs.length > 0) {
      const backendUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || 'http://localhost:8000';
      let reconciledCount = 0;

      for (const job of jobs) {
        // Only check potentially stale statuses
        if (job.status === STATUS.RUNNING || job.status === STATUS.PENDING || job.status === STATUS.QUEUED) {
          try {
            // Check if job exists in backend memory (2 second timeout)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), parseInt(process.env.TRAINING_JOB_STATUS_CHECK_TIMEOUT_MS || '2000', 10));

            const response = await fetch(`${backendUrl}/api/training/status/${job.id}`, {
              method: 'GET',
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // If job not found in backend (404) or backend error, it's stale
            if (!response.ok) {
              console.warn(`[Training Jobs API] Job ${job.id.slice(0, 8)}... shows ${job.status} but not in backend (${response.status})`);
              // Don't modify DB here, let periodic cleanup handle it
              // Just flag for frontend display
              (job as ReconciledTrainingJob)._stale = true;
              (job as ReconciledTrainingJob)._originalStatus = job.status;
              reconciledCount++;
            }
          } catch (error) {
            // Backend unreachable or timeout - keep DB status, don't fail
            console.warn(`[Training Jobs API] Cannot validate job ${job.id.slice(0, 8)}... against backend:`, error instanceof Error ? error.message : 'Unknown error');
            // Continue with DB status
          }
        }
      }

      if (reconciledCount > 0) {
        console.log(`[Training Jobs API] Reconciled ${reconciledCount} potentially stale job(s)`);
      }
    }

    return NextResponse.json({
      success: true,
      count: jobs?.length || 0,
      jobs: jobs || [],
    });

  } catch (error) {
    console.error('[Training Jobs API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
