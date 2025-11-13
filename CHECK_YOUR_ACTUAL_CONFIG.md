# How to Check Your Actual Training Config

## The Config Flow is CORRECT

I traced the entire flow - your config IS being sent from UI → API → Training Server:

1. **UI:** You select a config in TrainingWorkflow
2. **API:** `/api/training/execute` reads `config.config_json` from database (line 569)
3. **API:** Passes it to training server (line 713)
4. **Training Server:** standalone_trainer.py reads the config values

**The flow is working correctly.**

---

## The Real Issue

Your **saved config in the database** has the slow values. When you created "SFT Toolbench" config in the UI, it saved those values to the database.

Even though you later:
- Updated the template file
- Created new optimized config files

...your OLD config in the database **still has the old slow values**.

---

## How to Verify What's Actually in Your Config

### Option 1: Check via UI (Easiest)

1. Go to Training page
2. Click "Edit" on your "SFT Toolbench" config
3. Look at these fields:
   - **Batch Size:** Is it 4 or 6?
   - **Load in 4bit:** Is it checked?
   - **Gradient Checkpointing:** Is it checked?
   - **Dataloader Workers:** What's the value?

### Option 2: Check Database Directly

Run this SQL query in Supabase SQL Editor:

```sql
SELECT
  name,
  config_json->'training'->>'batch_size' as batch_size,
  config_json->'training'->>'gradient_checkpointing' as gradient_checkpointing,
  config_json->'training'->'quantization'->>'load_in_4bit' as load_in_4bit,
  config_json->'training'->>'dataloader_num_workers' as dataloader_workers
FROM training_configs
WHERE name LIKE '%toolbench%' OR name LIKE '%SFT%'
ORDER BY created_at DESC
LIMIT 5;
```

This will show you the ACTUAL values in your saved configs.

---

## The Solution

You have 3 options:

### Option A: Edit Existing Config in UI (Recommended)

1. Open Training page
2. Find your "SFT Toolbench" config
3. Click "Edit"
4. Change these values:
   - Batch Size: 6 → 16
   - Gradient Accumulation: 4 → 2
   - Load in 4bit: ✅ → ❌ (uncheck it)
   - Dataloader Workers: 0 or 4 → 8
5. Save
6. Start NEW training with this updated config

### Option B: Create New Config from Optimized File

1. Use the `training_config_rtx3090_optimized.json` I created
2. Import it somehow (or create via UI matching those values)
3. Start training with the new config

### Option C: Delete and Recreate

1. Delete the old "SFT Toolbench" config
2. Create new one from template
3. Edit it with optimal values
4. Start training

---

## Why You Keep Getting 0.03 samples/sec

**You're using the SAME old config every time!**

Even though:
- ✅ The templates were updated
- ✅ New config files were created
- ✅ The code flow is correct

Your **database** still has that old config with:
- ❌ `batch_size: 6` (too small)
- ❌ `load_in_4bit: true` (slow for RTX 3090)
- ❌ `dataloader_num_workers: 0 or 4` (could be higher)

---

## Test This Theory

1. Check your config in the UI (Option 1 above)
2. If `load_in_4bit` is checked → That's your problem
3. Uncheck it and change batch_size to 16
4. Save and start new training
5. Speed should jump to 2-4 samples/sec

---

## Summary

**The Issue:** Your saved config in database has slow values
**The Fix:** Edit that config in the UI to use better values
**The Flow:** UI → Database → API → Training Server (all working correctly)

The templates being different from your config is NORMAL - templates are starting points. Your config is what you saved after creating it from the template.

Check your config values in the UI right now!
