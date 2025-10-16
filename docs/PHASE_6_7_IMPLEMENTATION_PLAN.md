# Phase 6 & 7 Implementation Plan
**Date:** October 14, 2025
**Purpose:** Detailed step-by-step plan for UI enhancements and GraphRAG sync

---

## Phase 6: UI Enhancements (EvaluationModal)

### Overview
Add citation validation UI and groundedness slider to EvaluationModal for human-in-the-loop evaluation.

### Files to Modify
1. **`components/evaluation/EvaluationModal.tsx`** (existing file)

### Pre-Implementation Checks
- [ ] Read current EvaluationModal.tsx structure
- [ ] Verify existing state variables and their types
- [ ] Find exact line numbers for insertions
- [ ] Check if supabase import exists
- [ ] Verify form submission handler location

### Implementation Steps

#### Step 1: Add State Variables
**Location:** After existing useState declarations (around line 30)

**Additions needed:**
```typescript
const [citationCorrectness, setCitationCorrectness] = useState<Record<string, boolean>>({});
const [groundedness, setGroundedness] = useState<number>(50);
const [message, setMessage] = useState<any>(null);
```

**Verification:**
- Ensure no duplicate state variable names
- Check TypeScript compilation after adding

#### Step 2: Fetch Message with Citations
**Location:** Inside useEffect (around line 35-40)

**Addition needed:**
```typescript
// Fetch message with content_json for citation validation
supabase
  .from('messages')
  .select('id, content, content_json')
  .eq('id', messageId)
  .single()
  .then(({ data }) => {
    if (data) setMessage(data);
  });
```

**Verification:**
- Ensure supabase is imported
- Check that messageId is available in scope
- Verify no conflicts with existing queries

#### Step 3: Add Citation Validation UI
**Location:** After failure tags section (around line 196)

**Addition needed:**
```typescript
{/* Citation Validation */}
{message?.content_json?.citations && (
  <div className="space-y-2">
    <label className="block text-sm font-medium">Citation Correctness</label>
    <p className="text-sm text-muted-foreground mb-2">
      Verify that each citation accurately supports the answer
    </p>
    {message.content_json.citations.map((citation: any, index: number) => (
      <div key={index} className="flex items-center space-x-3 p-2 border rounded">
        <input
          type="checkbox"
          checked={citationCorrectness[citation.doc_id] || false}
          onChange={(e) => setCitationCorrectness({
            ...citationCorrectness,
            [citation.doc_id]: e.target.checked
          })}
        />
        <div className="flex-1">
          <p className="text-sm font-mono">{citation.doc_id}</p>
          {citation.quote && (
            <p className="text-xs text-muted-foreground">"{citation.quote}"</p>
          )}
        </div>
      </div>
    ))}
  </div>
)}
```

**Verification:**
- Check JSX syntax is valid
- Ensure className styles exist in project
- Test with TypeScript compilation

#### Step 4: Add Groundedness Slider
**Location:** After citation validation section

**Addition needed:**
```typescript
{/* Groundedness Slider */}
<div className="space-y-2">
  <label className="block text-sm font-medium">
    Groundedness (0-100%)
  </label>
  <p className="text-sm text-muted-foreground mb-2">
    How well is the answer grounded in the retrieved documents?
  </p>
  <input
    type="range"
    min="0"
    max="100"
    value={groundedness}
    onChange={(e) => setGroundedness(parseInt(e.target.value))}
    className="w-full"
  />
  <div className="text-center text-sm font-semibold">{groundedness}%</div>
</div>
```

**Verification:**
- Test slider functionality
- Verify value display updates correctly

#### Step 5: Update Form Submission
**Location:** In handleSubmit function (around line 50-80)

**Addition needed:**
```typescript
// Save groundedness as human judgment
if (groundedness !== 50) { // Only if user changed it
  await judgmentsService.saveHumanJudgment(
    messageId,
    'groundedness',
    groundedness / 100, // Convert to 0-1 scale
    groundedness >= 70, // Pass if >= 70%
    `Human-rated groundedness: ${groundedness}%`
  );
}

// Save citation correctness
const correctCitations = Object.keys(citationCorrectness).filter(
  docId => citationCorrectness[docId]
).length;
const totalCitations = Object.keys(citationCorrectness).length;

if (totalCitations > 0) {
  await judgmentsService.saveHumanJudgment(
    messageId,
    'citation_correctness',
    correctCitations / totalCitations,
    correctCitations === totalCitations,
    `${correctCitations}/${totalCitations} citations verified`
  );
}
```

**Verification:**
- Check judgmentsService is imported
- Verify messageId is in scope
- Test form submission doesn't break

### Phase 6 Verification Checklist
- [ ] TypeScript compilation passes
- [ ] No console errors in browser
- [ ] State updates correctly
- [ ] Form submission works
- [ ] Data saves to database

---

## Phase 7: GraphRAG Sync Service

### Overview
Create service to sync evaluation data to Neo4j knowledge graph for relationship analysis.

### Files to Create
1. **`lib/graphrag/sync.service.ts`** (new file, ~250 lines)

### Files to Verify
- [ ] Check if `lib/graphrag/client.ts` or similar exists
- [ ] Verify Neo4j connection is available
- [ ] Check if graphiti integration exists

### Implementation Steps

#### Step 1: Read Existing GraphRAG Structure
**Actions:**
- Read `lib/graphrag/` directory structure
- Find existing client/connection files
- Verify Neo4j integration pattern

**Verification:**
- Ensure we understand existing architecture
- Identify connection method (graphiti client, direct Neo4j, etc.)

#### Step 2: Create Sync Service Interface
**File:** `lib/graphrag/sync.service.ts`

**Structure:**
```typescript
// GraphRAG Sync Service
// Purpose: Sync evaluation data to Neo4j knowledge graph

export interface GraphSyncEvent {
  type: 'citation' | 'judgment' | 'error';
  messageId: string;
  data: any;
  idempotencyKey: string;
}

export class GraphSyncService {
  private processedKeys = new Set<string>();

  // Core methods to implement
  emitEvent(event: GraphSyncEvent): void
  private async processEventAsync(event: GraphSyncEvent): Promise<void>
  private async syncCitation(event: GraphSyncEvent): Promise<void>
  private async syncJudgment(event: GraphSyncEvent): Promise<void>
  private async syncError(event: GraphSyncEvent): Promise<void>
}
```

**Verification:**
- Check TypeScript types
- Verify interface matches needs

#### Step 3: Implement Event Emission
**30-line block:**
```typescript
emitEvent(event: GraphSyncEvent): void {
  // Check idempotency
  if (this.processedKeys.has(event.idempotencyKey)) {
    console.log(`[GraphSync] Skipping duplicate: ${event.idempotencyKey}`);
    return;
  }

  // Mark as processed
  this.processedKeys.add(event.idempotencyKey);

  // Queue for async processing (don't block)
  this.processEventAsync(event).catch(error => {
    console.error('[GraphSync] Error:', error);
  });
}
```

**Verification:**
- Test idempotency works
- Verify async processing doesn't block

#### Step 4: Implement Event Processing
**30-line block:**
```typescript
private async processEventAsync(event: GraphSyncEvent): Promise<void> {
  console.log(`[GraphSync] Processing ${event.type} for ${event.messageId}`);

  switch (event.type) {
    case 'citation':
      await this.syncCitation(event);
      break;
    case 'judgment':
      await this.syncJudgment(event);
      break;
    case 'error':
      await this.syncError(event);
      break;
  }
}
```

**Verification:**
- Test switch statement works
- Verify logging is correct

#### Step 5: Implement Citation Sync (Placeholder)
**30-line block:**
```typescript
private async syncCitation(event: GraphSyncEvent): Promise<void> {
  try {
    // TODO: Implement based on graphiti API
    // Example:
    // await graphitiClient.createEpisode({
    //   source: event.messageId,
    //   target: event.data.documentId,
    //   relationshipType: 'CITES',
    //   metadata: { confidence: event.data.confidence }
    // });

    console.log('[GraphSync] Citation synced to Neo4j:', event.data);
  } catch (error) {
    console.error('[GraphSync] Citation sync error:', error);
  }
}
```

**Verification:**
- Placeholder logs correctly
- Ready for future Neo4j integration

#### Step 6: Implement Judgment Sync (Placeholder)
**Similar structure to citation sync**

#### Step 7: Implement Error Sync (Placeholder)
**Similar structure to citation sync**

#### Step 8: Export Singleton
**Final block:**
```typescript
export const graphSyncService = new GraphSyncService();
```

**Verification:**
- Singleton pattern works
- Can import from other files

#### Step 9: Integrate with Judgments Service
**File:** `lib/evaluation/judgments.service.ts`

**Addition (optional):**
```typescript
// At top
import { graphSyncService } from '@/lib/graphrag/sync.service';

// In saveRuleJudgments method, after successful save:
graphSyncService.emitEvent({
  type: 'judgment',
  messageId,
  data: { results: validationResults },
  idempotencyKey: `judgment-${messageId}-${Date.now()}`
});
```

**Verification:**
- Import works
- Event emission doesn't break save

### Phase 7 Verification Checklist
- [ ] TypeScript compilation passes
- [ ] Service initializes correctly
- [ ] Idempotency works
- [ ] Events are queued
- [ ] Logging is clear
- [ ] No blocking operations

---

## Overall Verification

### Before Starting
- [ ] Backup current working code
- [ ] Note current TypeScript error count
- [ ] Document current file sizes

### During Implementation
- [ ] Run TypeScript check after each file change
- [ ] Test in browser after UI changes
- [ ] Verify database queries work
- [ ] Check console logs are clear

### After Completion
- [ ] Run full TypeScript compilation
- [ ] Test form submission end-to-end
- [ ] Verify data saves to database
- [ ] Check progress log is updated
- [ ] Document any issues/resolutions

---

## Success Criteria

### Phase 6 Success
- ✅ EvaluationModal displays citations from content_json
- ✅ User can toggle citation correctness
- ✅ Groundedness slider works and saves
- ✅ Human judgments save to database
- ✅ No TypeScript errors

### Phase 7 Success
- ✅ GraphSyncService created and exports
- ✅ Event emission is idempotent
- ✅ Async processing works
- ✅ Placeholder methods log correctly
- ✅ Ready for future Neo4j integration
- ✅ No TypeScript errors

---

## Estimated Time
- Phase 6: 30-45 minutes (with verification)
- Phase 7: 20-30 minutes (placeholder implementation)
- **Total: ~60-75 minutes**

---

## Notes
- Follow 30-line block pattern strictly
- Verify TypeScript after EACH change
- Test in browser after UI changes
- Update progress log after each phase
- Document any deviations from plan
