/**
 * @swagger
 * /api/training/predictions/{jobId}/epochs:
 *   get:
 *     summary: Get prediction epochs summary
 *     description: |
 *       List all epochs with prediction counts for a training job.
 *
 *       Use this endpoint to build epoch selectors or get an overview of
 *       prediction data availability across training epochs.
 *
 *       **Use Cases:**
 *       - Build epoch dropdown selectors in UI
 *       - Show prediction coverage across epochs
 *       - Validate prediction data availability
 *       - Display training progress summary
 *     tags:
 *       - Metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: Training job ID
 *         example: "job_abc123"
 *     responses:
 *       200:
 *         description: Epoch summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                   example: "job_abc123"
 *                 epochs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       epoch:
 *                         type: integer
 *                         example: 1
 *                       prediction_count:
 *                         type: integer
 *                         example: 5
 *                       latest_step:
 *                         type: integer
 *                         example: 250
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[Predictions Epochs API] GET epochs for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    // Try API key authentication first (for SDK access)
    const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');
    let userId: string | null = null;

    if (apiKeyValidation.isValid && apiKeyValidation.userId) {
      // API key authentication successful
      userId = apiKeyValidation.userId;
      console.log('[Predictions Epochs API] Authenticated via API key:', userId);
    } else {
      // Fall back to bearer token authentication (for web UI)
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const supabaseAuth = createClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE',
        { global: { headers: { Authorization: authHeader } } }
      );

      const {
        data: { user },
        error: authError,
      } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        console.log('[Predictions Epochs API] Auth failed:', authError?.message);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      userId = user.id;
      console.log('[Predictions Epochs API] Authenticated via bearer token:', userId);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jobQuery = await supabase
      .from('local_training_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobQuery.error || !jobQuery.data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const { data: predictions, error: predictionsError } = await supabase
      .from('training_predictions')
      .select('epoch, step')
      .eq('job_id', jobId)
      .order('epoch', { ascending: true });

    if (predictionsError) {
      console.error('[Predictions Epochs API] Query error:', predictionsError);
      return NextResponse.json(
        { error: 'Failed to fetch epochs' },
        { status: 500 }
      );
    }

    const epochMap = new Map<
      number,
      { epoch: number; prediction_count: number; latest_step: number }
    >();

    for (const pred of predictions || []) {
      const existing = epochMap.get(pred.epoch);
      if (existing) {
        existing.prediction_count += 1;
        existing.latest_step = Math.max(existing.latest_step, pred.step);
      } else {
        epochMap.set(pred.epoch, {
          epoch: pred.epoch,
          prediction_count: 1,
          latest_step: pred.step,
        });
      }
    }

    const epochs = Array.from(epochMap.values()).sort(
      (a, b) => a.epoch - b.epoch
    );

    console.log('[Predictions Epochs API] Found', epochs.length, 'epochs');

    return NextResponse.json({
      job_id: jobId,
      epochs,
    });
  } catch (error) {
    console.error('[Predictions Epochs API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get epochs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
