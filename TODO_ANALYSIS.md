# TODO Analysis: Critical Features for Fine Tune Lab

## Summary
Two incomplete features identified that would enhance Fine Tune Lab functionality:

1. **Runtime Parameter Updates** - UI exists, database persistence works, but training process doesn't apply changes
2. **Analytics Model Configuration** - Hardcoded to GPT-4o, should be user-configurable

---

## 1. Runtime Parameter Updates

### Current Status: ⚠️ **Partially Implemented**

### What It Does
Allows users to modify training hyperparameters (learning rate, batch size, etc.) while training is actively running, without stopping/restarting the job.

### What's Working ✅
1. **UI Component**: `RuntimeParameterControls.tsx` - Full interface for adjusting parameters
2. **API Endpoint**: `/api/training/local/[jobId]/update-params` - Records updates in database
3. **Database**: `parameter_updates` array and `last_parameter_update_at` timestamp in `local_training_jobs` table
4. **Validation**: Checks job is running, user owns job, at least one parameter changed

### What's Missing ❌
**Backend Application**: The Python training process (`standalone_trainer.py`) doesn't check for or apply parameter updates

### Technical Requirements

#### Option 1: Polling Approach (Simpler)
```python
# In standalone_trainer.py training loop:
def check_for_parameter_updates(job_id):
    """Poll database for parameter updates"""
    response = supabase.table('local_training_jobs')\
        .select('parameter_updates, last_parameter_update_at')\
        .eq('id', job_id)\
        .single()\
        .execute()
    
    if response.data and response.data['parameter_updates']:
        latest_update = response.data['parameter_updates'][-1]
        # Check if not already applied
        if latest_update['requested_at'] > self.last_applied_update:
            return latest_update
    return None

# In training loop (every N steps):
if self.current_step % 10 == 0:  # Check every 10 steps
    updates = check_for_parameter_updates(self.job_id)
    if updates:
        if 'learning_rate' in updates:
            for param_group in self.optimizer.param_groups:
                param_group['lr'] = updates['learning_rate']
        if 'batch_size' in updates:
            self.batch_size = updates['batch_size']
            # Recreate dataloader with new batch size
        # Mark as applied
        self.last_applied_update = updates['requested_at']
```

#### Option 2: File-Based Communication (More Efficient)
```python
# Frontend writes to: logs/job_{id}/parameter_updates.json
# Backend reads file in training loop
parameter_file = f"{output_dir}/parameter_updates.json"
if os.path.exists(parameter_file):
    with open(parameter_file) as f:
        updates = json.load(f)
    apply_updates(updates)
    os.remove(parameter_file)  # Mark as applied
```

### Implementation Steps
1. Add `check_parameter_updates()` method to `ToolTrainer` class
2. Call it periodically in training loop (every 10-50 steps)
3. Implement parameter application logic for each supported param
4. Add logging: "Applied parameter update: learning_rate 1e-4 → 5e-5"
5. Update API endpoint to write to file or add WebSocket notification
6. Test with running training job

### Constraints & Considerations
- **Batch Size**: Requires recreating DataLoader - expensive operation
- **Gradient Accumulation**: Can change immediately
- **Learning Rate**: Trivial to change via optimizer.param_groups
- **Warmup Steps**: Only affects scheduler, may require reinit
- **Validation**: Ensure new values are valid (positive, within reasonable ranges)
- **Atomicity**: Ensure partial updates don't break training

### Priority: **MEDIUM**
- Nice-to-have for advanced users
- Current workaround: Stop training, adjust config, restart
- Most useful for long-running training jobs (hours/days)

---

## 2. Analytics Model Configuration

### Current Status: ⚠️ **Hardcoded**

### What It Does
The Analytics Chat feature uses an LLM to help users analyze their chat sessions (costs, quality, tool usage, etc.) with natural language queries.

### What's Working ✅
1. **Analytics Tools**: 7 specialized tools for querying session data
2. **System Prompt**: Comprehensive guidance for analytics assistant
3. **UnifiedLLMClient Integration**: Works with any model in registry
4. **Streaming Responses**: Real-time chat experience

### What's Missing ❌
**User Configuration**: Model is hardcoded to `gpt-4o` (line 659)

```typescript
// Current code:
const analyticsModelId = 'gpt-4o'; // TODO: Make this configurable
```

### Why This Matters
1. **Cost**: GPT-4o is expensive (~$5/1M input tokens, $15/1M output)
2. **Choice**: Users may prefer GPT-4o-mini (cheaper), Claude, or local models
3. **Availability**: Some users may not have OpenAI API access
4. **Flexibility**: Different models have different strengths

### Implementation Options

#### Option A: User Preferences Table (Best)
```typescript
// 1. Add to user_preferences table
interface UserPreferences {
  analytics_model_id?: string;
  analytics_temperature?: number;
  analytics_max_tokens?: number;
}

// 2. In route handler:
const { data: prefs } = await supabase
  .from('user_preferences')
  .select('analytics_model_id')
  .eq('user_id', user.id)
  .single();

const analyticsModelId = prefs?.analytics_model_id || 'gpt-4o'; // Fallback to default
```

#### Option B: Per-Session Selection (Simpler)
```typescript
// Accept model_id in request body
const body = await request.json();
const analyticsModelId = body.model_id || 'gpt-4o';

// Validate model exists in registry
const modelExists = await unifiedLLMClient.isModelAvailable(analyticsModelId);
if (!analyticsModelId) {
  return NextResponse.json({ error: 'Invalid model' }, { status: 400 });
}
```

#### Option C: Environment Variable (Quickest)
```typescript
// .env.local
ANALYTICS_DEFAULT_MODEL=gpt-4o-mini

// In code:
const analyticsModelId = process.env.ANALYTICS_DEFAULT_MODEL || 'gpt-4o';
```

### Recommended Approach: **Option B + Option C**
1. Use env var for system default
2. Allow per-request override via API
3. Later add to user preferences for persistence

### Implementation Steps
1. Add `ANALYTICS_DEFAULT_MODEL` to `.env.local`
2. Update route to accept optional `model_id` in request
3. Add model validation using `unifiedLLMClient.listModels()`
4. Update UI to show model selector (dropdown with available models)
5. Add cost estimate tooltip (show relative cost vs default)
6. Test with different models (GPT-4o-mini, Claude Sonnet, etc.)

### UI Changes Needed
```typescript
// In Analytics Chat interface:
<Select value={selectedModel} onValueChange={setSelectedModel}>
  <SelectTrigger>
    <SelectValue placeholder="Select model" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="gpt-4o">GPT-4o (Smartest, $$$$)</SelectItem>
    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast, $)</SelectItem>
    <SelectItem value="claude-3-5-sonnet-20241022">Claude Sonnet (Balanced, $$$)</SelectItem>
    <SelectItem value="grok-beta">Grok (Fast, $)</SelectItem>
  </SelectContent>
</Select>
```

### Priority: **LOW-MEDIUM**
- Currently works fine with GPT-4o
- Low effort to implement (Option B+C)
- Nice QoL improvement for cost-conscious users

---

## Comparison & Recommendations

| Feature | Complexity | Impact | Priority | Est. Time |
|---------|------------|--------|----------|-----------|
| Runtime Params | High | Medium | Medium | 4-6 hours |
| Analytics Model | Low | Low-Med | Low-Med | 1-2 hours |

### Recommended Order
1. **Analytics Model Config** (Quick win, low risk)
   - Implement Option B + C
   - Add UI dropdown
   - Test with 2-3 models
   
2. **Runtime Parameter Updates** (Higher value, more complex)
   - Start with Option 1 (polling)
   - Support learning_rate only initially
   - Expand to other params after testing

### Alternative: Mark as "Future Enhancement"
Both features are **nice-to-have**, not blockers. Current workarounds exist:
- **Runtime Params**: Stop → adjust → restart training
- **Analytics Model**: Use GPT-4o (works well, just costs more)

If prioritizing other features, document these in a "Roadmap" or "Future Enhancements" section.

---

## Next Steps

1. **Decide Priority**: Are these blocking other work or can they wait?
2. **Analytics Model**: Quick fix - add env var + request param support
3. **Runtime Params**: Requires design decision on communication approach
4. **Documentation**: Update feature docs to indicate current limitations
5. **User Feedback**: Ask users if they want these features

Let me know which you'd like to implement first!
