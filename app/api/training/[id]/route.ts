/**
 * @swagger
 * /api/training/{id}:
 *   get:
 *     summary: Get training configuration
 *     description: Retrieve a specific training configuration by ID
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Training configuration ID
 *         example: "cfg_abc123"
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   type: object
 *       404:
 *         description: Configuration not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update training configuration
 *     description: Update an existing training configuration's settings
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "cfg_abc123"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               config_json:
 *                 type: object
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Delete training configuration
 *     description: Delete a training configuration
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "cfg_abc123"
 *     responses:
 *       200:
 *         description: Configuration deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { configValidator } from '@/lib/training/config-validator';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log('[TrainingAPI] GET [id]:', id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('training_configs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('[TrainingAPI] GET [id]: Error:', error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('[TrainingAPI] GET [id]: Error:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log('[TrainingAPI] PUT: Updating config:', id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, config_json } = body;

    console.log('[TrainingAPI] PUT: Received config_json keys:', config_json ? Object.keys(config_json) : 'none');
    console.log('[TrainingAPI] PUT: Training config keys:', config_json?.training ? Object.keys(config_json.training) : 'none');
    console.log('[TrainingAPI] PUT: PREDICTIONS CHECK:', {
      hasPredictions: !!config_json?.predictions,
      predictionsEnabled: config_json?.predictions?.enabled,
      predictionsConfig: config_json?.predictions
    });
    console.log('[TrainingAPI] PUT: New parameters check:', {
      lr_scheduler_type: config_json?.training?.lr_scheduler_type,
      warmup_ratio: config_json?.training?.warmup_ratio,
      save_steps: config_json?.training?.save_steps,
      save_total_limit: config_json?.training?.save_total_limit,
      evaluation_strategy: config_json?.training?.evaluation_strategy,
      packing: config_json?.training?.packing,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (config_json) {
      const validationResult = configValidator.validate(config_json);
      updateData.config_json = config_json;
      updateData.is_validated = validationResult.isValid;
      updateData.validation_errors = validationResult.isValid ? null : validationResult.errors;
    }

    const { data, error } = await supabase
      .from('training_configs')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[TrainingAPI] PUT: Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] PUT: Updated successfully');
    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('[TrainingAPI] PUT: Error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log('[TrainingAPI] DELETE: Deleting config:', id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('training_configs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[TrainingAPI] DELETE: Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] DELETE: Deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TrainingAPI] DELETE: Error:', error);
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 });
  }
}
