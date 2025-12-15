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
    name: 'calculator',
    description: 'Perform EXACT mathematical calculations with full precision. Returns precise numeric results for arithmetic, algebra, trigonometry, and more. All results are exact calculations, not approximations.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "sin(45)")',
        },
      },
      required: ['expression'],
    },
    enabled: true,
  },
  {
    name: 'datetime',
    description: 'Get current date and time information, convert between timezones, and format dates.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform: "current", "convert", or "format"',
          enum: ['current', 'convert', 'format'],
        },
        timezone: {
          type: 'string',
          description: 'Timezone (e.g., "America/New_York", "UTC", "Europe/London")',
        },
        fromTimezone: {
          type: 'string',
          description: 'Source timezone for conversion',
        },
        toTimezone: {
          type: 'string',
          description: 'Target timezone for conversion',
        },
        dateTime: {
          type: 'string',
          description: 'ISO 8601 date/time string (optional, defaults to now)',
        },
      },
      required: ['action'],
    },
    enabled: true,
  },
  {
    name: 'web_search',
    description: 'Search the web for CURRENT, UP-TO-DATE information, news, and answers. Use this for recent events, latest news, current facts, or anything requiring real-time data.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "latest AI news", "Python tutorials", "weather in Tokyo")',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (1-20, default: 10)',
        },
        summarize: {
          type: 'boolean',
          description: 'Generate AI-powered summaries of search results for more concise, relevant information (default: false)',
          default: false,
        },
        deepSearch: {
          type: 'boolean',
          description: 'Fetch and analyze full page content from top results instead of just snippets for more comprehensive information (default: false). Automatically enables summarization.',
          default: false,
        },
        autoRefine: {
          type: 'boolean',
          description: 'Automatically detect poor search results and retry with refined, more specific queries (default: false). Helps find better information for vague or ambiguous queries.',
          default: false,
        },
      },
      required: ['query'],
    },
    enabled: true,
  },
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
  {
    name: 'analytics_export',
    description: 'Create analytics export files (CSV, JSON, or Report) and get download links. Export types: overview, timeseries, complete, model_comparison, tool_usage, quality_trends.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Operation to perform',
          enum: ['create_export', 'list_exports', 'get_download_link'],
        },
        format: {
          type: 'string',
          description: 'Export format (for create_export)',
          enum: ['csv', 'json', 'report'],
        },
        exportType: {
          type: 'string',
          description: 'Type of analytics data to export (for create_export)',
          enum: ['overview', 'timeseries', 'complete', 'model_comparison', 'tool_usage', 'quality_trends'],
        },
        startDate: {
          type: 'string',
          description: 'Start date for data range (YYYY-MM-DD format)',
        },
        endDate: {
          type: 'string',
          description: 'End date for data range (YYYY-MM-DD format)',
        },
        exportId: {
          type: 'string',
          description: 'Export ID (for get_download_link)',
        },
      },
      required: ['operation'],
    },
    enabled: true,
  },
  {
    name: 'training_control',
    description: 'Control training jobs: list configurations, attach datasets, and start training.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Training operation to perform',
          enum: ['list_configs', 'get_config', 'list_datasets', 'attach_dataset', 'start_training'],
        },
        config_id: {
          type: 'string',
          description: 'Configuration ID (required for get_config, attach_dataset, start_training)',
        },
        dataset_id: {
          type: 'string',
          description: 'Dataset ID (required for attach_dataset)',
        },
        target: {
          type: 'string',
          description: 'Training target platform (for start_training, default: local)',
          enum: ['local', 'kaggle', 'hf-spaces', 'runpod'],
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
