/**
 * @swagger
 * /api/training/predictions/{jobId}/trends:
 *   get:
 *     summary: Get prediction quality trends
 *     description: |
 *       Retrieve aggregated quality metrics across epochs for visualization.
 *
 *       Returns average scores per epoch, allowing trend analysis of model
 *       improvement during training. This endpoint aggregates individual
 *       prediction scores to show overall quality progression.
 *
 *       **Use Cases:**
 *       - Visualize quality improvement over training epochs
 *       - Detect training degradation early
 *       - Compare model quality across checkpoints
 *       - Track learning velocity
 *
 *       **Metrics Returned:**
 *       - Average exact match rate per epoch
 *       - Average character error rate per epoch
 *       - Average word overlap per epoch
 *       - Overall improvement percentage
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
 *         description: Trends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                   example: "job_abc123"
 *                 trends:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       epoch:
 *                         type: integer
 *                         example: 1
 *                       step:
 *                         type: integer
 *                         example: 250
 *                       sample_count:
 *                         type: integer
 *                         example: 5
 *                       avg_exact_match:
 *                         type: number
 *                         nullable: true
 *                         example: 0.6
 *                       avg_char_error_rate:
 *                         type: number
 *                         nullable: true
 *                         example: 0.23
 *                       avg_word_overlap:
 *                         type: number
 *                         nullable: true
 *                         example: 0.85
 *                       min_char_error_rate:
 *                         type: number
 *                         nullable: true
 *                         example: 0.1
 *                       max_char_error_rate:
 *                         type: number
 *                         nullable: true
 *                         example: 0.4
 *                 overall_improvement:
 *                   type: number
 *                   nullable: true
 *                   description: Percentage improvement from first to last epoch
 *                   example: 45.2
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
import type { PredictionsTrendsResponse } from '@/lib/training/types/predictions-types';
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

  console.log('[Predictions Trends API] GET trends for job:', jobId);

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
      console.log('[Predictions Trends API] Authenticated via API key:', userId);
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
        console.log('[Predictions Trends API] Auth failed:', authError?.message);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      userId = user.id;
      console.log('[Predictions Trends API] Authenticated via bearer token:', userId);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify job ownership
    const jobQuery = await supabase
      .from('local_training_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobQuery.error || !jobQuery.data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch all predictions with scores
    const { data: predictions, error: predictionsError } = await supabase
      .from('training_predictions')
      .select('epoch, step, exact_match, char_error_rate, length_ratio, word_overlap, validation_pass')
      .eq('job_id', jobId)
      .order('epoch', { ascending: true });

    if (predictionsError) {
      console.error('[Predictions Trends API] Query error:', predictionsError);
      return NextResponse.json(
        { error: 'Failed to fetch trends' },
        { status: 500 }
      );
    }

    // Aggregate by epoch
    const epochMap = new Map<number, {
      epoch: number;
      step: number;
      samples: {
        exact_match: number | null;
        char_error_rate: number | null;
        length_ratio: number | null;
        word_overlap: number | null;
        validation_pass: boolean | null;
      }[];
    }>();

    for (const pred of predictions || []) {
      const existing = epochMap.get(pred.epoch);
      const sample = {
        exact_match: pred.exact_match,
        char_error_rate: pred.char_error_rate,
        length_ratio: pred.length_ratio,
        word_overlap: pred.word_overlap,
        validation_pass: (pred as { validation_pass?: boolean | null }).validation_pass ?? null,
      };

      if (existing) {
        existing.samples.push(sample);
        existing.step = Math.max(existing.step, pred.step);
      } else {
        epochMap.set(pred.epoch, {
          epoch: pred.epoch,
          step: pred.step,
          samples: [sample],
        });
      }
    }

    // Compute averages
    const trends = Array.from(epochMap.values()).map((epochData) => {
      const samples = epochData.samples;
      const validExactMatch = samples.filter(s => s.exact_match !== null).map(s => s.exact_match!);
      const validCER = samples.filter(s => s.char_error_rate !== null).map(s => s.char_error_rate!);
      const validLengthRatio = samples.filter(s => s.length_ratio !== null).map(s => s.length_ratio!);
      const validWordOverlap = samples.filter(s => s.word_overlap !== null).map(s => s.word_overlap!);
      const validValidation = samples.filter(s => s.validation_pass !== null).map(s => s.validation_pass!);

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : null;
      const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : null;

      const validation_pass_rate = validValidation.length > 0
        ? validValidation.filter(Boolean).length / validValidation.length
        : null;

      return {
        epoch: epochData.epoch,
        step: epochData.step,
        sample_count: samples.length,
        avg_exact_match: avg(validExactMatch),
        avg_char_error_rate: avg(validCER),
        avg_length_ratio: avg(validLengthRatio),
        avg_word_overlap: avg(validWordOverlap),
        min_char_error_rate: min(validCER),
        max_char_error_rate: max(validCER),
        validation_pass_rate,
      };
    }).sort((a, b) => a.epoch - b.epoch);

    // Calculate overall improvement (first to last epoch CER)
    // CER improvement: higher % = better (error decreased)
    let overall_improvement = null;
    if (trends.length >= 2) {
      const firstCER = trends[0].avg_char_error_rate;
      const lastCER = trends[trends.length - 1].avg_char_error_rate;
      if (firstCER !== null && lastCER !== null && firstCER > 0) {
        overall_improvement = ((firstCER - lastCER) / firstCER) * 100;
      }
    }

    const response: PredictionsTrendsResponse = {
      job_id: jobId,
      trends,
      overall_improvement,
    };

    console.log('[Predictions Trends API] Returning', trends.length, 'trend points');
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Predictions Trends API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
