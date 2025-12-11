/**
 * API Route: GET /api/training/workflow/step1-config
 *
 * Returns Step1ModelSelection configuration
 * Server-side only - loads YAML config and returns as JSON
 */

import { NextResponse } from 'next/server';
import { loadComponentConfig } from '@/lib/config/yaml-loader';
import { step1ConfigSchema, type Step1Config } from '@/components/training/workflow/Step1ModelSelection.schema';

export async function GET() {
  try {
    // Load config server-side (fs works here)
    const config = loadComponentConfig<Step1Config>('Step1ModelSelection', step1ConfigSchema);

    return NextResponse.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('[step1-config] Error loading config:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load configuration'
      },
      { status: 500 }
    );
  }
}
