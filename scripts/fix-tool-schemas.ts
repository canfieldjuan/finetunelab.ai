// Fix Tool Schemas in Database
// Removes invalid 'required: true' from property definitions
// Date: October 14, 2025

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file manually
const envPath = join(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[FixToolSchemas] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Corrected tool schemas (without invalid 'required' in properties)
const fixedSchemas = {
  dataset_manager: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['list', 'stats', 'export', 'validate'],
        description: 'Dataset operation to perform',
      },
      dataset_filter: {
        type: 'string',
        description: 'Optional: Filter datasets (all, recent, quality)',
      },
      export_format: {
        type: 'string',
        description: 'Export format (default: jsonl)',
      },
      limit: {
        type: 'number',
        description: 'Optional: Limit results',
      },
    },
    required: ['operation'],
  },

  prompt_tester: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['test_single', 'compare_models', 'batch_test', 'save_result'],
        description: 'Testing operation to perform',
      },
      prompt: {
        type: 'string',
        description: 'The prompt to test',
      },
      model: {
        type: 'string',
        description: 'Model identifier (e.g., gpt-4, claude-3)',
      },
      models: {
        type: 'array',
        description: 'Multiple models for comparison',
        items: {
          type: 'string',
        },
      },
      temperature: {
        type: 'number',
        description: 'Model temperature (0-2)',
      },
      max_tokens: {
        type: 'number',
        description: 'Maximum tokens to generate',
      },
    },
    required: ['operation'],
  },

  token_analyzer: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze_text', 'conversation_usage', 'model_comparison', 'cost_estimate'],
        description: 'Token analysis operation',
      },
      text: {
        type: 'string',
        description: 'Text to analyze for tokens',
      },
      model: {
        type: 'string',
        description: 'Model for token calculation',
      },
      conversationId: {
        type: 'string',
        description: 'Conversation ID for usage analysis',
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month', 'all'],
        description: 'Time period for analysis',
      },
    },
    required: ['operation'],
  },

  evaluation_metrics: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['get_metrics', 'quality_trends', 'success_analysis', 'compare_periods'],
        description: 'Metrics operation to perform',
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month', 'quarter', 'year', 'all'],
        description: 'Time period to analyze (default: week)',
      },
      conversationId: {
        type: 'string',
        description: 'Optional: Analyze specific conversation only',
      },
      startDate: {
        type: 'string',
        description: 'Optional: Custom start date (ISO format)',
      },
      endDate: {
        type: 'string',
        description: 'Optional: Custom end date (ISO format)',
      },
      minRating: {
        type: 'number',
        description: 'Optional: Filter by minimum rating (1-5)',
      },
      maxRating: {
        type: 'number',
        description: 'Optional: Filter by maximum rating (1-5)',
      },
    },
    required: ['operation'],
  },

  system_monitor: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['health_check', 'resource_usage', 'performance_metrics', 'get_alerts'],
        description: 'Monitoring operation to perform',
      },
      period: {
        type: 'string',
        enum: ['hour', 'day', 'week', 'month', 'all'],
        description: 'Time period for metrics analysis (default: day)',
      },
      metricType: {
        type: 'string',
        enum: ['response_time', 'throughput', 'errors', 'all'],
        description: 'Type of performance metrics to retrieve',
      },
      includeDetails: {
        type: 'boolean',
        description: 'Include detailed breakdown in results',
      },
    },
    required: ['operation'],
  },
};

async function fixToolSchemas() {
  console.log('[FixToolSchemas] Starting database schema fixes...');

  let successCount = 0;
  let errorCount = 0;

  for (const [toolName, schema] of Object.entries(fixedSchemas)) {
    console.log(`[FixToolSchemas] Updating ${toolName}...`);

    const { error } = await supabase
      .from('tools')
      .update({ parameters: schema })
      .eq('name', toolName);

    if (error) {
      console.error(`[FixToolSchemas] Error updating ${toolName}:`, error);
      errorCount++;
    } else {
      console.log(`[FixToolSchemas] ✓ Successfully updated ${toolName}`);
      successCount++;
    }
  }

  console.log('\n[FixToolSchemas] Summary:');
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Errors: ${errorCount}`);

  // Verify updates
  console.log('\n[FixToolSchemas] Verifying updates...');
  const { data, error } = await supabase
    .from('tools')
    .select('name, parameters')
    .in('name', Object.keys(fixedSchemas));

  if (error) {
    console.error('[FixToolSchemas] Error verifying:', error);
    return;
  }

  console.log('\n[FixToolSchemas] Verification Results:');
  data?.forEach(tool => {
    const params = tool.parameters as unknown;
    const hasInvalidRequired = params?.properties?.operation?.required !== undefined;
    const hasValidRequired = Array.isArray(params?.required);

    console.log(`\n  ${tool.name}:`);
    console.log(`    ✓ Has valid 'required' array: ${hasValidRequired}`);
    console.log(`    ${hasInvalidRequired ? '✗' : '✓'} Invalid nested 'required': ${hasInvalidRequired ? 'FOUND' : 'REMOVED'}`);
  });

  console.log('\n[FixToolSchemas] Done!');
}

// Run the fix
fixToolSchemas()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[FixToolSchemas] Fatal error:', error);
    process.exit(1);
  });
