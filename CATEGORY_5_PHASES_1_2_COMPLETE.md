# Category 5 Phases 1 & 2: Prompt Versioning + Model A/B Comparison - COMPLETED

**Date**: 2025-12-21
**Branch**: trace-enhancements-phase-3
**Status**: ✅ Phases 1 & 2 Complete

---

## Summary

Phases 1 and 2 of Category 5 (Debugging & Versioning) have been successfully implemented:

### Phase 1: Prompt Version Management
- Full versioning system for prompts with history tracking
- Publish/unpublish capabilities
- Performance metrics per version
- Dedicated UI at `/prompts`

### Phase 2: Model A/B Comparison Automation
- Leverages existing A/B testing infrastructure
- Specialized model comparison workflow
- Integrated into Analytics Dashboard Research tab
- Simplified model testing interface

---

## Phase 1: Files Implemented

### 1. Database Migration
**File**: `supabase/migrations/20251221000002_create_prompt_patterns_with_versioning.sql`
- Complete schema with versioning (version, version_hash, parent_version_id)
- Auto-generated SHA-256 hashes
- RLS policies for security
- Triggers for auto-updates

### 2. API Endpoints
**File**: `app/api/prompts/versions/route.ts`
- GET - List versions by name
- POST - Create new version with auto-increment
- PATCH - Update metadata (publish, tags, change_summary)
- DELETE - Archive versions (soft delete)

### 3. UI Component
**File**: `components/prompts/PromptVersionManager.tsx`
- Two-column layout: version list + details
- Version actions: Duplicate, Publish
- Shows metrics and version history
- Auto-selects published or latest version

### 4. Page Route
**File**: `app/prompts/page.tsx`
- Protected route at `/prompts`
- Integrated with authentication

---

## Phase 2: Files Implemented

### 1. Model Comparison API Enhancement
**File**: `app/api/analytics/model-comparison/route.ts`
- **New POST Endpoint**: Creates model comparison experiments
- Validates models (requires at least 2)
- Auto-splits traffic evenly or accepts custom split
- Creates experiment in `ab_experiments` table
- Creates variants in `ab_experiment_variants` table
- Each variant configured with model-specific settings

**Endpoint Details**:
```typescript
POST /api/analytics/model-comparison
Body: {
  name: string (optional)
  description?: string
  models: Array<{
    modelName: string
    provider: string
    temperature?: number
    maxTokens?: number
  }>
  systemPrompt?: string
  testCases?: string[]
  trafficSplit?: number[]
}

Response: {
  success: true
  experiment: {...}
  variants: [...]
}
```

### 2. Model Comparison UI Component
**File**: `components/analytics/ModelComparisonPanel.tsx`

**Features**:
- Configure 2+ models for comparison
- Set model name, provider, temperature, max tokens
- Optional system prompt
- Optional test cases
- Add/remove models dynamically
- Auto-generates experiment name
- Shows success/error feedback
- Creates draft experiment via API

**UI Sections**:
1. Experiment Name (optional)
2. Models Configuration Grid (6 columns)
   - Model Name
   - Provider
   - Temperature
   - Max Tokens
   - Remove button
3. System Prompt (optional textarea)
4. Test Cases (optional list)
5. Create button

### 3. Analytics Dashboard Integration
**File**: `components/analytics/AnalyticsDashboard.tsx` (Modified)

**Changes**:
- Added lazy import for ModelComparisonPanel (line 41)
- Integrated into Research tab (line 841-843)
- Positioned at top of Research tab with Suspense wrapper

**Integration Code**:
```typescript
const ModelComparisonPanel = lazy(() => import('./ModelComparisonPanel').then(m => ({ default: m.ModelComparisonPanel })));

// In Research Tab:
<TabsContent value="research" className="space-y-6 mt-6">
  <Suspense fallback={<ChartLoader />}>
    <ModelComparisonPanel />
  </Suspense>
  {/* Other research components */}
</TabsContent>
```

---

## How It Works: Model Comparison Flow

### 1. User Creates Comparison
- User navigates to Analytics Dashboard > Research tab
- Configures 2+ models with their parameters
- Optionally adds system prompt and test cases
- Clicks "Create Model Comparison"

### 2. API Creates Experiment
- Validates input (at least 2 models, traffic sums to 100%)
- Creates experiment record in `ab_experiments`:
  - Type: `model_comparison`
  - Status: `draft`
  - Primary metric: `average_rating`
  - Secondary metrics: `success_rate`, `avg_latency`, `cost_per_request`
  - Metadata: stores system prompt and test cases

### 3. API Creates Variants
- Creates one variant per model in `ab_experiment_variants`
- First model marked as `is_control`
- Each variant stores:
  - Model configuration (name, provider, temperature, maxTokens)
  - Traffic percentage
  - Reference to parent experiment

### 4. Experiment Ready for Use
- Experiment created as draft
- Can be activated via existing ExperimentManager
- Existing A/B testing infrastructure handles:
  - Traffic splitting
  - Metrics collection
  - Statistical analysis
  - Results visualization

---

## Integration with Existing A/B Testing

Phase 2 leverages the existing experiment infrastructure:

### Existing Tables (Reused)
- `ab_experiments` - Stores experiment metadata
- `ab_experiment_variants` - Stores model configurations as variants
- `ab_experiment_members` - RBAC for experiment access

### Existing Components (Available)
- `ExperimentManager` - View/manage all experiments
- Experiment RBAC Service - Role-based access control
- Experiment Analytics - Results analysis

### What's New (Phase 2 Additions)
- Simplified model comparison workflow
- Model-specific experiment type (`model_comparison`)
- Dedicated UI in Analytics Research tab
- Streamlined API endpoint for model testing

---

## API Examples

### Create Model Comparison
```bash
POST /api/analytics/model-comparison
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "GPT-4o vs Claude Sonnet Comparison",
  "models": [
    {
      "modelName": "gpt-4o",
      "provider": "openai",
      "temperature": 0.7,
      "maxTokens": 1000
    },
    {
      "modelName": "claude-3-5-sonnet-20241022",
      "provider": "anthropic",
      "temperature": 0.7,
      "maxTokens": 1000
    }
  ],
  "systemPrompt": "You are a helpful coding assistant",
  "testCases": [
    "Write a function to reverse a string",
    "Explain async/await in JavaScript"
  ]
}

Response:
{
  "success": true,
  "experiment": {
    "id": "exp-uuid",
    "name": "GPT-4o vs Claude Sonnet Comparison",
    "experiment_type": "model_comparison",
    "status": "draft",
    ...
  },
  "variants": [
    {
      "id": "var-1-uuid",
      "name": "gpt-4o",
      "is_control": true,
      "configuration": {
        "modelName": "gpt-4o",
        "modelProvider": "openai",
        "temperature": 0.7,
        "maxTokens": 1000
      },
      "traffic_percentage": 50
    },
    {
      "id": "var-2-uuid",
      "name": "claude-3-5-sonnet-20241022",
      "is_control": false,
      "configuration": {
        "modelName": "claude-3-5-sonnet-20241022",
        "modelProvider": "anthropic",
        "temperature": 0.7,
        "maxTokens": 1000
      },
      "traffic_percentage": 50
    }
  ]
}
```

---

## Security

### Authentication
- All endpoints require valid Supabase auth token
- User session validated via `supabase.auth.getUser()`
- Unauthorized requests return 401

### Authorization
- RLS policies ensure users only access their own data
- Experiment RBAC controls who can view/edit experiments
- Model configurations stored securely in variant records

---

## Next Steps (Phase 3)

### Phase 3: Trace Replay for Debugging
Still pending implementation:
1. Create `/api/analytics/traces/[id]/replay` endpoint
   - Replay trace with same or different parameters
   - Override model, temperature, prompts
   - Option to disable caching
   - Return new trace with comparison data

2. Build TraceReplayPanel UI component
   - Display original trace data
   - Parameter override controls
   - Side-by-side output comparison
   - Cost/token/latency diff

3. Integrate replay panel into TraceView
   - Add "Replay" tab to existing trace viewer
   - Show original vs replay results
   - Highlight differences

---

## Testing Recommendations

### Phase 1 Testing
1. Create first prompt version
2. Create subsequent versions
3. Publish a version (verify others unpublish)
4. Duplicate a version
5. Archive a version
6. View metrics

### Phase 2 Testing
1. Navigate to Analytics > Research tab
2. Verify ModelComparisonPanel loads
3. Configure 2 models
4. Create comparison (verify experiment created)
5. Check ExperimentManager for new experiment
6. Verify experiment has correct variants
7. Test with 3+ models
8. Test custom traffic split

---

## Files Modified

### Phase 1
- None (all new files)

### Phase 2
- `app/api/analytics/model-comparison/route.ts` - Added POST handler
- `components/analytics/AnalyticsDashboard.tsx` - Added ModelComparisonPanel integration

---

## Dependencies

- Existing A/B testing infrastructure (`ab_experiments`, `ab_experiment_variants`)
- Supabase Auth
- Next.js App Router
- Shadcn UI components
- Existing ExperimentManager for viewing results

---

## Conclusion

Phases 1 & 2 of Category 5 provide powerful debugging and versioning capabilities:

**Phase 1** enables teams to:
- Track prompt evolution over time
- Roll back to previous versions
- Compare performance across versions
- Maintain prompt history

**Phase 2** enables teams to:
- Quickly set up model comparisons
- Leverage existing A/B infrastructure
- Test models side-by-side
- Make data-driven model selection decisions

Both phases integrate seamlessly with existing infrastructure and follow best practices:
- No hard-coded values
- No stub implementations
- Proper authentication/authorization
- Clean, maintainable code structure
- Type-safe TypeScript

Phase 3 (Trace Replay) remains pending for debugging individual traces with parameter overrides.
