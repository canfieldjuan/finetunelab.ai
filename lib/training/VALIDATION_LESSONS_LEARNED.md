# Training Configuration Issues - Lessons Learned

## Issue Log: Problems Encountered During Testing

### Issue 1: LoRA Target Modules Mismatch
**Date:** October 27, 2025
**Job ID:** Multiple test jobs

**Problem:**
- Config specified LoRA target modules for Phi-2 model: `["q_proj", "v_proj", "k_proj", "dense"]`
- Actual model being trained: GPT-2
- GPT-2 uses different attention architecture with modules: `["c_attn", "c_proj"]`
- Training failed because specified modules don't exist in GPT-2

**Root Cause:**
- LoRA config was read from wrong section in code (`config["training"]` instead of `config["lora"]`)
- No validation to check if target modules match the model architecture
- User could easily select incompatible model + LoRA targets

**Impact:**
- Training job failed after spawning process
- Wasted time waiting for job to fail
- Confusing error message about missing modules

**Solution Implemented:**
- Created `KNOWN_LORA_TARGETS` map with correct modules per model family:
  - GPT-2: `["c_attn", "c_proj"]`
  - Llama/Mistral: `["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]`
  - Phi: `["q_proj", "v_proj", "k_proj", "dense"]`
  - Default: `["q_proj", "v_proj", "k_proj", "o_proj"]`
- Added validation function to check targets match model architecture
- Returns 400 Bad Request with clear error message

**UI Prevention Strategy:**
- Auto-populate LoRA target modules based on selected model
- Disable manual editing or show warning if user changes them
- Show visual indicator of which modules are available for selected model
- Validate on form submission before sending to server

---

### Issue 2: Chat Template on Incompatible Models
**Date:** October 27, 2025
**Job ID:** Multiple GPT-2 test jobs

**Problem:**
- Dataset had `messages` field in chat format: `[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]`
- GPT-2 model doesn't support chat templates
- Training failed with error: "GPT-2 does not have a chat template"

**Root Cause:**
- User selected `data.strategy = "chat"` for GPT-2 model
- Not all models support chat formatting (GPT-2, GPT-Neo, GPT-J don't have chat templates)
- No validation to prevent chat strategy on incompatible models

**Impact:**
- Job failed after spawning
- Dataset had to be reformatted
- Wasted time debugging template errors

**Solution Implemented:**
- Created list of models without chat support: `["gpt2", "gpt-neo", "gpt-j"]`
- Added validation to check model + strategy compatibility
- Returns 400 Bad Request suggesting to use `strategy='standard'` or choose different model

**UI Prevention Strategy:**
- Disable "chat" strategy option when GPT-2/Neo/J selected
- Show tooltip explaining why chat is disabled for these models
- Auto-switch to "standard" strategy when incompatible model selected
- Visual indicator showing which models support chat templates

---

### Issue 3: Dataset Format vs Strategy Mismatch
**Date:** October 27, 2025
**Job ID:** Dataset validation tests

**Problem:**
- User uploaded dataset with `messages` field (chat format)
- Config set to `data.strategy = "standard"` (expects `text` field)
- Mismatch between dataset structure and expected format

**Root Cause:**
- No validation of dataset content before training
- User could upload any JSON without format checking
- Strategy selection didn't verify dataset compatibility

**Impact:**
- Training would fail or produce incorrect results
- No clear error about format mismatch
- User confusion about which format to use

**Solution Implemented:**
- Added `validate_dataset_format()` function
- Checks for `messages` field vs `text` field
- Validates format matches selected strategy
- Returns clear error: "Dataset has 'messages' field but strategy is not 'chat'"

**UI Prevention Strategy:**
- Auto-detect dataset format on upload
- Show preview of first few examples
- Display detected format (chat vs standard)
- Auto-suggest correct strategy based on dataset
- Show warning if strategy doesn't match dataset format
- Offer to convert format or change strategy

---

### Issue 4: Missing Required Fields
**Date:** October 27, 2025
**Job ID:** Validation tests

**Problem:**
- Config missing `model.name` field
- Training couldn't start without knowing which model to load

**Root Cause:**
- No required field validation
- Form could be submitted with incomplete data

**Impact:**
- Immediate failure
- Unhelpful error messages

**Solution Implemented:**
- Added validation for required fields: `model.name`, `training.method`
- Returns 400 Bad Request: "model.name is required"

**UI Prevention Strategy:**
- Mark required fields with asterisk (*)
- Disable submit button until required fields filled
- Show inline validation errors
- Red border on empty required fields

---

### Issue 5: Invalid Numeric Values
**Date:** October 27, 2025
**Job ID:** Validation tests

**Problem:**
- Config could have negative epochs: `num_epochs: -1`
- Invalid learning rates, batch sizes
- No range checking

**Root Cause:**
- No numeric validation on inputs
- User could enter any value

**Impact:**
- Training fails with cryptic errors
- Wasted time debugging obvious mistakes

**Solution Implemented:**
- Added validation: `num_epochs > 0`, `batch_size > 0`, `learning_rate > 0`
- Returns 400 Bad Request with specific invalid value

**UI Prevention Strategy:**
- Use number inputs with min/max constraints
- Show recommended ranges per field
- Validate on blur/change
- Show slider for common values with safe ranges
- Warning for values outside recommended ranges

---

### Issue 6: Model Download Confusion
**Date:** October 27, 2025
**Job ID:** First Phi-2 test

**Problem:**
- Selected Phi-2 model (2.94 GB)
- Internet usage spiked but no GPU activity
- User thought training was broken

**Root Cause:**
- Model wasn't cached locally
- Download happens during training initialization
- No indication that download is happening
- User only saw "pending" status

**Impact:**
- Confusion about why GPU not being used
- Thought training was broken
- Wasted time debugging non-issue

**Solution Implemented:**
- Switched to GPT-2 for faster testing (already cached)

**UI Prevention Strategy:**
- Check if model is cached before starting training
- Show "Downloading model... X MB / Y MB" status
- Estimate download time based on model size
- Warn user if model is large and not cached
- Show cache status in model selection dropdown
- Option to pre-download models before training

---

## Summary: Key Validation Points for UI

### 1. Model Selection
- Show cached status (✓ cached, ⬇ download required)
- Display model size
- Show supported features (chat template: yes/no)
- Show compatible LoRA targets

### 2. LoRA Configuration
- Auto-populate target modules based on model
- Show which modules are available
- Validate custom targets against model architecture
- Lock fields until model selected

### 3. Data Strategy Selection
- Disable incompatible strategies based on model
- Show tooltip explaining requirements
- Auto-detect strategy from uploaded dataset
- Visual indicator of format compatibility

### 4. Dataset Upload
- Preview first 3-5 examples
- Auto-detect format (messages vs text)
- Show format validation status
- Offer format conversion
- Display dataset statistics (count, avg length)

### 5. Training Parameters
- Number inputs with min/max
- Show recommended ranges
- Validate on change
- Warning badges for unusual values
- Tooltips with explanations

### 6. Pre-submission Validation
- Run all validations before submit
- Show validation summary modal
- List all warnings/errors
- Prevent submission if critical errors
- Allow submission with warnings (show confirmation)

### 7. Real-time Feedback
- Inline validation messages
- Color-coded status (red=error, yellow=warning, green=valid)
- Progressive validation as user fills form
- Clear error messages with suggested fixes

---

## Validation Rules Reference

### Required Fields
- `model.name` - Model identifier (required)
- `training.method` - Training method: sft or dpo (required)

### Model-Specific Rules
- GPT-2 family: No chat templates, use c_attn/c_proj for LoRA
- Llama family: Supports chat, use q_proj/v_proj/k_proj/o_proj/gate_proj/up_proj/down_proj
- Phi family: Supports chat, use q_proj/v_proj/k_proj/dense

### Data Strategy Rules
- `chat`: Requires messages field, model must support chat templates
- `standard`: Requires text field, works with all models

### Numeric Constraints
- `num_epochs`: Must be > 0, recommended 1-10
- `batch_size`: Must be > 0, recommended 1-8 (GPU dependent)
- `learning_rate`: Must be > 0, recommended 1e-5 to 5e-4
- `lora.r`: Must be > 0, recommended 8-64
- `lora.alpha`: Must be > 0, typically 2x lora.r

### Dataset Requirements
- Minimum examples: 10 (warning if less)
- Format must match strategy
- Each example must have required fields

---

## Implementation Checklist

### Backend (Completed ✓)
- [x] config_validator.py module
- [x] validate_config() function
- [x] validate_dataset_format() function
- [x] KNOWN_LORA_TARGETS map
- [x] Server-side validation in execute endpoint
- [x] Clear error messages with suggestions
- [x] Unit tests (10/10 passing)
- [x] Integration tests (5/5 passing)

### Frontend (To Do)
- [ ] Model selector with cache status
- [ ] Auto-populate LoRA targets
- [ ] Strategy selector with model-based filtering
- [ ] Dataset upload with preview
- [ ] Format auto-detection
- [ ] Real-time validation
- [ ] Pre-submission validation modal
- [ ] Inline error messages
- [ ] Number inputs with constraints
- [ ] Validation status indicators
- [ ] Format conversion helper
- [ ] Model download progress
