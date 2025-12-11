# Training Package Workflow - Phase 2 Implementation Plan

**Date Created**: 2025-01-31
**Phase**: Step Components Implementation
**Duration**: 2-3 weeks
**Status**: 🔵 NOT STARTED

---

## 📋 Executive Summary

Phase 2 implements the 4 core step components that plug into the TrainingPackageWizard container built in Phase 1. Each component will have:
- Real functionality (NO TODOs, stubs, or mock data)
- YAML configuration files for all settings
- Comprehensive error handling and logging
- Robust unit tests before moving to next component
- Incremental development in 30-line chunks

---

## 🎯 Phase 2 Goals

### Primary Objectives
1. ✅ **Step1ModelSelection**: HuggingFace model browser with search and caching
2. ✅ **Step2ConfigSelection**: Training configuration with template system
3. ✅ **Step3DatasetSelection**: Multi-dataset picker with validation
4. ✅ **Step4DeployConfig**: Deployment options (local vs HF Spaces)

### Success Criteria
- [ ] All 4 steps have complete, functional UIs
- [ ] No hardcoded values (all configs in YAML)
- [ ] Each component has passing tests
- [ ] Comprehensive logging throughout
- [ ] Zero TODOs or placeholder code
- [ ] Integration with Phase 1 wizard verified

---

## 📁 File Structure (Phase 2)

```
components/training/workflow/
├── Step1ModelSelection.tsx          # NEW: Model browser/selector
├── Step1ModelSelection.test.tsx     # NEW: Tests
├── Step1ModelSelection.config.yaml  # NEW: Configuration
├── Step2ConfigSelection.tsx         # NEW: Config editor wrapper
├── Step2ConfigSelection.test.tsx    # NEW: Tests
├── Step2ConfigSelection.config.yaml # NEW: Configuration
├── Step3DatasetSelection.tsx        # NEW: Dataset picker
├── Step3DatasetSelection.test.tsx   # NEW: Tests
├── Step3DatasetSelection.config.yaml # NEW: Configuration
├── Step4DeployConfig.tsx            # NEW: Deployment options
├── Step4DeployConfig.test.tsx       # NEW: Tests
├── Step4DeployConfig.config.yaml    # NEW: Configuration
├── PHASE_2_PROGRESS.md              # NEW: Progress tracking
└── PHASE_2_VERIFICATION.md          # NEW: Verification checklist

lib/training/
├── model-browser.ts                 # NEW: HF model search/fetch
├── model-browser.config.yaml        # NEW: Configuration
├── template-loader.ts               # NEW: Load training templates
├── template-loader.config.yaml      # NEW: Configuration
├── dataset-validator.ts             # NEW: Dataset validation
├── dataset-validator.config.yaml    # NEW: Configuration
├── deployment-estimator.ts          # NEW: Cost estimation
└── deployment-estimator.config.yaml # NEW: Configuration
```

---

## 🔧 Implementation Rules (CRITICAL)

### 1. No Hardcoded Values
```typescript
// ❌ WRONG
const MAX_MODELS = 50;
const API_URL = 'https://huggingface.co/api';

// ✅ CORRECT
import { loadConfig } from '@/lib/config/yaml-loader';
const config = loadConfig('Step1ModelSelection.config.yaml');
const MAX_MODELS = config.limits.maxModels;
const API_URL = config.api.baseUrl;
```

### 2. Verify Before Touching
```typescript
// Before modifying any file, verify it exists and read it
const fileExists = await checkFileExists(path);
if (!fileExists) {
  logger.error(`File not found: ${path}`);
  throw new Error(`Cannot proceed: ${path} missing`);
}
```

### 3. 30-Line Chunks
```typescript
// Write code in logical blocks, max 30 lines at a time
// Example: Step 1 - Imports and types
// Then: Step 2 - Component props interface
// Then: Step 3 - State initialization
// Then: Step 4 - Event handlers
// etc.
```

### 4. Real Logic Only
```typescript
// ❌ NEVER DO THIS
const fetchModels = async () => {
  // TODO: Implement HF API call
  return mockData;
};

// ✅ ALWAYS DO THIS
const fetchModels = async (): Promise<ModelInfo[]> => {
  try {
    const response = await fetch(config.api.modelsEndpoint);
    if (!response.ok) {
      logger.error('Failed to fetch models', { status: response.status });
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    logger.info('Models fetched successfully', { count: data.length });
    return data;
  } catch (error) {
    logger.error('Error fetching models', { error });
    throw error;
  }
};
```

### 5. Robust Logging
```typescript
import { createLogger } from '@/lib/logging';

const logger = createLogger('Step1ModelSelection');

logger.debug('Component mounted', { props });
logger.info('Model selected', { modelId, modelName });
logger.warn('Large model selected', { size: sizeGB });
logger.error('Failed to load model', { error, modelId });
```

---

## 📝 Task Breakdown

### Task 1: Step1ModelSelection Component

**Estimated Time**: 3-4 hours

#### Subtasks
1. **Create configuration file** (15 min)
   - `Step1ModelSelection.config.yaml`
   - HuggingFace API settings
   - Popular models list
   - Search limits and filters

2. **Create model browser service** (1 hour)
   - `lib/training/model-browser.ts`
   - HF API integration
   - Search functionality
   - Caching logic
   - Error handling

3. **Create main component** (1.5 hours)
   - `Step1ModelSelection.tsx`
   - Model list UI
   - Search interface
   - Model card display
   - Selection state

4. **Add tests** (1 hour)
   - `Step1ModelSelection.test.tsx`
   - Component rendering
   - Search functionality
   - Model selection
   - Error states

5. **Verify and document** (30 min)
   - Update PHASE_2_PROGRESS.md
   - Manual testing
   - Integration check

#### Acceptance Criteria
- [ ] No hardcoded values
- [ ] Real HF API integration
- [ ] Comprehensive logging
- [ ] All tests pass
- [ ] Works with TrainingPackageWizard

---

### Task 2: Step2ConfigSelection Component

**Estimated Time**: 2-3 hours

#### Subtasks
1. **Create configuration file** (15 min)
   - `Step2ConfigSelection.config.yaml`
   - Training templates list
   - Default parameters
   - Validation rules

2. **Create template loader service** (45 min)
   - `lib/training/template-loader.ts`
   - Load templates from config
   - Template validation
   - Merge with user overrides

3. **Create wrapper component** (1.5 hours)
   - `Step2ConfigSelection.tsx`
   - Reuse existing ConfigEditor
   - Add workflow-aware props
   - Template selector UI
   - Validation integration

4. **Add tests** (1 hour)
   - `Step2ConfigSelection.test.tsx`
   - Template loading
   - Config validation
   - Integration with ConfigEditor

5. **Verify and document** (30 min)
   - Update PHASE_2_PROGRESS.md
   - Manual testing

#### Acceptance Criteria
- [ ] No hardcoded values
- [ ] Template system working
- [ ] Validation comprehensive
- [ ] All tests pass
- [ ] Integrates with existing ConfigEditor

---

### Task 3: Step3DatasetSelection Component

**Estimated Time**: 2-3 hours

#### Subtasks
1. **Create configuration file** (15 min)
   - `Step3DatasetSelection.config.yaml`
   - Min/max dataset counts
   - Validation split ranges
   - Format requirements

2. **Create dataset validator service** (45 min)
   - `lib/training/dataset-validator.ts`
   - Format validation
   - Split validation
   - Size checks

3. **Create main component** (1.5 hours)
   - `Step3DatasetSelection.tsx`
   - Dataset list from Supabase
   - Multi-select interface
   - Train/val split config
   - Preview integration

4. **Add tests** (1 hour)
   - `Step3DatasetSelection.test.tsx`
   - Dataset selection
   - Validation rules
   - Split configuration

5. **Verify and document** (30 min)
   - Update PHASE_2_PROGRESS.md
   - Manual testing

#### Acceptance Criteria
- [ ] No hardcoded values
- [ ] Real Supabase integration
- [ ] Multi-select working
- [ ] Split validation functional
- [ ] All tests pass

---

### Task 4: Step4DeployConfig Component

**Estimated Time**: 3-4 hours

#### Subtasks
1. **Create configuration file** (15 min)
   - `Step4DeployConfig.config.yaml`
   - Deployment targets
   - Cost calculation settings
   - Budget limits

2. **Create cost estimator service** (1 hour)
   - `lib/training/deployment-estimator.ts`
   - Local cost estimation
   - HF Spaces pricing calculation
   - GPU type selection
   - Time estimation

3. **Create main component** (1.5 hours)
   - `Step4DeployConfig.tsx`
   - Deployment option selector
   - Cost display
   - Budget configuration
   - Advanced options

4. **Add tests** (1 hour)
   - `Step4DeployConfig.test.tsx`
   - Deployment selection
   - Cost calculation
   - Budget validation

5. **Verify and document** (30 min)
   - Update PHASE_2_PROGRESS.md
   - Manual testing

#### Acceptance Criteria
- [ ] No hardcoded values
- [ ] Cost estimation accurate
- [ ] Both local and HF options
- [ ] Budget limits enforced
- [ ] All tests pass

---

## 🧪 Testing Strategy

### Unit Tests (Per Component)

```typescript
// Example: Step1ModelSelection.test.tsx
describe('Step1ModelSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render model list from config', async () => {
    render(<Step1ModelSelection isActive={true} />);
    await waitFor(() => {
      expect(screen.getByText('Popular Models')).toBeInTheDocument();
    });
  });

  it('should search models via HF API', async () => {
    const { user } = setup(<Step1ModelSelection isActive={true} />);
    const searchInput = screen.getByRole('textbox', { name: /search/i });

    await user.type(searchInput, 'llama');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=llama')
      );
    });
  });

  it('should handle model selection', async () => {
    const onComplete = jest.fn();
    const { user } = setup(
      <Step1ModelSelection isActive={true} onComplete={onComplete} />
    );

    const modelCard = screen.getByTestId('model-meta-llama-7b');
    await user.click(modelCard);

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'meta-llama/Llama-2-7b-hf' })
    );
  });

  it('should show error on API failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(<Step1ModelSelection isActive={true} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load models/i)).toBeInTheDocument();
    });
  });
});
```

### Integration Tests

```typescript
// Example: workflow-integration.test.tsx
describe('Phase 2 Integration', () => {
  it('should complete all 4 steps sequentially', async () => {
    const { user } = setup(<TrainingPackageWizard />);

    // Step 1: Model
    await user.click(screen.getByText('Qwen/Qwen3-0.6B'));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2: Config
    await user.selectOptions(screen.getByLabelText(/template/i), 'lora');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 3: Dataset
    await user.click(screen.getByLabelText(/dataset-123/i));
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 4: Deploy
    await user.click(screen.getByLabelText(/local/i));
    expect(screen.getByText(/estimated cost/i)).toBeInTheDocument();
  });
});
```

---

## 📊 Configuration Files Structure

### Example: Step1ModelSelection.config.yaml

```yaml
# Step1ModelSelection Configuration
# Last updated: 2025-01-31

api:
  baseUrl: https://huggingface.co/api
  modelsEndpoint: /models
  searchEndpoint: /models/search
  timeout: 10000  # milliseconds
  retries: 3

popularModels:
  - id: meta-llama/Llama-2-7b-hf
    name: Llama 2 7B
    size: 13.5
    category: foundation
  - id: Qwen/Qwen3-0.6B
    name: Qwen3 0.6B
    size: 1.2
    category: small
  - id: mistralai/Mistral-7B-v0.1
    name: Mistral 7B
    size: 14.2
    category: foundation

limits:
  maxModels: 100
  maxSearchResults: 50
  minNameLength: 3
  maxPageSize: 20

filters:
  allowedTaskTypes:
    - text-generation
    - text-classification
    - token-classification
  minDownloads: 100
  minLikes: 10

cache:
  enabled: true
  ttl: 3600  # seconds (1 hour)
  maxEntries: 1000

logging:
  level: info
  includeTimestamps: true
  includeStackTrace: false
```

### Example: Step2ConfigSelection.config.yaml

```yaml
# Step2ConfigSelection Configuration
# Last updated: 2025-01-31

templates:
  lora_finetuning:
    name: LoRA Fine-tuning
    description: Parameter-efficient fine-tuning with LoRA
    defaults:
      learning_rate: 0.0002
      num_epochs: 3
      batch_size: 4
      lora_r: 8
      lora_alpha: 16
      lora_dropout: 0.05

  full_finetuning:
    name: Full Fine-tuning
    description: Complete model fine-tuning
    defaults:
      learning_rate: 0.00001
      num_epochs: 1
      batch_size: 2
      gradient_accumulation_steps: 4

validation:
  learning_rate:
    min: 0.000001
    max: 0.01
    warn_above: 0.001

  batch_size:
    min: 1
    max: 128
    recommended: [2, 4, 8, 16]

  num_epochs:
    min: 1
    max: 100
    warn_above: 10

logging:
  level: info
  logTemplateLoads: true
  logValidationWarnings: true
```

---

## 🔍 Verification Checklist

### Before Starting Each Component

- [ ] Read existing related components
- [ ] Check dependencies are installed
- [ ] Verify config file location
- [ ] Review integration points
- [ ] Set up logging infrastructure

### During Development

- [ ] Write in 30-line chunks
- [ ] Test each chunk before continuing
- [ ] Add logging for all operations
- [ ] No hardcoded values
- [ ] Real logic, no TODOs

### After Completing Each Component

- [ ] All unit tests pass
- [ ] Integration test passes
- [ ] Manual testing complete
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Documentation updated
- [ ] Progress log updated

---

## 📈 Progress Tracking

Progress will be tracked in `PHASE_2_PROGRESS.md` with:
- Task completion status
- Issues encountered
- Decisions made
- Time spent
- Tests written
- Files created

**Update frequency**: After each subtask completion

---

## 🚧 Risk Mitigation

### Risk 1: HuggingFace API Rate Limits
**Mitigation**:
- Implement caching (1 hour TTL)
- Add retry logic with exponential backoff
- Use public models only initially
- Log all API calls for monitoring

### Risk 2: Large Model Downloads
**Mitigation**:
- Show size warnings before selection
- Implement download cancellation
- Use streaming for large files
- Add resume capability

### Risk 3: Invalid Training Configurations
**Mitigation**:
- Comprehensive validation in YAML
- Real-time validation feedback
- Template system with known-good defaults
- Warning system for unusual values

### Risk 4: Dataset Format Mismatches
**Mitigation**:
- Format detection in validator
- Clear error messages
- Example datasets in config
- Preview before final selection

---

## 📚 Dependencies

### New Dependencies Required

```json
{
  "dependencies": {
    "js-yaml": "^4.1.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9"
  }
}
```

### Existing Dependencies Used
- React
- TypeScript
- @supabase/supabase-js
- Tailwind CSS
- Lucide React (icons)

---

## 🎯 Success Metrics

### Code Quality
- [ ] 100% TypeScript coverage
- [ ] 0 ESLint errors
- [ ] 0 hardcoded values
- [ ] 90%+ test coverage

### Functionality
- [ ] All 4 steps render correctly
- [ ] Navigation works seamlessly
- [ ] Data flows correctly between steps
- [ ] Validation catches all errors

### User Experience
- [ ] Loading states for all async operations
- [ ] Clear error messages
- [ ] Helpful validation feedback
- [ ] Responsive design

---

## 🔄 Next Steps After Phase 2

Once Phase 2 is complete:
1. Update TrainingPackageWizard to use real step components
2. Create Phase 3 plan (Model Download System)
3. Implement API endpoints for persistence
4. Add E2E tests for complete workflow

---

**Plan Status**: ✅ COMPLETE
**Ready to Start**: 2025-01-31
**Estimated Completion**: 2025-02-14 (2 weeks)
