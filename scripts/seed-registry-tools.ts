// Seed Tools from Registry to Database
// Syncs all registered tools into the database tools table
// Date: 2025-10-15
// Run: npx tsx scripts/seed-registry-tools.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SeedTools] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define missing tools manually (to avoid import issues)
const toolsToAdd = [
  {
    name: 'filesystem',
    description: 'Read-only filesystem operations with comprehensive security validation. List directories, read files, and get file information safely.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Filesystem operation to perform',
          enum: ['list_directory', 'read_file', 'file_info'],
        },
        path: {
          type: 'string',
          description: 'File or directory path (relative to allowed directories)',
        },
        encoding: {
          type: 'string',
          description: 'Text encoding for file reading (default: utf8)',
          enum: ['utf8', 'ascii', 'latin1', 'base64', 'hex'],
          default: 'utf8',
        },
      },
      required: ['operation', 'path'],
    },
    enabled: true,
  },
  {
    name: 'dataset_manager',
    description: 'Manage training datasets from conversation history. List, export, filter, and validate conversation data for ML training workflows. Supports JSONL export format for fine-tuning.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Dataset operation to perform',
          enum: ['list', 'stats', 'export', 'validate'],
        },
        dataset_filter: {
          type: 'object',
          description: 'Optional filters for dataset operations',
        },
        export_format: {
          type: 'string',
          description: 'Export format (default: jsonl)',
          enum: ['jsonl', 'json', 'csv'],
          default: 'jsonl',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return',
          default: 1000,
        },
      },
      required: ['operation'],
    },
    enabled: true,
  },
  {
    name: 'prompt_tester',
    description: 'Test and compare AI prompts with controlled experiments. Supports A/B testing, batch testing, and metrics collection for prompt engineering workflows.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Test operation to perform',
          enum: ['test', 'compare', 'batch_test'],
        },
        prompt: {
          type: 'string',
          description: 'Prompt to test',
        },
        variants: {
          type: 'array',
          description: 'Prompt variants for A/B testing',
        },
      },
      required: ['operation'],
    },
    enabled: true,
  },
  {
    name: 'token_analyzer',
    description: 'Analyze token usage and costs for conversations. Get detailed token counts, estimate costs, and optimize prompts for efficiency.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Analysis operation to perform',
          enum: ['analyze', 'estimate', 'optimize'],
        },
        conversation_id: {
          type: 'string',
          description: 'Conversation ID to analyze',
        },
      },
      required: ['operation'],
    },
    enabled: true,
  },
  {
    name: 'evaluation_metrics',
    description: 'Track and analyze evaluation metrics for AI responses. Supports quality trends, success rates, and performance analysis.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Metrics operation to perform',
          enum: ['get_metrics', 'get_trends', 'get_analysis'],
        },
        period: {
          type: 'string',
          description: 'Time period for metrics',
          enum: ['day', 'week', 'month', 'quarter', 'year', 'all'],
          default: 'week',
        },
      },
      required: ['operation'],
    },
    enabled: true,
  },
  {
    name: 'system_monitor',
    description: 'Monitor system performance and health metrics. Track API response times, error rates, and system resource usage.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Monitoring operation to perform',
          enum: ['status', 'metrics', 'health'],
        },
      },
      required: ['operation'],
    },
    enabled: true,
  },
];

async function seedTools() {
  console.log('[SeedTools] Starting tool seeding...\n');
  console.log(`[SeedTools] Will add ${toolsToAdd.length} missing tools\n`);

  for (const tool of toolsToAdd) {
    try {
      // Check if tool already exists
      const { data: existing } = await supabase
        .from('tools')
        .select('id, name, is_enabled')
        .eq('name', tool.name)
        .single();

      if (existing) {
        console.log(`[SeedTools] ⊙ ${tool.name} (already exists, skipping)`);
        continue;
      }

      // Insert new tool
      const { data, error } = await supabase
        .from('tools')
        .insert({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          is_builtin: true,
          is_enabled: tool.enabled,
        })
        .select()
        .single();

      if (error) {
        console.error(`[SeedTools] ✗ ${tool.name}: ${error.message}`);
      } else {
        console.log(`[SeedTools] ✓ ${tool.name} (inserted)`);
      }
    } catch (error) {
      console.error(`[SeedTools] Exception inserting ${tool.name}:`, error);
    }
  }

  console.log('\n[SeedTools] Seeding complete!');
  console.log('[SeedTools] Verifying tools in database...\n');

  const { data: allTools, error: listError } = await supabase
    .from('tools')
    .select('name, is_enabled, is_builtin')
    .eq('is_builtin', true)
    .order('name');

  if (listError) {
    console.error('[SeedTools] Error listing tools:', listError);
  } else {
    console.log('[SeedTools] Tools in database:');
    allTools?.forEach(t => {
      console.log(`  - ${t.name} (${t.is_enabled ? 'enabled' : 'disabled'})`);
    });
    console.log(`\n[SeedTools] Total: ${allTools?.length || 0} tools in database`);
  }
}

seedTools()
  .then(() => {
    console.log('\n[SeedTools] Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('[SeedTools] Fatal error:', error);
    process.exit(1);
  });
