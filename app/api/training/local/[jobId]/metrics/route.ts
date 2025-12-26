/**
 * @swagger
 * /api/training/local/{jobId}/metrics:
 *   get:
 *     summary: Get training metrics history
 *     description: |
 *       Retrieve the complete training metrics history for visualization and analysis.
 *
 *       This endpoint returns all metric points collected during training, perfect for:
 *       - **Loss curves** - Plot training and validation loss over time
 *       - **Performance charts** - Visualize GPU usage, throughput, and learning rate
 *       - **Trend analysis** - Analyze perplexity, gradient norms, and other metrics
 *       - **Export data** - Download full training history for external analysis
 *
 *       Each metric point includes:
 *       - Step and epoch numbers
 *       - Loss metrics (train_loss, eval_loss)
 *       - GPU metrics (memory, utilization)
 *       - Performance metrics (samples/sec, tokens/sec)
 *       - Training parameters (learning_rate, grad_norm)
 *       - Quality metrics (perplexity)
 *
 *       **Use Cases:**
 *       - Build interactive training charts
 *       - Export metrics to TensorBoard, W&B, or MLflow
 *       - Analyze training dynamics post-hoc
 *       - Compare multiple training runs
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
 *         description: Metrics history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id:
 *                   type: string
 *                   example: "job_abc123"
 *                 metrics:
 *                   type: array
 *                   description: Array of metric points ordered by step
 *                   items:
 *                     type: object
 *                     properties:
 *                       step:
 *                         type: integer
 *                         example: 100
 *                       epoch:
 *                         type: integer
 *                         example: 1
 *                       train_loss:
 *                         type: number
 *                         example: 0.345
 *                       eval_loss:
 *                         type: number
 *                         example: 0.298
 *                       learning_rate:
 *                         type: number
 *                         example: 0.00002
 *                       grad_norm:
 *                         type: number
 *                         example: 0.512
 *                       gpu_memory_allocated_gb:
 *                         type: number
 *                         example: 22.1
 *                       gpu_memory_reserved_gb:
 *                         type: number
 *                         example: 24.0
 *                       gpu_utilization_percent:
 *                         type: number
 *                         example: 97.5
 *                       samples_per_second:
 *                         type: number
 *                         example: 12.5
 *                       tokens_per_second:
 *                         type: number
 *                         example: 2500.0
 *                       train_perplexity:
 *                         type: number
 *                         example: 1.41
 *                       perplexity:
 *                         type: number
 *                         example: 1.35
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[LocalTraining Metrics GET] CRITICAL: Missing environment variables!');
  console.error('[LocalTraining Metrics GET] NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[LocalTraining Metrics GET] SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING');
}

/**
 * PUT /api/training/local/{jobId}/metrics
 * Report a single metric point during training
 *
 * Called by: Python training agent during training loop
 * Auth: Bearer token (job_token)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Metrics PUT] Reporting metric for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    // Extract and validate job_token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[LocalTraining Metrics PUT] Missing or invalid authorization header');
      return NextResponse.json(
        { error: 'Unauthorized: Bearer token required' },
        { status: 401 }
      );
    }

    const jobToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Parse request body
    const metric = await request.json();

    if (!metric.step || typeof metric.epoch !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metric: step and epoch are required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify job exists and token matches
    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, job_token, status')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('[LocalTraining Metrics PUT] Job not found:', jobId);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.job_token !== jobToken) {
      console.error('[LocalTraining Metrics PUT] Invalid job token');
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    // Insert metric into time-series table
    const metricData = {
      job_id: jobId,
      step: metric.step,
      epoch: metric.epoch,
      train_loss: metric.train_loss ?? null,
      eval_loss: metric.eval_loss ?? null,
      learning_rate: metric.learning_rate ?? null,
      grad_norm: metric.grad_norm ?? null,
      gpu_memory_allocated_gb: metric.gpu_memory_allocated_gb ?? null,
      gpu_memory_reserved_gb: metric.gpu_memory_reserved_gb ?? null,
      gpu_utilization_percent: metric.gpu_utilization_percent ?? null,
      perplexity: metric.perplexity ?? null,
      train_perplexity: metric.train_perplexity ?? null,
      samples_per_second: metric.samples_per_second ?? null,
      tokens_per_second: metric.tokens_per_second ?? null,
      timestamp: new Date().toISOString()
    };

    const { error: insertError } = await supabase
      .from('local_training_metrics')
      .insert(metricData);

    if (insertError) {
      console.error('[LocalTraining Metrics PUT] Failed to insert metric:', insertError);
      return NextResponse.json(
        { error: 'Failed to persist metric', details: insertError.message },
        { status: 500 }
      );
    }

    // Update job summary with latest metric
    const jobUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      current_step: metric.step,
      current_epoch: metric.epoch,
      loss: metric.train_loss ?? null,
      eval_loss: metric.eval_loss ?? null,
      learning_rate: metric.learning_rate ?? null,
      grad_norm: metric.grad_norm ?? null,
      samples_per_second: metric.samples_per_second ?? null,
      gpu_memory_allocated_gb: metric.gpu_memory_allocated_gb ?? null,
      gpu_memory_reserved_gb: metric.gpu_memory_reserved_gb ?? null,
      gpu_utilization_percent: metric.gpu_utilization_percent ?? null,
      perplexity: metric.perplexity ?? null,
      train_perplexity: metric.train_perplexity ?? null,
    };

    // Mark job as running on first metric
    if (job.status === 'pending' || job.status === 'queued') {
      jobUpdate.status = 'running';
    }

    await supabase
      .from('local_training_jobs')
      .update(jobUpdate)
      .eq('id', jobId);

    console.log('[LocalTraining Metrics PUT] Metric persisted for step:', metric.step);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[LocalTraining Metrics PUT] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  console.log('[LocalTraining Metrics GET] Fetching metrics from database for job:', jobId);

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server configuration error: Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    let userId: string | null = null;

    const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');

    if (apiKeyValidation.isValid && apiKeyValidation.userId) {
      userId = apiKeyValidation.userId;
    } else {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json(
          { error: 'Unauthorized: Missing authentication' },
          { status: 401 }
        );
      }

      if (!supabaseAnonKey) {
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

      if (authError || !user) {
        console.error('[LocalTraining Metrics GET] Auth error:', authError);
        return NextResponse.json(
          { error: 'Unauthorized: Invalid token' },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error: jobError } = await supabase
      .from('local_training_jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single();

    if (jobError || !job) {
      console.error('[LocalTraining Metrics GET] Job not found or unauthorized:', jobError);
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('local_training_metrics')
      .select('*')
      .eq('job_id', jobId)
      .order('step', { ascending: true })
      .limit(100000);

    if (error) {
      console.error('[LocalTraining Metrics GET] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics', details: error.message },
        { status: 500 }
      );
    }

    console.log('[LocalTraining Metrics GET] Retrieved', data?.length || 0, 'metric points from database');

    return NextResponse.json({
      job_id: jobId,
      metrics: data || []
    });

  } catch (error) {
    console.error('[LocalTraining Metrics GET] Request error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
