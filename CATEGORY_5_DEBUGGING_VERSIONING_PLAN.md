# Category 5: Debugging & Versioning - Implementation Plan

**Branch**: `trace-enhancements-phase-3`
**Date**: 2025-12-21
**Status**: Planning Phase

---

## Overview

Category 5 adds advanced debugging and versioning capabilities to the tracing system:
- **Phase 1**: Prompt Version Management UI
- **Phase 2**: Model A/B Comparison Automation
- **Phase 3**: Trace Replay for Debugging

---

## Infrastructure Assessment

### ✅ What Already Exists

1. **A/B Testing System** (100% Complete)
   - Tables: `ab_experiments`, `ab_experiment_variants`, `ab_experiment_members`
   - API: `/api/analytics/experiments` (full CRUD)
   - UI: `ExperimentManager.tsx` (80% complete)
   - RBAC: Experiment role-based access control service

2. **Trace Capture** (100% Complete)
   - Table: `llm_traces` with comprehensive fields
   - Service: `trace.service.ts` with auto-batching
   - UI: `TraceView.tsx` and `TraceExplorer.tsx`
   - Storage: Input/output data in structured JSONB format

3. **Prompt Storage** (60% Complete)
   - Table: `prompt_patterns` (referenced but not migrated)
   - Services: `prompt-tester.service.ts`, `prompt-extractor.service.ts`
   - No versioning system
   - No management UI

### ❌ What's Missing

1. **Prompt Versioning**
   - No version history tracking
   - No semantic versioning (v1, v2, v3)
   - No prompt comparison UI
   - No rollback capability

2. **Model A/B Automation**
   - A/B infrastructure exists but not documented for model testing
   - No automated model comparison workflow
   - No integration with trace replay

3. **Trace Replay**
   - No replay execution API
   - No replay UI
   - No side-by-side comparison
   - No parameter override capability

---

## Phase 1: Prompt Version Management

### 1.1 Database Schema

**Migration**: `supabase/migrations/20251221000002_add_prompt_versioning.sql`

```sql
-- Prompt Version Management System
-- Extends existing prompt_patterns with versioning

-- Add versioning columns to prompt_patterns
ALTER TABLE public.prompt_patterns
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_hash TEXT,
  ADD COLUMN IF NOT EXISTS parent_version_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS change_summary TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create unique constraint on user_id + name + version
CREATE UNIQUE INDEX idx_prompt_patterns_version
  ON public.prompt_patterns(user_id, name, version);

-- Create index on version hash for quick lookups
CREATE INDEX idx_prompt_patterns_hash
  ON public.prompt_patterns(version_hash);

-- Create index on parent version for history queries
CREATE INDEX idx_prompt_patterns_parent
  ON public.prompt_patterns(parent_version_id);

-- Add comments
COMMENT ON COLUMN public.prompt_patterns.version IS 'Incremental version number (1, 2, 3, ...)';
COMMENT ON COLUMN public.prompt_patterns.version_hash IS 'SHA-256 hash of template content for deduplication';
COMMENT ON COLUMN public.prompt_patterns.parent_version_id IS 'Reference to previous version for change history';
COMMENT ON COLUMN public.prompt_patterns.is_published IS 'Whether this version is active/production';
COMMENT ON COLUMN public.prompt_patterns.is_archived IS 'Whether this version is archived (soft delete)';
COMMENT ON COLUMN public.prompt_patterns.change_summary IS 'Description of changes in this version';
COMMENT ON COLUMN public.prompt_patterns.tags IS 'Tags for categorization (e.g., ["production", "experimental"])';

-- Function to auto-generate version hash
CREATE OR REPLACE FUNCTION generate_prompt_version_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version_hash = encode(digest(NEW.template, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate hash on insert/update
CREATE TRIGGER prompt_patterns_hash_trigger
  BEFORE INSERT OR UPDATE ON public.prompt_patterns
  FOR EACH ROW
  EXECUTE FUNCTION generate_prompt_version_hash();
```

### 1.2 API Endpoints

**File**: `app/api/prompts/versions/route.ts` (NEW)

```typescript
/**
 * Prompt Version Management API
 *
 * GET /api/prompts/versions?name={name} - List all versions of a prompt
 * POST /api/prompts/versions - Create new version
 * PATCH /api/prompts/versions/{id} - Update version metadata
 * DELETE /api/prompts/versions/{id} - Archive version
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all versions of the prompt
  const { data: versions, error } = await supabase
    .from('prompt_patterns')
    .select('*')
    .eq('user_id', user.id)
    .eq('name', name)
    .eq('is_archived', false)
    .order('version', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, versions });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, template, use_case, change_summary, tags, copy_from_version_id } = body;

  // Get the latest version number for this prompt
  const { data: latestVersion } = await supabase
    .from('prompt_patterns')
    .select('id, version')
    .eq('user_id', user.id)
    .eq('name', name)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const newVersion = latestVersion ? latestVersion.version + 1 : 1;
  const parentVersionId = copy_from_version_id || latestVersion?.id || null;

  // Create new version
  const { data: newPrompt, error: insertError } = await supabase
    .from('prompt_patterns')
    .insert({
      user_id: user.id,
      name,
      template,
      use_case,
      version: newVersion,
      parent_version_id: parentVersionId,
      change_summary: change_summary || `Version ${newVersion}`,
      tags: tags || [],
      is_published: false,
      metadata: {},
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, prompt: newPrompt });
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, is_published, tags, change_summary } = body;

  // If publishing this version, unpublish all other versions with same name
  if (is_published) {
    const { data: prompt } = await supabase
      .from('prompt_patterns')
      .select('name')
      .eq('id', id)
      .single();

    if (prompt) {
      await supabase
        .from('prompt_patterns')
        .update({ is_published: false })
        .eq('user_id', user.id)
        .eq('name', prompt.name);
    }
  }

  // Update the version
  const { data: updated, error: updateError } = await supabase
    .from('prompt_patterns')
    .update({
      is_published,
      tags,
      change_summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, prompt: updated });
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // Soft delete (archive)
  const { error: deleteError } = await supabase
    .from('prompt_patterns')
    .update({ is_archived: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

### 1.3 UI Component

**File**: `components/prompts/PromptVersionManager.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GitBranch,
  Plus,
  CheckCircle,
  Archive,
  Copy,
  Edit,
  Eye,
  Clock
} from 'lucide-react';

interface PromptVersion {
  id: string;
  name: string;
  template: string;
  version: number;
  version_hash: string;
  parent_version_id: string | null;
  is_published: boolean;
  is_archived: boolean;
  change_summary: string;
  tags: string[];
  success_rate: number | null;
  avg_rating: number | null;
  created_at: string;
  updated_at: string;
}

export function PromptVersionManager({ promptName }: { promptName: string }) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVersions();
  }, [promptName]);

  async function fetchVersions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/prompts/versions?name=${encodeURIComponent(promptName)}`);
      const data = await res.json();
      if (data.success) {
        setVersions(data.versions);
        // Select latest published version or latest version
        const published = data.versions.find((v: PromptVersion) => v.is_published);
        setSelectedVersion(published || data.versions[0] || null);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function publishVersion(id: string) {
    try {
      const res = await fetch('/api/prompts/versions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_published: true }),
      });
      if (res.ok) {
        fetchVersions();
      }
    } catch (error) {
      console.error('Failed to publish version:', error);
    }
  }

  async function createNewVersion(fromVersionId: string) {
    const version = versions.find(v => v.id === fromVersionId);
    if (!version) return;

    try {
      const res = await fetch('/api/prompts/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: promptName,
          template: version.template,
          use_case: 'Copied from version ' + version.version,
          copy_from_version_id: fromVersionId,
          change_summary: 'Duplicated from v' + version.version,
        }),
      });
      if (res.ok) {
        fetchVersions();
      }
    } catch (error) {
      console.error('Failed to create version:', error);
    }
  }

  if (loading) {
    return <div className="p-4">Loading versions...</div>;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Version List */}
      <div className="col-span-4 space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Versions
          </h3>
          <Button size="sm" variant="default">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {versions.map((version) => (
          <Card
            key={version.id}
            className={`cursor-pointer transition-colors ${
              selectedVersion?.id === version.id
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedVersion(version)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">v{version.version}</span>
                  {version.is_published && (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Published
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {version.success_rate !== null && (
                    <Badge variant="outline" className="text-xs">
                      {(version.success_rate * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {version.change_summary}
              </p>

              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(version.created_at).toLocaleDateString()}
              </div>

              {version.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {version.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Version Detail */}
      <div className="col-span-8">
        {selectedVersion ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Version {selectedVersion.version}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createNewVersion(selectedVersion.id)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Duplicate
                  </Button>
                  {!selectedVersion.is_published && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => publishVersion(selectedVersion.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Publish
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Change Summary */}
              <div>
                <label className="text-sm font-medium">Change Summary</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedVersion.change_summary}
                </p>
              </div>

              {/* Template Content */}
              <div>
                <label className="text-sm font-medium">Prompt Template</label>
                <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-96">
                  {selectedVersion.template}
                </pre>
              </div>

              {/* Performance Metrics */}
              {(selectedVersion.success_rate !== null || selectedVersion.avg_rating !== null) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedVersion.success_rate !== null && (
                    <div>
                      <label className="text-sm font-medium">Success Rate</label>
                      <p className="text-2xl font-bold mt-1">
                        {(selectedVersion.success_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {selectedVersion.avg_rating !== null && (
                    <div>
                      <label className="text-sm font-medium">Avg Rating</label>
                      <p className="text-2xl font-bold mt-1">
                        {selectedVersion.avg_rating.toFixed(1)} / 5
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Version Hash */}
              <div>
                <label className="text-sm font-medium">Version Hash</label>
                <code className="block mt-1 p-2 bg-muted rounded text-xs">
                  {selectedVersion.version_hash}
                </code>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a version to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

### 1.4 Integration

Add to analytics dashboard or create dedicated `/prompts` page:

**File**: `app/prompts/page.tsx` (NEW)

```typescript
import { PromptVersionManager } from '@/components/prompts/PromptVersionManager';

export default function PromptsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Prompt Management</h1>
      <PromptVersionManager promptName="default_system_prompt" />
    </div>
  );
}
```

---

## Phase 2: Model A/B Comparison Automation

### 2.1 Leverage Existing Infrastructure

**No new tables needed** - Use existing `ab_experiments` and `ab_experiment_variants`

### 2.2 API Endpoint for Model Comparison

**File**: `app/api/analytics/model-ab-test/route.ts` (NEW)

```typescript
/**
 * Model A/B Testing API
 *
 * POST /api/analytics/model-ab-test - Create model comparison experiment
 * GET /api/analytics/model-ab-test/{id}/results - Get comparison results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    description,
    models, // Array of { modelName, provider, temperature, maxTokens }
    systemPrompt,
    testCases, // Array of user messages to test
    trafficSplit, // Equal or custom percentages
  } = body;

  // Create experiment
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .insert({
      user_id: user.id,
      name,
      description: description || `Comparing ${models.map((m: any) => m.modelName).join(' vs ')}`,
      hypothesis: `Testing which model performs better for the given use case`,
      status: 'running',
      experiment_type: 'ab_test',
      primary_metric: 'average_rating',
      secondary_metrics: ['success_rate', 'avg_latency', 'cost_per_request'],
      traffic_percentage: 100,
      start_date: new Date().toISOString(),
      tags: ['model_comparison', 'automated'],
      metadata: { systemPrompt, testCases },
    })
    .select()
    .single();

  if (expError) {
    return NextResponse.json({ error: expError.message }, { status: 500 });
  }

  // Create variants (one per model)
  const variants = models.map((model: any, index: number) => ({
    experiment_id: experiment.id,
    name: model.modelName,
    description: `${model.provider} - ${model.modelName}`,
    is_control: index === 0,
    configuration: {
      modelName: model.modelName,
      modelProvider: model.provider,
      temperature: model.temperature || 0.7,
      maxTokens: model.maxTokens || 1000,
    },
    traffic_percentage: trafficSplit[index] || (100 / models.length),
  }));

  const { data: createdVariants, error: varError } = await supabase
    .from('ab_experiment_variants')
    .insert(variants)
    .select();

  if (varError) {
    return NextResponse.json({ error: varError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    experiment,
    variants: createdVariants,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get('id');

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get experiment with variants
  const { data: experiment, error: expError } = await supabase
    .from('ab_experiments')
    .select(`
      *,
      variants:ab_experiment_variants(*)
    `)
    .eq('id', experimentId)
    .eq('user_id', user.id)
    .single();

  if (expError) {
    return NextResponse.json({ error: expError.message }, { status: 500 });
  }

  // Get traces for each variant
  const variantResults = await Promise.all(
    experiment.variants.map(async (variant: any) => {
      const { data: traces } = await supabase
        .from('llm_traces')
        .select('*')
        .eq('user_id', user.id)
        .eq('model_name', variant.configuration.modelName)
        .eq('model_provider', variant.configuration.modelProvider)
        .gte('created_at', experiment.start_date)
        .lte('created_at', experiment.end_date || new Date().toISOString());

      const avgLatency = traces?.reduce((sum, t) => sum + (t.duration_ms || 0), 0) / (traces?.length || 1);
      const avgCost = traces?.reduce((sum, t) => sum + (t.cost_usd || 0), 0) / (traces?.length || 1);
      const successRate = traces?.filter(t => t.status === 'completed').length / (traces?.length || 1);

      return {
        variant: variant.name,
        modelName: variant.configuration.modelName,
        provider: variant.configuration.modelProvider,
        totalRequests: traces?.length || 0,
        avgLatency,
        avgCost,
        successRate,
        totalCost: traces?.reduce((sum, t) => sum + (t.cost_usd || 0), 0) || 0,
      };
    })
  );

  return NextResponse.json({
    success: true,
    experiment,
    results: variantResults,
  });
}
```

### 2.3 UI Component

**File**: `components/analytics/ModelABTestManager.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, TrendingUp, DollarSign, Zap, Target } from 'lucide-react';

interface ModelConfig {
  modelName: string;
  provider: string;
  temperature: number;
  maxTokens: number;
}

export function ModelABTestManager() {
  const [models, setModels] = useState<ModelConfig[]>([
    { modelName: 'gpt-4o', provider: 'openai', temperature: 0.7, maxTokens: 1000 },
    { modelName: 'claude-3-5-sonnet-20241022', provider: 'anthropic', temperature: 0.7, maxTokens: 1000 },
  ]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [testCases, setTestCases] = useState<string[]>(['']);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  async function runComparison() {
    setRunning(true);
    try {
      const res = await fetch('/api/analytics/model-ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Model Comparison ${new Date().toLocaleDateString()}`,
          models,
          systemPrompt,
          testCases,
          trafficSplit: models.map(() => 100 / models.length),
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Start polling for results
        pollResults(data.experiment.id);
      }
    } catch (error) {
      console.error('Failed to start comparison:', error);
    } finally {
      setRunning(false);
    }
  }

  async function pollResults(experimentId: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/analytics/model-ab-test?id=${experimentId}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        // Stop polling after 10 iterations or when test is complete
        if (data.experiment.status === 'completed') {
          clearInterval(interval);
        }
      }
    }, 5000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Model A/B Test Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model Selection */}
          <div>
            <label className="text-sm font-medium">Models to Compare</label>
            <div className="space-y-2 mt-2">
              {models.map((model, index) => (
                <div key={index} className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Model Name"
                    value={model.modelName}
                    onChange={(e) => {
                      const updated = [...models];
                      updated[index].modelName = e.target.value;
                      setModels(updated);
                    }}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Provider"
                    value={model.provider}
                    onChange={(e) => {
                      const updated = [...models];
                      updated[index].provider = e.target.value;
                      setModels(updated);
                    }}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="Temperature"
                    step="0.1"
                    value={model.temperature}
                    onChange={(e) => {
                      const updated = [...models];
                      updated[index].temperature = parseFloat(e.target.value);
                      setModels(updated);
                    }}
                    className="border rounded px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="Max Tokens"
                    value={model.maxTokens}
                    onChange={(e) => {
                      const updated = [...models];
                      updated[index].maxTokens = parseInt(e.target.value);
                      setModels(updated);
                    }}
                    className="border rounded px-3 py-2"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-sm font-medium">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="w-full border rounded px-3 py-2 mt-2"
              placeholder="You are a helpful assistant..."
            />
          </div>

          {/* Test Cases */}
          <div>
            <label className="text-sm font-medium">Test Cases (User Messages)</label>
            {testCases.map((testCase, index) => (
              <input
                key={index}
                type="text"
                value={testCase}
                onChange={(e) => {
                  const updated = [...testCases];
                  updated[index] = e.target.value;
                  setTestCases(updated);
                }}
                className="w-full border rounded px-3 py-2 mt-2"
                placeholder="Enter test message..."
              />
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTestCases([...testCases, ''])}
              className="mt-2"
            >
              Add Test Case
            </Button>
          </div>

          {/* Run Button */}
          <Button
            onClick={runComparison}
            disabled={running}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {running ? 'Running...' : 'Run A/B Test'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((result: any) => (
            <Card key={result.variant}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{result.modelName}</span>
                  <Badge variant="outline">{result.provider}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    Success Rate
                  </span>
                  <span className="font-semibold">
                    {(result.successRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    Avg Latency
                  </span>
                  <span className="font-semibold">
                    {result.avgLatency.toFixed(0)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Avg Cost
                  </span>
                  <span className="font-semibold">
                    ${result.avgCost.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Total Requests
                  </span>
                  <span className="font-semibold">
                    {result.totalRequests}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 3: Trace Replay for Debugging

### 3.1 API Endpoint

**File**: `app/api/analytics/traces/[id]/replay/route.ts` (NEW)

```typescript
/**
 * Trace Replay API
 *
 * POST /api/analytics/traces/{id}/replay - Replay a trace with optional overrides
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { traceService } from '@/lib/tracing/trace.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const traceId = params.id;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get original trace
  const { data: originalTrace, error: traceError } = await supabase
    .from('llm_traces')
    .select('*')
    .eq('id', traceId)
    .eq('user_id', user.id)
    .single();

  if (traceError || !originalTrace) {
    return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
  }

  // Get overrides from request body
  const body = await request.json();
  const {
    modelName,
    modelProvider,
    temperature,
    maxTokens,
    systemPrompt,
    disableCache,
  } = body;

  // Merge original input_data with overrides
  const inputData = {
    ...originalTrace.input_data,
    systemPrompt: systemPrompt || originalTrace.input_data.systemPrompt,
    parameters: {
      ...originalTrace.input_data.parameters,
      temperature: temperature !== undefined ? temperature : originalTrace.input_data.parameters.temperature,
      maxTokens: maxTokens !== undefined ? maxTokens : originalTrace.input_data.parameters.maxTokens,
    },
  };

  // Start new trace for replay
  const replayContext = await traceService.startTrace({
    userId: user.id,
    spanName: 'trace.replay',
    operationType: 'replay',
    metadata: {
      originalTraceId: originalTrace.id,
      replayedAt: new Date().toISOString(),
      overrides: body,
    },
  });

  try {
    // Call LLM with replayed parameters
    const llmResponse = await callLLMProvider({
      modelName: modelName || originalTrace.model_name,
      modelProvider: modelProvider || originalTrace.model_provider,
      inputData,
      disableCache,
    });

    // End replay trace
    await traceService.endTrace(replayContext, {
      endTime: new Date(),
      status: 'completed',
      inputTokens: llmResponse.usage?.input_tokens,
      outputTokens: llmResponse.usage?.output_tokens,
      cacheCreationInputTokens: disableCache ? undefined : llmResponse.usage?.cache_creation_input_tokens,
      cacheReadInputTokens: disableCache ? undefined : llmResponse.usage?.cache_read_input_tokens,
      costUsd: llmResponse.cost,
      outputData: {
        content: llmResponse.content,
        reasoning: llmResponse.reasoning,
      },
    });

    return NextResponse.json({
      success: true,
      replayTrace: {
        id: replayContext.traceId,
        original_trace_id: originalTrace.id,
        output: llmResponse.content,
        usage: llmResponse.usage,
        cost: llmResponse.cost,
      },
    });
  } catch (error: any) {
    // Capture error in trace
    await traceService.captureError(replayContext, {
      error: error as Error,
      metadata: { phase: 'replay_execution' },
    });

    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// Helper function to call LLM provider
async function callLLMProvider(params: {
  modelName: string;
  modelProvider: string;
  inputData: any;
  disableCache?: boolean;
}) {
  // Implementation depends on your LLM adapter architecture
  // This is a simplified example
  const { modelName, modelProvider, inputData, disableCache } = params;

  if (modelProvider === 'anthropic') {
    const anthropic = await import('@/lib/llm/adapters/anthropic-adapter');
    return anthropic.callAnthropic({
      modelName,
      systemPrompt: inputData.systemPrompt,
      userMessage: inputData.userMessage,
      conversationHistory: inputData.conversationHistory,
      temperature: inputData.parameters.temperature,
      maxTokens: inputData.parameters.maxTokens,
      useCache: !disableCache,
    });
  } else if (modelProvider === 'openai') {
    const openai = await import('@/lib/llm/adapters/openai-adapter');
    return openai.callOpenAI({
      modelName,
      systemPrompt: inputData.systemPrompt,
      userMessage: inputData.userMessage,
      conversationHistory: inputData.conversationHistory,
      temperature: inputData.parameters.temperature,
      maxTokens: inputData.parameters.maxTokens,
    });
  }

  throw new Error(`Unsupported provider: ${modelProvider}`);
}
```

### 3.2 UI Component

**File**: `components/analytics/TraceReplayPanel.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, RefreshCw, Settings, Diff } from 'lucide-react';

interface TraceReplayPanelProps {
  traceId: string;
  originalTrace: any;
}

export function TraceReplayPanel({ traceId, originalTrace }: TraceReplayPanelProps) {
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<any>(null);
  const [showDiff, setShowDiff] = useState(false);

  // Override parameters
  const [modelName, setModelName] = useState(originalTrace.model_name);
  const [modelProvider, setModelProvider] = useState(originalTrace.model_provider);
  const [temperature, setTemperature] = useState(originalTrace.input_data?.parameters?.temperature);
  const [maxTokens, setMaxTokens] = useState(originalTrace.input_data?.parameters?.maxTokens);
  const [disableCache, setDisableCache] = useState(false);

  async function replayTrace() {
    setReplaying(true);
    try {
      const res = await fetch(`/api/analytics/traces/${traceId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName,
          modelProvider,
          temperature,
          maxTokens,
          disableCache,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReplayResult(data.replayTrace);
      }
    } catch (error) {
      console.error('Replay failed:', error);
    } finally {
      setReplaying(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Trace Replay Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Model Name</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Provider</label>
              <input
                type="text"
                value={modelProvider}
                onChange={(e) => setModelProvider(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Temperature</label>
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full border rounded px-3 py-2 mt-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={disableCache}
              onChange={(e) => setDisableCache(e.target.checked)}
              id="disable-cache"
            />
            <label htmlFor="disable-cache" className="text-sm">
              Disable prompt caching
            </label>
          </div>

          <Button
            onClick={replayTrace}
            disabled={replaying}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {replaying ? 'Replaying...' : 'Replay Trace'}
          </Button>
        </CardContent>
      </Card>

      {replayResult && (
        <>
          <div className="flex gap-2">
            <Button
              variant={showDiff ? 'default' : 'outline'}
              onClick={() => setShowDiff(!showDiff)}
              size="sm"
            >
              <Diff className="h-4 w-4 mr-2" />
              {showDiff ? 'Hide' : 'Show'} Diff
            </Button>
          </div>

          {showDiff ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Original Output */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Original Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
                    {originalTrace.output_data?.content}
                  </pre>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tokens:</span>
                      <span>{originalTrace.total_tokens}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cost:</span>
                      <span>${originalTrace.cost_usd?.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{originalTrace.duration_ms}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Replay Output */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Replay Output
                    <Badge variant="default">New</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
                    {replayResult.output}
                  </pre>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tokens:</span>
                      <span>
                        {(replayResult.usage?.input_tokens || 0) + (replayResult.usage?.output_tokens || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cost:</span>
                      <span>${replayResult.cost?.toFixed(4)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Replay Result</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96">
                  {replayResult.output}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
```

### 3.3 Integration into TraceView

**File**: `components/analytics/TraceView.tsx` (MODIFY)

Add replay panel to the trace detail view:

```typescript
import { TraceReplayPanel } from './TraceReplayPanel';

// Inside TraceView component, add a new tab or section:
<Tabs defaultValue="details">
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="replay">Replay</TabsTrigger>
  </TabsList>

  <TabsContent value="details">
    {/* Existing trace details */}
  </TabsContent>

  <TabsContent value="replay">
    <TraceReplayPanel
      traceId={trace.id}
      originalTrace={trace}
    />
  </TabsContent>
</Tabs>
```

---

## Testing Plan

### Phase 1: Prompt Versioning
- [ ] Apply migration for prompt versioning
- [ ] Create multiple versions of a prompt
- [ ] Publish a version
- [ ] Archive a version
- [ ] Verify version hash generation
- [ ] Test version history traversal

### Phase 2: Model A/B Testing
- [ ] Create model comparison experiment
- [ ] Run test with 2+ models
- [ ] Verify traffic splitting
- [ ] View results comparison
- [ ] Calculate statistical significance

### Phase 3: Trace Replay
- [ ] Replay a trace with same parameters
- [ ] Replay with different model
- [ ] Replay with different temperature
- [ ] Replay with cache disabled
- [ ] Compare original vs replay outputs
- [ ] Verify cost/token differences

---

## Rollout Timeline

**Week 1**: Phase 1 - Prompt Version Management
- Day 1-2: Database migration and API endpoints
- Day 3-4: UI component development
- Day 5: Integration and testing

**Week 2**: Phase 2 - Model A/B Comparison
- Day 1-2: API endpoint for automated comparison
- Day 3-4: UI component development
- Day 5: Integration with existing experiment manager

**Week 3**: Phase 3 - Trace Replay
- Day 1-2: Replay API endpoint
- Day 2-3: Replay panel UI
- Day 4: Diff viewer implementation
- Day 5: Integration and testing

---

## Success Metrics

After implementation, we should be able to:
- **Prompt Management**: Track prompt changes over time, compare performance across versions
- **Model Comparison**: Automatically test multiple models side-by-side with real metrics
- **Debugging**: Replay any trace to reproduce issues or test improvements

---

## Dependencies

- Existing tracing infrastructure ✅
- Existing A/B testing system ✅
- LLM adapter functions (anthropic-adapter, openai-adapter) ✅
- UI component library (Card, Button, Badge) ✅

---

## Next Steps

1. Review and approve this plan
2. Apply Phase 1 migration
3. Implement Phase 1 API and UI
4. Test prompt versioning end-to-end
5. Proceed to Phase 2
