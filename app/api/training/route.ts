/**
 * @swagger
 * /api/training:
 *   get:
 *     summary: List training configurations
 *     description: |
 *       Retrieve all training configurations for the authenticated user.
 *
 *       Training configurations define the hyperparameters, model architecture,
 *       and training settings for fine-tuning jobs.
 *
 *       **Use Cases:**
 *       - List all saved training configurations
 *       - Select a config to start a training job
 *       - Review previously used training settings
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "cfg_abc123"
 *                       name:
 *                         type: string
 *                         example: "Llama 2 7B Fine-tune"
 *                       description:
 *                         type: string
 *                         example: "Customer support chatbot training config"
 *                       template_type:
 *                         type: string
 *                         enum: [lora, full_finetune, qlora, dpo, rlhf]
 *                         example: "lora"
 *                       config_json:
 *                         type: object
 *                         description: Training hyperparameters and settings
 *                       is_validated:
 *                         type: boolean
 *                         example: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   post:
 *     summary: Create training configuration
 *     description: |
 *       Create a new training configuration with hyperparameters and settings.
 *
 *       Training configurations are validated before being saved. Invalid configs
 *       will still be created but flagged with validation errors.
 *
 *       **Use Cases:**
 *       - Save reusable training configurations
 *       - Create configs for different model types or use cases
 *       - Template configs for team members
 *
 *       **Supported Template Types:**
 *       - `lora` - LoRA (Low-Rank Adaptation) fine-tuning
 *       - `qlora` - QLoRA (Quantized LoRA) for memory efficiency
 *       - `full_finetune` - Full parameter fine-tuning
 *       - `dpo` - Direct Preference Optimization
 *       - `rlhf` - Reinforcement Learning from Human Feedback
 *     tags:
 *       - Training
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - template_type
 *               - config_json
 *             properties:
 *               name:
 *                 type: string
 *                 description: Configuration name
 *                 example: "Llama 2 7B LoRA"
 *               description:
 *                 type: string
 *                 description: Optional description
 *                 example: "LoRA fine-tuning for customer support chatbot"
 *               template_type:
 *                 type: string
 *                 enum: [lora, full_finetune, qlora, dpo, rlhf]
 *                 example: "lora"
 *               config_json:
 *                 type: object
 *                 description: Training hyperparameters
 *                 properties:
 *                   model_name:
 *                     type: string
 *                     example: "meta-llama/Llama-2-7b-hf"
 *                   training:
 *                     type: object
 *                     properties:
 *                       learning_rate:
 *                         type: number
 *                         example: 2e-5
 *                       epochs:
 *                         type: integer
 *                         example: 3
 *                       batch_size:
 *                         type: integer
 *                         example: 4
 *                       warmup_ratio:
 *                         type: number
 *                         example: 0.1
 *                   lora:
 *                     type: object
 *                     properties:
 *                       r:
 *                         type: integer
 *                         example: 16
 *                       alpha:
 *                         type: integer
 *                         example: 32
 *                       dropout:
 *                         type: number
 *                         example: 0.05
 *     responses:
 *       201:
 *         description: Configuration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     is_validated:
 *                       type: boolean
 *                     validation_errors:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Missing required fields
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
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { configValidator } from '@/lib/training/config-validator';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('[TrainingAPI] GET: Fetching configs');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[TrainingAPI] GET: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[TrainingAPI] GET: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TrainingAPI] GET: Fetching configs for user:', user.id);

    const { data, error } = await supabase
      .from('training_configs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[TrainingAPI] GET: Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] GET: Found', data.length, 'configs');
    console.log('[TrainingAPI] GET: Sample config fields:', data[0] ? Object.keys(data[0]) : 'no configs');
    console.log('[TrainingAPI] GET: public_id values:', data.map(c => ({ id: c.id, name: c.name, public_id: c.public_id })));
    return NextResponse.json({ configs: data });
  } catch (error) {
    console.error('[TrainingAPI] GET: Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[TrainingAPI] POST: Creating config');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[TrainingAPI] POST: Unauthorized - no auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[TrainingAPI] POST: Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, template_type, config_json } = body;

    console.log('[TrainingAPI] POST: Creating config:', name, 'for user:', user.id);

    if (!name || !template_type || !config_json) {
      console.error('[TrainingAPI] POST: Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validationResult = configValidator.validate(config_json);
    console.log('[TrainingAPI] POST: Validation result:', validationResult.isValid);

    const { data, error } = await supabase
      .from('training_configs')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        template_type,
        config_json,
        is_validated: validationResult.isValid,
        validation_errors: validationResult.isValid ? null : validationResult.errors
      })
      .select()
      .single();

    if (error) {
      console.error('[TrainingAPI] POST: Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[TrainingAPI] POST: Config created:', data.id);
    return NextResponse.json({ config: data }, { status: 201 });
  } catch (error) {
    console.error('[TrainingAPI] POST: Error:', error);
    return NextResponse.json(
      { error: 'Failed to create config' },
      { status: 500 }
    );
  }
}
