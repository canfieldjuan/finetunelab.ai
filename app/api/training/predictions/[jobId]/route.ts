/**
 * @swagger
 * /api/training/predictions/{jobId}:
 *   get:
 *     summary: Get training predictions
 *     description: |
 *       Retrieve model predictions generated during training for quality analysis.
 *
 *       Track how your model's predictions improve across epochs. This endpoint
 *       returns predictions on sample prompts, allowing you to visualize quality
 *       evolution during training (similar to Weights & Biases).
 *
 *       **Use Cases:**
 *       - Track prediction quality over time
 *       - Compare predictions across epochs
 *       - Identify model improvement or degradation
 *       - Build prediction comparison visualizations
 *       - Export predictions for analysis
 *
 *       **Pagination:**
 *       - Use `limit` and `offset` for paginating large result sets
 *       - Default limit: 50 predictions
 *       - Filter by specific epoch using `epoch` parameter
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
 *       - in: query
 *         name: epoch
 *         schema:
 *           type: integer
 *         description: Filter predictions by specific epoch
 *         example: 2
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of predictions to return
 *         example: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *         example: 0
 *     responses:
 *       200:
 *         description: Predictions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                   example: "job_abc123"
 *                 predictions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       job_id:
 *                         type: string
 *                       epoch:
 *                         type: integer
 *                         example: 2
 *                       step:
 *                         type: integer
 *                         example: 450
 *                       sample_index:
 *                         type: integer
 *                         example: 0
 *                       prompt:
 *                         type: string
 *                         example: "What is the capital of France?"
 *                       ground_truth:
 *                         type: string
 *                         example: "The capital of France is Paris."
 *                       prediction:
 *                         type: string
 *                         example: "Paris is the capital of France."
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 total_count:
 *                   type: integer
 *                   description: Total predictions for this job
 *                   example: 150
 *                 epoch_count:
 *                   type: integer
 *                   description: Number of unique epochs
 *                   example: 3
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

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  const searchParams = request.nextUrl.searchParams;
  const epochParam = searchParams.get('epoch');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const epoch = epochParam ? parseInt(epochParam, 10) : null;
  const limit = parseInt(
    limitParam || process.env.PREDICTIONS_API_DEFAULT_LIMIT || '50',
    10
  );
  const offset = parseInt(offsetParam || '0', 10);

  console.log('[Predictions API] GET predictions for job:', jobId, {
    epoch,
    limit,
    offset,
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAuth = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.log('[Predictions API] Auth failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const jobQuery = await supabase
      .from('local_training_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobQuery.error || !jobQuery.data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let query = supabase
      .from('training_predictions')
      .select('*')
      .eq('job_id', jobId);

    if (epoch !== null) {
      query = query.eq('epoch', epoch);
    }

    const { data: predictions, error: predictionsError } = await query
      .order('epoch', { ascending: true })
      .order('sample_index', { ascending: true })
      .range(offset, offset + limit - 1);

    if (predictionsError) {
      console.error('[Predictions API] Query error:', predictionsError);
      return NextResponse.json(
        { error: 'Failed to fetch predictions' },
        { status: 500 }
      );
    }

    const { count: totalCount } = await supabase
      .from('training_predictions')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId);

    const { data: epochData } = await supabase
      .from('training_predictions')
      .select('epoch')
      .eq('job_id', jobId);

    const uniqueEpochs = new Set(epochData?.map((d) => d.epoch) || []);
    const epochCount = uniqueEpochs.size;

    console.log('[Predictions API] Retrieved', predictions?.length || 0, 'predictions');

    return NextResponse.json({
      job_id: jobId,
      predictions: predictions || [],
      total_count: totalCount || 0,
      epoch_count: epochCount,
    });
  } catch (error) {
    console.error('[Predictions API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get predictions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
