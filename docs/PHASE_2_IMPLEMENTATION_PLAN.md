# Phase 2: Training Config Builder - Implementation Plan

**Goal:** Create UI to build, validate, save, and download Tiny Tool Use training configs

**Estimated Time:** 4-6 hours
**Risk Level:** Low (new feature, no breaking changes)
**Status:** Planning

---

## What We're Building

A web interface to:
1. Build training configs via forms (no manual JSON editing)
2. Select from templates (SFT, DPO, etc.)
3. Validate config before saving
4. Download JSON for manual training
5. Save configs to database for reuse
6. Load and edit saved configs

**User Flow:**
```
/training page → Select template → Fill form → Validate → Save/Download
```

---

## Config Structure Analysis

Based on analysis of existing configs in `bagel-RL/Tiny Tool Use/configs/`:

### Config Sections

**1. Model Section:**
```json
{
  "model": {
    "name": "Qwen/Qwen3-0.6B",
    "trust_remote_code": true,
    "torch_dtype": "float16",
    "device_map": "auto"
  }
}
```

**2. Tokenizer Section:**
```json
{
  "tokenizer": {
    "name": "Qwen/Qwen3-0.6B",
    "trust_remote_code": true,
    "padding_side": "left"
  }
}
```

**3. Training Section (SFT):**
```json
{
  "training": {
    "method": "sft",
    "num_epochs": 1,
    "learning_rate": 5e-5,
    "batch_size": 4,
    "gradient_accumulation_steps": 8,
    "warmup_steps": 100,
    "max_length": 2048,
    "use_lora": true,
    "lora_r": 8,
    "lora_alpha": 32,
    "lora_dropout": 0.05
  }
}
```

**4. Training Section (DPO - More Options):**
```json
{
  "training": {
    "method": "dpo",
    "num_epochs": 100,
    "learning_rate": 1e-6,
    "batch_size": 2,
    "gradient_accumulation_steps": 16,
    "warmup_steps": 100,
    "max_length": 512,
    "use_lora": true,
    "lora_r": 16,
    "lora_alpha": 32,
    "lora_dropout": 0.1,
    "max_grad_norm": 0.3,
    "bf16": false,
    "fp16": true,
    "adam_beta1": 0.9,
    "adam_beta2": 0.999,
    "adam_epsilon": 1e-8,
    "weight_decay": 0.01,
    "optim": "paged_adamw_8bit"
  }
}
```

**5. Data Section:**
```json
{
  "data": {
    "strategy": "toolbench",
    "generation_type": "real",
    "max_samples": 700,
    "train_split": 0.99
  }
}
```

**6. Tools Section (Optional):**
```json
{
  "tools": [
    {
      "name": "calculator",
      "description": "Perform mathematical calculations",
      "type": "function",
      "function": "calculator",
      "parameters": { ... }
    }
  ]
}
```

**7. Evaluation Section (Optional):**
```json
{
  "evaluation": {
    "metrics": ["tool_accuracy", "response_quality"],
    "eval_steps": 100
  }
}
```

### Config Templates Found

1. `sft_toolbench_config.json` - SFT with ToolBench dataset
2. `sft_pc_building_config.json` - SFT with PC Building dataset
3. `dpo_config.json` - DPO training (advanced)
4. `teacher_mode_config.json` - Teacher mode training
5. `knowledge_dense_config.json` - Knowledge-dense training
6. `hybrid_training_config.json` - Hybrid approach

---

## Implementation Steps

### Step 1: Database Schema (30 min)

**File:** `docs/schema_updates/14_training_configs.sql`

Create `training_configs` table:

```sql
CREATE TABLE IF NOT EXISTS training_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'sft', 'dpo', 'custom'

  -- Config JSON
  config_json JSONB NOT NULL,

  -- Validation
  is_validated BOOLEAN DEFAULT false,
  validation_errors JSONB,

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_config_name UNIQUE (user_id, name)
);
```

**Indexes:**
- `idx_training_configs_user_id`
- `idx_training_configs_template_type`
- `idx_training_configs_created_at`

**RLS Policies:**
- Users can only see/edit their own configs
- Service role has full access

**Validation:**
- All columns properly typed
- JSONB for flexible config storage
- Validation errors stored for debugging

---

### Step 2: TypeScript Types (20 min)

**File:** `lib/training/training-config.types.ts` (NEW)

Define comprehensive types:

```typescript
// Config sections
export interface ModelConfig {
  name: string;
  trust_remote_code: boolean;
  torch_dtype: 'float16' | 'float32' | 'bfloat16';
  device_map: 'auto' | 'cuda' | 'cpu';
}

export interface TokenizerConfig {
  name: string;
  trust_remote_code: boolean;
  padding_side?: 'left' | 'right';
}

export type TrainingMethod = 'sft' | 'dpo' | 'rlhf';
export type DataStrategy = 'toolbench' | 'pc_building' | 'teacher_mode' | 'knowledge_dense' | 'manual_templates' | 'custom';
export type GenerationType = 'real' | 'synthetic';

export interface BaseTrainingConfig {
  method: TrainingMethod;
  num_epochs: number;
  learning_rate: number;
  batch_size: number;
  gradient_accumulation_steps: number;
  warmup_steps: number;
  max_length: number;
  use_lora: boolean;
  lora_r?: number;
  lora_alpha?: number;
  lora_dropout?: number;
}

export interface AdvancedTrainingConfig extends BaseTrainingConfig {
  max_grad_norm?: number;
  bf16?: boolean;
  fp16?: boolean;
  adam_beta1?: number;
  adam_beta2?: number;
  adam_epsilon?: number;
  weight_decay?: number;
  optim?: string;
}

export interface DataConfig {
  strategy: DataStrategy;
  generation_type: GenerationType;
  max_samples: number;
  train_split: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  type: 'function';
  function: string;
  parameters: Record<string, any>;
}

export interface EvaluationConfig {
  metrics: string[];
  eval_steps: number;
}

// Full config
export interface TrainingConfig {
  model: ModelConfig;
  tokenizer: TokenizerConfig;
  training: BaseTrainingConfig | AdvancedTrainingConfig;
  data: DataConfig;
  tools?: ToolDefinition[];
  evaluation?: EvaluationConfig;
  tensorboard?: {
    enabled: boolean;
    log_dir: string;
  };
  seed?: number;
}

// Database types
export interface TrainingConfigRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_type: string;
  config_json: TrainingConfig;
  is_validated: boolean;
  validation_errors: any | null;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// DTOs
export interface CreateConfigDTO {
  name: string;
  description?: string;
  template_type: string;
  config_json: TrainingConfig;
}

export interface UpdateConfigDTO {
  name?: string;
  description?: string;
  config_json?: TrainingConfig;
}
```

**Validation:**
- Read existing type patterns in `lib/models/llm-model.types.ts`
- Ensure consistent naming conventions
- Add JSDoc comments for complex types

---

### Step 3: Config Templates (30 min)

**File:** `lib/training/training-templates.ts` (NEW)

Create pre-configured templates:

```typescript
import type { TrainingConfig } from './training-config.types';

export const SFT_TOOLBENCH_TEMPLATE: TrainingConfig = {
  model: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true,
    torch_dtype: 'float16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'Qwen/Qwen3-0.6B',
    trust_remote_code: true
  },
  training: {
    method: 'sft',
    num_epochs: 1,
    learning_rate: 5e-5,
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_steps: 100,
    max_length: 2048,
    use_lora: true,
    lora_r: 8,
    lora_alpha: 32,
    lora_dropout: 0.05
  },
  data: {
    strategy: 'toolbench',
    generation_type: 'real',
    max_samples: 700,
    train_split: 0.99
  }
};

export const DPO_TEMPLATE: TrainingConfig = {
  // ... DPO config
};

export const ALL_TEMPLATES = {
  'sft_toolbench': SFT_TOOLBENCH_TEMPLATE,
  'sft_pc_building': SFT_PC_BUILDING_TEMPLATE,
  'dpo_basic': DPO_TEMPLATE,
  'teacher_mode': TEACHER_MODE_TEMPLATE,
  'knowledge_dense': KNOWLEDGE_DENSE_TEMPLATE
};

export function getTemplateByType(type: string): TrainingConfig | null {
  return ALL_TEMPLATES[type] || null;
}
```

**Validation:**
- Copy exact values from existing JSON configs
- Test each template loads correctly
- Verify TypeScript types match

---

### Step 4: Config Validation Service (45 min)

**File:** `lib/training/config-validator.ts` (NEW)

Create validation logic:

```typescript
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

export class TrainingConfigValidator {
  validate(config: TrainingConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate model section
    this.validateModel(config.model, errors, warnings);

    // Validate training section
    this.validateTraining(config.training, errors, warnings);

    // Validate data section
    this.validateData(config.data, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateModel(
    model: ModelConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!model.name) {
      errors.push({
        field: 'model.name',
        message: 'Model name is required',
        severity: 'error'
      });
    }

    if (model.torch_dtype === 'float32') {
      warnings.push({
        field: 'model.torch_dtype',
        message: 'float32 uses more VRAM. Consider float16 for 8GB GPUs',
        severity: 'warning'
      });
    }
  }

  private validateTraining(
    training: BaseTrainingConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (training.batch_size < 1) {
      errors.push({
        field: 'training.batch_size',
        message: 'Batch size must be at least 1',
        severity: 'error'
      });
    }

    if (training.learning_rate > 1e-3) {
      warnings.push({
        field: 'training.learning_rate',
        message: 'High learning rate may cause unstable training',
        severity: 'warning'
      });
    }

    if (training.use_lora) {
      if (!training.lora_r) {
        errors.push({
          field: 'training.lora_r',
          message: 'LoRA rank (r) required when use_lora is true',
          severity: 'error'
        });
      }
    }
  }

  private validateData(
    data: DataConfig,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (data.max_samples < 1) {
      errors.push({
        field: 'data.max_samples',
        message: 'Max samples must be at least 1',
        severity: 'error'
      });
    }

    if (data.train_split < 0 || data.train_split > 1) {
      errors.push({
        field: 'data.train_split',
        message: 'Train split must be between 0 and 1',
        severity: 'error'
      });
    }
  }
}

export const configValidator = new TrainingConfigValidator();
```

**Validation:**
- Test with valid configs (should pass)
- Test with invalid configs (should fail with errors)
- Verify warnings don't block validation

---

### Step 5: Training Page UI (2 hours)

**File:** `app/training/page.tsx` (NEW)

Create main training config page:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Download, Upload, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigCard } from '@/components/training/ConfigCard';
import { CreateConfigDialog } from '@/components/training/CreateConfigDialog';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';

export default function TrainingPage() {
  const { user, session } = useAuth();
  const router = useRouter();

  const [configs, setConfigs] = useState<TrainingConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch configs
  useEffect(() => {
    if (user && session?.access_token) {
      fetchConfigs();
    }
  }, [user, session]);

  async function fetchConfigs() {
    // Implementation
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Training Configs</h1>
          <p className="text-muted-foreground mt-2">
            Build, save, and manage training configurations for Tiny Tool Use
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Config
          </Button>
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import JSON
          </Button>
        </div>

        {/* Configs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map(config => (
            <ConfigCard
              key={config.id}
              config={config}
              onEdit={(id) => router.push(`/training/${id}`)}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>

        {/* Create Dialog */}
        {showCreateDialog && (
          <CreateConfigDialog
            isOpen={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            onSuccess={() => {
              setShowCreateDialog(false);
              fetchConfigs();
            }}
          />
        )}
      </div>
    </div>
  );
}
```

**Validation:**
- Verify auth check works
- Test empty state
- Test loading state
- Verify navigation

---

### Step 6: Config Builder Form (2 hours)

**File:** `app/training/[id]/page.tsx` (NEW)
**File:** `components/training/ConfigBuilderForm.tsx` (NEW)

Create multi-section form:

```typescript
// ConfigBuilderForm.tsx
export function ConfigBuilderForm({
  initialConfig,
  onSave,
  onValidate
}: ConfigBuilderFormProps) {
  const [config, setConfig] = useState<TrainingConfig>(initialConfig);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleFieldChange = (section: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  return (
    <div className="space-y-8">
      {/* Model Section */}
      <ModelSection
        config={config.model}
        onChange={(field, value) => handleFieldChange('model', field, value)}
        errors={getFieldErrors(validationResult, 'model')}
      />

      {/* Training Section */}
      <TrainingSection
        config={config.training}
        onChange={(field, value) => handleFieldChange('training', field, value)}
        errors={getFieldErrors(validationResult, 'training')}
      />

      {/* Data Section */}
      <DataSection
        config={config.data}
        onChange={(field, value) => handleFieldChange('data', field, value)}
        errors={getFieldErrors(validationResult, 'data')}
      />

      {/* Validation Results */}
      {validationResult && !validationResult.isValid && (
        <ValidationErrors errors={validationResult.errors} />
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={() => onValidate(config)}>
          Validate Config
        </Button>
        <Button onClick={() => onSave(config)}>
          Save Config
        </Button>
        <Button variant="outline" onClick={() => downloadJSON(config)}>
          <Download className="w-4 h-4 mr-2" />
          Download JSON
        </Button>
      </div>
    </div>
  );
}
```

**Validation:**
- Test each form section independently
- Verify field changes update state
- Test validation display
- Test JSON download

---

### Step 7: API Endpoints (1 hour)

**File:** `app/api/training/route.ts` (NEW - GET, POST)
**File:** `app/api/training/[id]/route.ts` (NEW - GET, PUT, DELETE)
**File:** `app/api/training/validate/route.ts` (NEW - POST)

Create CRUD endpoints:

```typescript
// app/api/training/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { configValidator } from '@/lib/training/config-validator';

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('training_configs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TrainingAPI] Fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ configs: data });
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, template_type, config_json } = body;

  // Validate config
  const validationResult = configValidator.validate(config_json);

  const { data, error } = await supabase
    .from('training_configs')
    .insert({
      user_id: user.id,
      name,
      description,
      template_type,
      config_json,
      is_validated: validationResult.isValid,
      validation_errors: validationResult.isValid ? null : validationResult.errors
    })
    .select()
    .single();

  if (error) {
    console.error('[TrainingAPI] Create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data });
}
```

**Validation:**
- Test with Postman/curl before UI integration
- Verify auth checks work
- Test error handling
- Check validation runs correctly

---

## File Structure

```
web-ui/
├── app/
│   ├── training/
│   │   ├── page.tsx (NEW - Config list page)
│   │   └── [id]/
│   │       └── page.tsx (NEW - Config editor)
│   └── api/
│       └── training/
│           ├── route.ts (NEW - GET all, POST)
│           ├── [id]/
│           │   └── route.ts (NEW - GET, PUT, DELETE)
│           └── validate/
│               └── route.ts (NEW - POST validation)
├── components/
│   └── training/
│       ├── ConfigCard.tsx (NEW)
│       ├── ConfigBuilderForm.tsx (NEW)
│       ├── CreateConfigDialog.tsx (NEW)
│       ├── ModelSection.tsx (NEW)
│       ├── TrainingSection.tsx (NEW)
│       ├── DataSection.tsx (NEW)
│       └── ValidationErrors.tsx (NEW)
├── lib/
│   └── training/
│       ├── training-config.types.ts (NEW)
│       ├── training-templates.ts (NEW)
│       └── config-validator.ts (NEW)
└── docs/
    └── schema_updates/
        └── 14_training_configs.sql (NEW)
```

---

## Testing Plan

### Unit Tests
1. Config validator with valid configs
2. Config validator with invalid configs
3. Template loading
4. Field change handlers

### Integration Tests
1. Create config via API
2. Fetch configs
3. Update config
4. Delete config
5. Validate config endpoint

### E2E Tests
1. Create config from template
2. Edit and save config
3. Download JSON
4. Import JSON
5. Delete config

---

## Verification Checklist

### Database
- [ ] Migration executed successfully
- [ ] Table created with correct columns
- [ ] Indexes created
- [ ] RLS policies work
- [ ] Can insert/select/update/delete

### TypeScript Types
- [ ] All types compile
- [ ] No type errors
- [ ] Consistent with existing patterns
- [ ] JSDoc comments added

### Templates
- [ ] All 5 templates load correctly
- [ ] Templates match existing JSON configs
- [ ] Can get template by type

### Validator
- [ ] Valid configs pass validation
- [ ] Invalid configs fail with errors
- [ ] Warnings displayed but don't block
- [ ] All required fields checked

### API Endpoints
- [ ] GET /api/training returns configs
- [ ] POST /api/training creates config
- [ ] GET /api/training/[id] returns config
- [ ] PUT /api/training/[id] updates config
- [ ] DELETE /api/training/[id] deletes config
- [ ] POST /api/training/validate returns validation

### UI Pages
- [ ] /training page loads
- [ ] Configs display correctly
- [ ] Create dialog opens
- [ ] /training/[id] editor loads
- [ ] Form sections render
- [ ] Field changes update state
- [ ] Validation displays errors
- [ ] Save button works
- [ ] Download JSON works

### Integration
- [ ] Can create config from UI
- [ ] Config saves to database
- [ ] Can edit saved config
- [ ] Can download JSON
- [ ] Can delete config
- [ ] Navigation works

---

## Logging Points

Add console.log at these critical points:

```typescript
// Config creation
console.log('[TrainingConfig] Creating config:', configName);
console.log('[TrainingConfig] Validation result:', validationResult);
console.log('[TrainingConfig] Config saved:', configId);

// Config loading
console.log('[TrainingConfig] Loading config:', configId);
console.log('[TrainingConfig] Config loaded:', config);

// Validation
console.log('[ConfigValidator] Validating config:', configName);
console.log('[ConfigValidator] Errors:', errors);
console.log('[ConfigValidator] Warnings:', warnings);

// Form changes
console.log('[ConfigForm] Field changed:', section, field, value);
console.log('[ConfigForm] Updated config:', updatedConfig);

// API calls
console.log('[TrainingAPI] Request:', method, endpoint);
console.log('[TrainingAPI] Response:', status, data);
```

---

## Success Criteria

1. ✅ User can create config from template in < 2 minutes
2. ✅ Validation catches common errors
3. ✅ JSON downloads correctly formatted
4. ✅ Saved configs can be reused
5. ✅ Zero breaking changes to existing features
6. ✅ All TypeScript compiles without errors
7. ✅ Server hot-reloads successfully

---

## Rollback Plan

If Phase 2 fails:
1. Drop `training_configs` table
2. Delete `/training` pages
3. Delete `/api/training` endpoints
4. Delete `lib/training/` directory
5. Delete `components/training/` directory

No impact on Phase 1 (model import) or existing features.

---

## Next Steps After Phase 2

1. User testing and feedback
2. Add more templates (custom datasets)
3. Add config comparison tool
4. Implement training job submission (Phase 3)

---

**Status:** Awaiting approval to proceed
**Created:** 2025-10-16
**Estimated Completion:** 4-6 hours after approval
