# Phased Implementation Plan: Benchmark Configurability Enhancement

**Created:** October 26, 2025  
**Feature Branch:** feature/analytics-export  
**Repository:** five5_server (canfieldjuan)

---

## Executive Summary

Current state: The Benchmark Manager UI exposes minimal configuration (name, description, task_type, min_score, is_public). The backend framework fully supports advanced features (required_validators, custom_rules) that are not exposed in the UI.

**Goal:** Enable full benchmark configurability by exposing validator selection and custom rules in the UI, implementing edit functionality, and aligning API response shapes.

---

## Phase 1: API Alignment & Backend Prep (Foundation)

**Priority:** Critical  
**Estimated Effort:** 2-3 hours  
**Dependencies:** None

### 1.1 Standardize `/api/benchmarks` Response Shape

**Problem Verified:**
- `BenchmarkManager.tsx` expects: `response.data.data` (array)
- `BatchTesting.tsx` expects: `response.data.benchmarks` (array)
- Inconsistency causes empty lists in one component

**Files to Modify:**
- `app/api/benchmarks/route.ts` (GET handler)

**Changes:**
```typescript
// Current (line ~149):
return NextResponse.json({
  success: true,
  data: benchmarks as Benchmark[],
});

// Proposed unified shape:
return NextResponse.json({
  success: true,
  benchmarks: benchmarks as Benchmark[],  // Primary property
  data: benchmarks as Benchmark[],        // Backward compat (optional)
});
```

**Then update components:**
- `components/training/BenchmarkManager.tsx`: Use `response.data.benchmarks`
- `components/training/BatchTesting.tsx`: Keep using `response.data.benchmarks`

**Verification Steps:**
1. Run linter on modified files
2. Test GET /api/benchmarks in browser dev tools
3. Verify both components render benchmark lists
4. Check for TypeScript errors

---

### 1.2 Add PATCH Endpoint for Benchmark Updates

**Current State:** Only POST (create) and GET (list) exist; no update endpoint.

**New File:** `app/api/benchmarks/[id]/route.ts`

**Implementation:**
```typescript
/**
 * PATCH /api/benchmarks/[id] - Update existing benchmark
 * Only owner can update (unless admin role added later)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Authenticate user
  // 2. Verify ownership (created_by = user.id)
  // 3. Parse UpdateBenchmarkRequest body
  // 4. Validate fields (optional validators exist in VALIDATOR_MAP)
  // 5. Update via Supabase admin client
  // 6. Return updated benchmark
}

/**
 * DELETE /api/benchmarks/[id] - Delete benchmark (optional, nice-to-have)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Similar auth/ownership checks
  // Soft delete or hard delete based on requirements
}
```

**Dependencies:**
- `lib/benchmarks/types.ts` already defines `UpdateBenchmarkRequest`
- Supabase `benchmarks` table supports updates (verify RLS policies)

**Verification Steps:**
1. Test PATCH with Postman/curl
2. Verify ownership check rejects unauthorized updates
3. Confirm required_validators and custom_rules persist correctly

---

### 1.3 Create Validator Metadata Endpoint (Optional but Recommended)

**Purpose:** Provide UI with list of available validators + descriptions for better UX.

**New File:** `app/api/benchmarks/validators/route.ts`

**Implementation:**
```typescript
export async function GET() {
  const validators = [
    {
      id: 'must_cite_if_claims',
      name: 'Must Cite If Claims',
      description: 'Ensures responses cite sources when making factual claims',
      category: 'accuracy',
    },
    {
      id: 'format_ok',
      name: 'Format OK',
      description: 'Validates response follows expected format (JSON, Markdown, etc.)',
      category: 'formatting',
    },
    // Future validators as they're added to VALIDATOR_MAP
  ];
  
  return NextResponse.json({ success: true, validators });
}
```

**Alternative (simpler):** Hardcode validator list in frontend constant if metadata rarely changes.

---

## Phase 2: UI Components - Validator Selection (Core Feature)

**Priority:** High  
**Estimated Effort:** 4-5 hours  
**Dependencies:** Phase 1.3 (validator metadata) or hardcoded list

### 2.1 Add Validator Multi-Select to BenchmarkManager Create Form

**File:** `components/training/BenchmarkManager.tsx`

**Location:** Inside the create form, after `pass_criteria.min_score` input

**New State:**
```typescript
const [selectedValidators, setSelectedValidators] = useState<string[]>([]);
```

**UI Component Options:**

**Option A - Custom Multi-Select (Recommended for Control):**
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Required Validators (Optional)
  </label>
  <div className="space-y-2">
    {AVAILABLE_VALIDATORS.map(validator => (
      <label key={validator.id} className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selectedValidators.includes(validator.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedValidators([...selectedValidators, validator.id]);
            } else {
              setSelectedValidators(selectedValidators.filter(v => v !== validator.id));
            }
          }}
          className="mt-1"
        />
        <div>
          <div className="text-sm font-medium">{validator.name}</div>
          <div className="text-xs text-gray-500">{validator.description}</div>
        </div>
      </label>
    ))}
  </div>
</div>
```

**Option B - shadcn/ui Multi-Select (if available):**
- Use existing `Select` component with `multiple` prop
- May need to install/configure multi-select variant

**Validator Metadata (Hardcoded Constant):**
```typescript
const AVAILABLE_VALIDATORS = [
  {
    id: 'must_cite_if_claims',
    name: 'Must Cite If Claims',
    description: 'Ensures responses cite sources when making factual claims',
    category: 'accuracy',
  },
  {
    id: 'format_ok',
    name: 'Format OK',
    description: 'Validates response follows expected format',
    category: 'formatting',
  },
] as const;
```

**Form Submission Update:**
```typescript
// In handleCreate function, update pass_criteria:
const passCriteria = {
  min_score: minScore,
  required_validators: selectedValidators.length > 0 ? selectedValidators : undefined,
  custom_rules: customRules || undefined,  // From Phase 2.2
};
```

**Verification Steps:**
1. Select validators, create benchmark, verify POST payload includes `required_validators`
2. Check Supabase `benchmarks` table shows validators in `pass_criteria` JSONB column
3. Test with 0, 1, and multiple validators selected

---

### 2.2 Add Custom Rules JSON Editor (Advanced)

**File:** `components/training/BenchmarkManager.tsx`

**Location:** Below validator multi-select, collapsible/accordion for advanced users

**New State:**
```typescript
const [customRules, setCustomRules] = useState<string>(''); // JSON string
const [customRulesError, setCustomRulesError] = useState<string>('');
```

**UI Component:**
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Custom Rules (Optional, Advanced)
  </label>
  <p className="text-xs text-gray-500">
    JSON object with validator-specific configuration. Example: {`{"max_response_length": 500}`}
  </p>
  <textarea
    value={customRules}
    onChange={(e) => {
      setCustomRules(e.target.value);
      // Real-time validation
      if (e.target.value.trim()) {
        try {
          JSON.parse(e.target.value);
          setCustomRulesError('');
        } catch {
          setCustomRulesError('Invalid JSON format');
        }
      } else {
        setCustomRulesError('');
      }
    }}
    className="w-full h-24 px-3 py-2 border rounded-md font-mono text-sm"
    placeholder='{"example_rule": "value"}'
  />
  {customRulesError && (
    <p className="text-xs text-red-600">{customRulesError}</p>
  )}
</div>
```

**Form Submission Validation:**
```typescript
// In handleCreate, validate before POST:
let parsedCustomRules;
if (customRules.trim()) {
  try {
    parsedCustomRules = JSON.parse(customRules);
  } catch {
    setError('Invalid custom rules JSON');
    return;
  }
}

const passCriteria = {
  min_score: minScore,
  required_validators: selectedValidators.length > 0 ? selectedValidators : undefined,
  custom_rules: parsedCustomRules,
};
```

**Enhancement (Optional):** Use a proper JSON editor library (e.g., `react-json-editor-ajrm`) for syntax highlighting and better UX.

**Verification Steps:**
1. Enter invalid JSON → see error message
2. Enter valid JSON → error clears
3. Submit with custom_rules → verify persists to database
4. Leave empty → verify field is undefined/null, not empty object

---

### 2.3 Display Validators in Benchmark List

**File:** `components/training/BenchmarkManager.tsx`

**Location:** In the benchmark list rendering, add a chip/badge list showing validators

**Implementation:**
```tsx
{/* Inside benchmark list item */}
{benchmark.pass_criteria.required_validators && 
 benchmark.pass_criteria.required_validators.length > 0 && (
  <div className="flex gap-1 flex-wrap mt-2">
    {benchmark.pass_criteria.required_validators.map(validatorId => {
      const validator = AVAILABLE_VALIDATORS.find(v => v.id === validatorId);
      return (
        <span
          key={validatorId}
          className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
          title={validator?.description}
        >
          {validator?.name || validatorId}
        </span>
      );
    })}
  </div>
)}
```

**Styling:** Use consistent badge colors (blue for validators, green for task_type, etc.)

**Verification Steps:**
1. Create benchmark with validators → see badges in list
2. Hover over badge → see tooltip with description (if implemented)
3. Create benchmark without validators → no badges shown

---

## Phase 3: Edit Functionality (High Value Feature)

**Priority:** High  
**Estimated Effort:** 3-4 hours  
**Dependencies:** Phase 1.2 (PATCH endpoint)

### 3.1 Implement Edit Mode in BenchmarkManager

**File:** `components/training/BenchmarkManager.tsx`

**Current State:** `editingId` state exists but not used; no edit UI.

**State Updates:**
```typescript
const [editingBenchmark, setEditingBenchmark] = useState<Benchmark | null>(null);
```

**Edit Button in List:**
```tsx
{/* Add to each benchmark list item */}
<button
  onClick={() => setEditingBenchmark(benchmark)}
  className="text-sm text-blue-600 hover:text-blue-800"
>
  Edit
</button>
```

**Edit Form (Modal or Inline Expansion):**

**Option A - Modal (Recommended):**
```tsx
{editingBenchmark && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4">Edit Benchmark</h3>
      
      {/* Reuse same form fields as create */}
      <form onSubmit={handleUpdate}>
        {/* Name, description, task_type, min_score, validators, custom_rules */}
        
        <div className="flex gap-2 mt-4">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => setEditingBenchmark(null)}
            className="px-4 py-2 border rounded-md"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

**Option B - Inline Expansion:**
- Replace list item with expanded form when editing
- Less intrusive but takes more vertical space

**Update Handler:**
```typescript
const handleUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    const response = await fetch(`/api/benchmarks/${editingBenchmark.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description,
        task_type: editForm.taskType,
        pass_criteria: {
          min_score: editForm.minScore,
          required_validators: editForm.selectedValidators,
          custom_rules: editForm.customRules,
        },
        is_public: editForm.isPublic,
      }),
    });
    
    if (!response.ok) throw new Error('Update failed');
    
    // Refresh benchmark list
    fetchBenchmarks();
    setEditingBenchmark(null);
    
  } catch (error) {
    console.error('Update error:', error);
    setError('Failed to update benchmark');
  }
};
```

**Pre-populate Form:**
```typescript
useEffect(() => {
  if (editingBenchmark) {
    // Set form state from editingBenchmark values
    setEditFormName(editingBenchmark.name);
    setEditFormDescription(editingBenchmark.description || '');
    setEditFormTaskType(editingBenchmark.task_type);
    setEditFormMinScore(editingBenchmark.pass_criteria.min_score);
    setEditFormValidators(editingBenchmark.pass_criteria.required_validators || []);
    setEditFormCustomRules(
      editingBenchmark.pass_criteria.custom_rules 
        ? JSON.stringify(editingBenchmark.pass_criteria.custom_rules, null, 2)
        : ''
    );
    setEditFormIsPublic(editingBenchmark.is_public);
  }
}, [editingBenchmark]);
```

**Verification Steps:**
1. Click edit → form pre-populates with existing values
2. Modify validators → save → verify database update
3. Cancel → no changes persisted
4. Edit benchmark created by another user → verify ownership check rejects (403)

---

### 3.2 Add Delete Functionality (Optional)

**Implementation:** Similar to edit, add delete button with confirmation dialog.

```typescript
const handleDelete = async (benchmarkId: string) => {
  if (!confirm('Delete this benchmark? This cannot be undone.')) return;
  
  try {
    const response = await fetch(`/api/benchmarks/${benchmarkId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    
    if (!response.ok) throw new Error('Delete failed');
    
    fetchBenchmarks(); // Refresh list
  } catch (error) {
    console.error('Delete error:', error);
    setError('Failed to delete benchmark');
  }
};
```

**Considerations:**
- Soft delete vs hard delete
- Check if benchmark is used in any batch test runs before deleting
- Archive option instead of delete

---

## Phase 4: Batch Testing Integration Enhancements (Polish)

**Priority:** Medium  
**Estimated Effort:** 2-3 hours  
**Dependencies:** Phases 1-3 complete

### 4.1 Show Validator Details in Batch Test Run Results

**File:** `components/training/BatchTesting.tsx` or new detail view component

**Current State:** Batch test runs show pass/fail but not which validators ran.

**Enhancement:** Add collapsible section in run details showing:
- Which validators were executed (from benchmark.pass_criteria.required_validators)
- Individual validator pass/fail counts
- Aggregated validator statistics

**Implementation:**
```tsx
{/* In batch test run detail view */}
{run.benchmark_id && (
  <div className="mt-4">
    <h4 className="text-sm font-medium mb-2">Benchmark Validators</h4>
    <div className="space-y-1">
      {benchmarkValidatorResults.map(result => (
        <div key={result.validator_id} className="flex items-center justify-between text-sm">
          <span>{result.validator_name}</span>
          <span className={result.pass_rate >= 0.8 ? 'text-green-600' : 'text-red-600'}>
            {result.passed}/{result.total} ({(result.pass_rate * 100).toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  </div>
)}
```

**Data Source:** Query `judgments` table aggregated by `judge_name` for the batch test run's messages.

**SQL Query Example:**
```sql
SELECT 
  judge_name,
  COUNT(*) as total,
  SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
  AVG(score) as avg_score
FROM judgments
WHERE message_id IN (SELECT id FROM messages WHERE batch_test_run_id = $1)
  AND judge_type = 'rule'
GROUP BY judge_name;
```

**Verification Steps:**
1. Run batch test with benchmark containing validators
2. View run details → see validator breakdown
3. Verify counts match actual judgment records in database

---

### 4.2 Benchmark Preview in Selection Dropdown

**File:** `components/training/BatchTesting.tsx`

**Current State:** Benchmark dropdown shows only name.

**Enhancement:** Show validator count, task type, min score in dropdown options.

```tsx
<Select
  value={selectedBenchmarkId}
  onValueChange={setSelectedBenchmarkId}
>
  <SelectTrigger>
    <SelectValue placeholder="Select benchmark (optional)" />
  </SelectTrigger>
  <SelectContent>
    {benchmarks.map(benchmark => (
      <SelectItem key={benchmark.id} value={benchmark.id}>
        <div className="flex flex-col">
          <span className="font-medium">{benchmark.name}</span>
          <span className="text-xs text-gray-500">
            {benchmark.task_type} • Min Score: {benchmark.pass_criteria.min_score}
            {benchmark.pass_criteria.required_validators?.length > 0 && (
              <> • {benchmark.pass_criteria.required_validators.length} validators</>
            )}
          </span>
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Verification Steps:**
1. Open benchmark dropdown → see detailed info per option
2. Verify layout doesn't overflow or break

---

## Phase 5: Testing & Documentation (Critical for Production)

**Priority:** High  
**Estimated Effort:** 3-4 hours  
**Dependencies:** All previous phases

### 5.1 Unit Tests

**New Test Files:**

**`__tests__/api/benchmarks/route.test.ts`**
- Test POST creates benchmark with validators
- Test GET returns correct response shape (`benchmarks` property)
- Test PATCH updates validators
- Test ownership validation (can't edit other user's benchmarks)

**`__tests__/components/BenchmarkManager.test.tsx`**
- Test create form with validator selection
- Test custom rules JSON validation
- Test edit mode pre-populates correctly
- Test validator badges render

**Coverage Goals:**
- API routes: >80%
- UI components: >70% (focus on logic, not styling)

---

### 5.2 Integration Tests

**File:** `tests/integration/benchmark-workflow.e2e.test.ts`

**Test Scenarios:**
1. Create benchmark with validators → verify in database
2. Edit benchmark validators → verify update persists
3. Run batch test with benchmark → verify validators execute
4. Check batch test results show validator breakdown

**Tools:** Playwright or Cypress for E2E tests

---

### 5.3 Documentation Updates

**Files to Update:**

**`README.md` (if exists in web-ui):**
- Add Benchmark Configuration section
- Document available validators
- Show example custom_rules JSON

**`lib/benchmarks/README.md` (new file):**
```markdown
# Benchmark System

## Overview
Custom benchmarks allow defining pass criteria with validators and custom rules.

## Available Validators

### must_cite_if_claims
Ensures responses cite sources when making factual claims.

### format_ok
Validates response follows expected format.

## Custom Rules
JSON object for validator-specific config:
- `max_response_length`: Number (optional)
- `required_sections`: Array of strings (optional)

## API Endpoints
- POST /api/benchmarks - Create
- GET /api/benchmarks - List
- PATCH /api/benchmarks/[id] - Update
- DELETE /api/benchmarks/[id] - Delete
```

**Inline Code Comments:**
- Add JSDoc to validator functions
- Document custom_rules schema in types.ts

---

### 5.4 Migration/Rollout Plan

**Database Migrations:** 
- None required (JSONB columns already support validators/custom_rules)
- Verify existing benchmarks don't break (null validators is valid)

**Feature Flag (Optional):**
```typescript
// In environment or config
const ENABLE_BENCHMARK_VALIDATORS = process.env.NEXT_PUBLIC_FEATURE_VALIDATORS === 'true';

// In UI
{ENABLE_BENCHMARK_VALIDATORS && (
  <ValidatorSelection ... />
)}
```

**Rollout Steps:**
1. Deploy API changes (Phase 1) first
2. Test in staging with existing benchmarks
3. Deploy UI changes (Phases 2-3)
4. Monitor Sentry/logs for validator errors
5. Announce feature to users with guide

---

## Phase 6: Future Enhancements (Backlog)

**Priority:** Low  
**Estimated Effort:** TBD

### 6.1 Additional Validators

**Candidates from code comments in validator-orchestrator.ts:**
- `citation_exists` - Verify citations are valid
- `retrieval_relevance_at_k` - Check retrieved docs are relevant
- `policy_scope_allowed` - Validate responses stay within policy bounds
- `freshness_ok` - Ensure data is up-to-date

**Each requires:**
- Implementation in `lib/evaluation/validators/rule-validators.ts`
- Add to `VALIDATOR_MAP`
- Update UI metadata constant
- Write tests

---

### 6.2 LLM-as-Judge Integration

**Concept:** Allow benchmarks to specify LLM judges (e.g., "Use GPT-4 to rate helpfulness 1-5")

**Implementation:**
- Add `llm_judges` array to `pass_criteria`
- Each judge has: model, prompt template, scoring rubric
- Execute during batch testing alongside rule validators
- Save results to `judgments` table with `judge_type='llm'`

**Complexity:** Medium-high (needs prompt engineering, cost tracking)

---

### 6.3 Benchmark Templates/Gallery

**Concept:** Pre-built benchmarks for common tasks (e.g., "Customer Support Quality", "Code Generation Accuracy")

**Implementation:**
- Add `is_template` flag to benchmarks table
- Seed database with curated templates
- UI shows "Start from template" option
- Clone template and allow customization

**Benefit:** Faster onboarding for new users

---

### 6.4 Benchmark Versioning

**Problem:** Editing a benchmark after batch tests have run makes results incomparable.

**Solution:**
- Snapshot benchmark config with each batch test run
- Allow viewing historical benchmark versions
- Warn when editing a benchmark with existing results

**Implementation:** Store `benchmark_snapshot` JSONB in `batch_test_runs` table.

---

## Risk Assessment & Mitigation

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing benchmarks | High | Test thoroughly with null validators; ensure backward compat |
| Validator execution errors | Medium | Wrap each validator in try-catch; log errors, don't fail entire run |
| Custom rules schema drift | Medium | Validate custom_rules structure; version schema if needed |
| Performance (many validators) | Low | Validators are lightweight; batch in parallel if needed |

### UX Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Overwhelming advanced users | Medium | Make custom rules collapsible; provide good defaults |
| Confusing validator descriptions | Low | User test descriptions; iterate based on feedback |
| Edit/create form too long | Low | Use tabs or accordion for advanced options |

---

## Success Metrics

### Quantitative
- **Adoption:** >50% of new benchmarks use at least one validator within 2 weeks
- **Reliability:** <5% validator execution error rate
- **Performance:** Validator overhead <10% of total batch test runtime

### Qualitative
- User feedback: "Validators make benchmarks more useful"
- Support tickets: <3 related to validator confusion in first month
- Internal team: Positive feedback from QA/testing team

---

## Rollback Plan

If critical issues arise post-deployment:

1. **API Rollback:**
   - Revert API routes to previous version
   - Existing benchmarks without validators continue working
   - New benchmarks temporarily can't set validators

2. **UI Rollback:**
   - Hide validator UI via feature flag
   - Keep API changes (backward compatible)
   - Users can still create basic benchmarks

3. **Data Integrity:**
   - Validators in existing benchmarks remain in DB (no data loss)
   - Can be re-enabled when fix is ready

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Standardize /api/benchmarks response shape
- [ ] Update BenchmarkManager.tsx to use unified shape
- [ ] Update BatchTesting.tsx to use unified shape
- [ ] Create /api/benchmarks/[id]/route.ts (PATCH, DELETE)
- [ ] Test PATCH endpoint with Postman
- [ ] Create /api/benchmarks/validators/route.ts (optional)
- [ ] Verify ownership checks work

### Phase 2: Validator Selection
- [ ] Define AVAILABLE_VALIDATORS constant
- [ ] Add validator multi-select to create form
- [ ] Add custom rules JSON editor
- [ ] Add real-time JSON validation
- [ ] Update form submission to include validators/rules
- [ ] Add validator badges to benchmark list
- [ ] Test creating benchmarks with 0, 1, multiple validators

### Phase 3: Edit Functionality
- [ ] Add edit button to benchmark list
- [ ] Implement edit modal/form
- [ ] Pre-populate form from existing benchmark
- [ ] Create handleUpdate function
- [ ] Test editing validators
- [ ] Test ownership validation
- [ ] Add delete functionality (optional)

### Phase 4: Batch Testing Integration
- [ ] Add validator results breakdown to run details
- [ ] Query judgments table for validator stats
- [ ] Enhance benchmark dropdown with preview info
- [ ] Test end-to-end: create benchmark → run batch test → view validator results

### Phase 5: Testing & Docs
- [ ] Write API route tests
- [ ] Write component tests
- [ ] Write E2E tests
- [ ] Update README
- [ ] Create lib/benchmarks/README.md
- [ ] Add JSDoc comments
- [ ] Test migration with existing data
- [ ] Plan rollout (staging → production)

### Phase 6: Future Enhancements (Backlog)
- [ ] Implement additional validators
- [ ] Design LLM-as-judge feature
- [ ] Create benchmark templates
- [ ] Add benchmark versioning

---

## Timeline Estimate

| Phase | Duration | Parallel? |
|-------|----------|-----------|
| Phase 1: API Alignment | 2-3 hours | No (foundation) |
| Phase 2: Validator Selection | 4-5 hours | After Phase 1 |
| Phase 3: Edit Functionality | 3-4 hours | After Phase 1 |
| Phase 4: Batch Testing Integration | 2-3 hours | After Phase 2 |
| Phase 5: Testing & Docs | 3-4 hours | Parallel with Phase 4 |
| **Total Critical Path** | **14-19 hours** | ~2-3 dev days |

**Phases 2 and 3 can partially overlap** if different developers work on them.

---

## Next Steps (Immediate Actions)

1. **Review & Approve Plan:** Stakeholder review (1 hour)
2. **Set Up Feature Branch:** `feature/benchmark-validators` (if not using current branch)
3. **Start Phase 1:** API alignment (highest impact, enables everything else)
4. **Daily Standups:** Quick check-ins to unblock issues
5. **Code Reviews:** Each phase gets reviewed before merging

---

## Questions to Resolve Before Starting

1. **Validator Metadata:** Fetch from endpoint or hardcode in frontend?
   - **Recommendation:** Hardcode initially (simpler); add endpoint in Phase 6 if validator list grows.

2. **Edit UI:** Modal vs inline?
   - **Recommendation:** Modal (cleaner, reusable form component).

3. **Delete:** Soft delete or hard delete?
   - **Recommendation:** Soft delete (add `deleted_at` column) for safety.

4. **Custom Rules Schema:** Document expected structure?
   - **Recommendation:** Yes, add JSON schema validation in Phase 2.2.

5. **Feature Flag:** Enable for all users or gradual rollout?
   - **Recommendation:** Gradual (internal team → beta users → all).

---

**Plan Status:** Ready for Implementation  
**Last Updated:** October 26, 2025  
**Owner:** Development Team  
**Stakeholders:** Product, QA, DevOps
