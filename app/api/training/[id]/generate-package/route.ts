// Generate Training Package API
// POST /api/training/{id}/generate-package - Make config public and return public_id
// Date: 2025-10-16
// Updated: 2025-10-20 - Added GitHub Gist integration for Colab
// Updated: 2025-10-22 - Added OAuth-based Gist creation with user's GitHub token
// ⚠️ DEPRECATED: 2025-11-02 - This API is deprecated in favor of CloudDeploymentWizard
//
// DEPRECATION NOTICE:
// This endpoint generates Colab/Gist packages which is deprecated functionality.
// New implementations should use the CloudDeploymentWizard component and
// the /api/training/deploy/* endpoints for cloud deployment.
// This endpoint remains functional for backward compatibility but may be removed
// in a future release. See docs/analytics/CHANGELOG_package_generator_removal.md

import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createTrainingGists } from '@/lib/services/github-gist.service';
import { getUserGithubToken } from '@/lib/utils/github-token-helper';
import { isFormatCompatible, type TrainingMethod } from '@/lib/training/format-validator';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

export const runtime = 'nodejs';

/**
 * Get compatible training methods for a config's datasets
 */
async function getCompatibleMethods(
  supabase: SupabaseClient,
  configId: string
): Promise<TrainingMethod[]> {
  console.log('[GeneratePackageAPI] Checking compatible methods for config:', configId);

  // Fetch datasets via junction table
  const { data: configDatasets, error } = await supabase
    .from('training_config_datasets')
    .select(`
      training_datasets (format)
    `)
    .eq('config_id', configId);

  if (error || !configDatasets || configDatasets.length === 0) {
    console.log('[GeneratePackageAPI] No datasets found for config');
    return [];
  }

  // Extract dataset formats
  type ConfigDatasetRow = {
    training_datasets: TrainingDatasetRecord | null;
  };

  const datasets = (configDatasets as unknown as ConfigDatasetRow[])
    .map((cd) => cd.training_datasets)
    .filter((d): d is TrainingDatasetRecord => d !== null);

  console.log('[GeneratePackageAPI] Found datasets:', datasets.map((d) => ({ format: d.format })));

  const allMethods: TrainingMethod[] = ['sft', 'dpo', 'rlhf', 'orpo', 'cpt'];
  const compatibleMethods = allMethods.filter((method) => {
    const isCompatible = datasets.every((dataset) => {
      const compatible = isFormatCompatible(dataset.format, method);
      console.log('[GeneratePackageAPI] Format:', dataset.format, 'compatible with', method, '?', compatible);
      return compatible;
    });
    return isCompatible;
  });

  console.log('[GeneratePackageAPI] Compatible methods:', compatibleMethods);
  return compatibleMethods;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[GeneratePackageAPI] DELETE: Revoking public access for:', resolvedParams.id);

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[GeneratePackageAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configId = resolvedParams.id;

    const { error: updateError } = await supabase
      .from('training_configs')
      .update({ public_id: null })
      .eq('id', configId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[GeneratePackageAPI] Failed to revoke access:', updateError);
      return NextResponse.json({ error: 'Failed to revoke access' }, { status: 500 });
    }

    console.log('[GeneratePackageAPI] Public access revoked');
    return NextResponse.json({ message: 'Public access revoked successfully' });
  } catch (error) {
    console.error('[GeneratePackageAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to revoke access' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[GeneratePackageAPI] POST: Generating package for:', resolvedParams.id);
  console.warn('[GeneratePackageAPI] ⚠️  DEPRECATION WARNING: This endpoint is deprecated.');
  console.warn('[GeneratePackageAPI] Please use CloudDeploymentWizard and /api/training/deploy/* endpoints instead.');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[GeneratePackageAPI] Auth failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configId = resolvedParams.id;

    const { data: config, error: configError } = await supabase
      .from('training_configs')
      .select('id, user_id, name, public_id, gist_urls')
      .eq('id', configId)
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      console.error('[GeneratePackageAPI] Config not found');
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    if (config.public_id) {
      console.log('[GeneratePackageAPI] Config already public:', config.public_id);
      return NextResponse.json({
        public_id: config.public_id,
        gist_urls: config.gist_urls || {},
        message: 'Config already public',
      });
    }

    console.log('[GeneratePackageAPI] Making config public');

    const { data: publicId, error: rpcError } = await supabase
      .rpc('make_config_public', { config_id: configId });

    if (rpcError || !publicId) {
      console.error('[GeneratePackageAPI] RPC error:', rpcError);
      return NextResponse.json(
        { error: 'Failed to generate public ID' },
        { status: 500 }
      );
    }

    console.log('[GeneratePackageAPI] Package generated:', publicId);

    // Create GitHub Gists for compatible training methods
    console.log('[GeneratePackageAPI] Creating GitHub Gists for Colab integration');
    const compatibleMethods = await getCompatibleMethods(supabase, configId);

    // Initialize gist URLs in parent scope for return statement
    const gistUrls: Record<string, string> = {};

    if (compatibleMethods.length > 0) {
      // Try to get user's GitHub OAuth token
      const userGithubToken = await getUserGithubToken(authHeader);

      if (userGithubToken) {
        console.log('[GeneratePackageAPI] Using user GitHub OAuth token for Gist creation');
      } else {
        console.log('[GeneratePackageAPI] No user GitHub token found, using server token if available');
      }

      const gistResults = await createTrainingGists(
        publicId as string,
        compatibleMethods,
        userGithubToken || undefined
      );

      // Build gist_urls object from results
      for (const [method, result] of Object.entries(gistResults)) {
        if (result.success && result.colabUrl) {
          gistUrls[method] = result.colabUrl;
        }
      }

      console.log('[GeneratePackageAPI] Built gist URLs:', Object.keys(gistUrls));

      // Update config with Gist URLs
      if (Object.keys(gistUrls).length > 0) {
        const { error: updateError } = await supabase
          .from('training_configs')
          .update({ gist_urls: gistUrls })
          .eq('id', configId);

        if (updateError) {
          console.error('[GeneratePackageAPI] Failed to save Gist URLs:', updateError);
        } else {
          console.log('[GeneratePackageAPI] Saved Gist URLs:', Object.keys(gistUrls));
        }
      } else {
        console.log('[GeneratePackageAPI] No successful gists created');
      }
    } else {
      console.log('[GeneratePackageAPI] No compatible methods found, skipping Gist creation');
    }

    console.log('[GeneratePackageAPI] Returning response with gist_urls:', Object.keys(gistUrls));
    return NextResponse.json({
      public_id: publicId,
      config_name: config.name,
      gist_urls: gistUrls,
      message: 'Training package generated successfully',
    });
  } catch (error) {
    console.error('[GeneratePackageAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate package' },
      { status: 500 }
    );
  }
}

console.log('[GeneratePackageAPI] Generate package API loaded');
