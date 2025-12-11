# UI Validation Specification

## Overview
This document defines the client-side validation system to prevent configuration errors before submitting training jobs. All validations mirror the backend validation rules to provide immediate feedback.

---

## 1. Form Structure

### Training Config Form Components
```
TrainingConfigForm
├── ModelSelector
│   ├── Model dropdown
│   ├── Cache status indicator
│   ├── Model info card (size, features)
│   └── Download warning
├── LoRAConfig
│   ├── Rank (r) input
│   ├── Alpha input
│   ├── Dropout input
│   └── Target modules (auto-populated, read-only)
├── DataStrategySelector
│   ├── Strategy radio buttons (standard/chat)
│   ├── Compatibility indicator
│   └── Dataset upload
├── DatasetUpload
│   ├── File picker
│   ├── Format detector
│   ├── Preview panel
│   └── Format converter
├── TrainingParams
│   ├── Epochs slider/input
│   ├── Batch size selector
│   ├── Learning rate input
│   └── Advanced options
└── ValidationSummary
    ├── Error list
    ├── Warning list
    └── Submit button
```

---

## 2. Model Selector Component

### File: `components/training/ModelSelector.tsx`

### Data Structure
```typescript
interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  family: 'gpt2' | 'llama' | 'phi' | 'mistral' | 'other';
  sizeGB: number;
  isCached: boolean;
  supportsChatTemplate: boolean;
  loraTargets: string[];
  description: string;
}

const KNOWN_MODELS: ModelInfo[] = [
  {
    id: 'gpt2',
    name: 'gpt2',
    displayName: 'GPT-2 (124M)',
    family: 'gpt2',
    sizeGB: 0.5,
    isCached: true,
    supportsChatTemplate: false,
    loraTargets: ['c_attn', 'c_proj'],
    description: 'Small, fast model for testing. No chat template support.'
  },
  {
    id: 'microsoft/phi-2',
    name: 'microsoft/phi-2',
    displayName: 'Phi-2 (2.7B)',
    family: 'phi',
    sizeGB: 2.94,
    isCached: false,
    supportsChatTemplate: true,
    loraTargets: ['q_proj', 'v_proj', 'k_proj', 'dense'],
    description: 'Efficient 2.7B model with strong reasoning. Supports chat.'
  },
  {
    id: 'meta-llama/Llama-2-7b-hf',
    name: 'meta-llama/Llama-2-7b-hf',
    displayName: 'Llama 2 7B',
    family: 'llama',
    sizeGB: 13.5,
    isCached: false,
    supportsChatTemplate: true,
    loraTargets: ['q_proj', 'v_proj', 'k_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
    description: 'Popular 7B model with excellent performance. Supports chat.'
  }
];
```

### UI Elements
```tsx
<div className="model-selector">
  <label className="required">Model *</label>
  
  <select onChange={handleModelChange} value={selectedModel}>
    <option value="">Select a model...</option>
    {KNOWN_MODELS.map(model => (
      <option key={model.id} value={model.id}>
        {model.displayName} 
        {model.isCached ? ' ✓' : ' ⬇'}
      </option>
    ))}
  </select>
  
  {selectedModelInfo && (
    <div className="model-info-card">
      <h4>{selectedModelInfo.displayName}</h4>
      <p>{selectedModelInfo.description}</p>
      
      <div className="model-details">
        <span>Size: {selectedModelInfo.sizeGB} GB</span>
        <span>Chat: {selectedModelInfo.supportsChatTemplate ? 'Yes' : 'No'}</span>
        <span>Status: {selectedModelInfo.isCached ? 'Cached' : 'Not cached'}</span>
      </div>
      
      {!selectedModelInfo.isCached && (
        <div className="warning-banner">
          ⚠ This model is not cached. First run will download {selectedModelInfo.sizeGB} GB.
        </div>
      )}
      
      <div className="lora-info">
        <strong>LoRA Target Modules:</strong>
        <div className="module-chips">
          {selectedModelInfo.loraTargets.map(target => (
            <span key={target} className="chip">{target}</span>
          ))}
        </div>
      </div>
    </div>
  )}
</div>
```

### Validation Rules
- Required field (can't be empty)
- Must be valid model ID
- Triggers auto-population of LoRA targets
- Triggers data strategy filtering

---

## 3. LoRA Config Component

### File: `components/training/LoRAConfig.tsx`

### UI Elements
```tsx
<div className="lora-config">
  <h3>LoRA Configuration</h3>
  
  <div className="form-row">
    <label>Rank (r) *</label>
    <input 
      type="number" 
      min="1" 
      max="256"
      value={loraR}
      onChange={handleRankChange}
    />
    <span className="hint">Recommended: 8-64</span>
  </div>
  
  <div className="form-row">
    <label>Alpha *</label>
    <input 
      type="number" 
      min="1" 
      max="512"
      value={loraAlpha}
      onChange={handleAlphaChange}
    />
    <span className="hint">Typically 2x rank (recommended: {loraR * 2})</span>
  </div>
  
  <div className="form-row">
    <label>Dropout</label>
    <input 
      type="number" 
      min="0" 
      max="1" 
      step="0.01"
      value={loraDropout}
      onChange={handleDropoutChange}
    />
    <span className="hint">0.0-0.2 recommended</span>
  </div>
  
  <div className="form-row">
    <label>Target Modules</label>
    <div className="readonly-chips">
      {targetModules.map(module => (
        <span key={module} className="chip readonly">{module}</span>
      ))}
    </div>
    <span className="hint">
      Auto-populated based on model architecture. Cannot be edited.
    </span>
  </div>
</div>
```

### Validation Rules
- `r`: Must be > 0, warn if > 64
- `alpha`: Must be > 0, suggest 2x r
- `dropout`: Must be 0-1
- `target_modules`: Auto-populated, read-only, based on selected model

### Auto-population Logic
```typescript
function getLoRATargetsForModel(modelFamily: string): string[] {
  const targetsMap: Record<string, string[]> = {
    'gpt2': ['c_attn', 'c_proj'],
    'llama': ['q_proj', 'v_proj', 'k_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
    'phi': ['q_proj', 'v_proj', 'k_proj', 'dense'],
    'mistral': ['q_proj', 'v_proj', 'k_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
    'default': ['q_proj', 'v_proj', 'k_proj', 'o_proj']
  };
  
  return targetsMap[modelFamily] || targetsMap['default'];
}
```

---

## 4. Data Strategy Selector Component

### File: `components/training/DataStrategySelector.tsx`

### UI Elements
```tsx
<div className="data-strategy">
  <h3>Data Strategy *</h3>
  
  <div className="radio-group">
    <label className={!selectedModel?.supportsChatTemplate ? 'disabled' : ''}>
      <input 
        type="radio" 
        value="chat"
        checked={strategy === 'chat'}
        disabled={!selectedModel?.supportsChatTemplate}
        onChange={handleStrategyChange}
      />
      <span>Chat Format</span>
      {!selectedModel?.supportsChatTemplate && (
        <span className="disabled-reason">
          (Not supported by {selectedModel?.displayName})
        </span>
      )}
    </label>
    
    <label>
      <input 
        type="radio" 
        value="standard"
        checked={strategy === 'standard'}
        onChange={handleStrategyChange}
      />
      <span>Standard Format</span>
    </label>
  </div>
  
  <div className="format-info">
    {strategy === 'chat' ? (
      <div className="format-example">
        <strong>Expected format:</strong>
        <pre>{`{
  "messages": [
    {"role": "user", "content": "Question here"},
    {"role": "assistant", "content": "Answer here"}
  ]
}`}</pre>
      </div>
    ) : (
      <div className="format-example">
        <strong>Expected format:</strong>
        <pre>{`{
  "text": "Question: ... Answer: ..."
}`}</pre>
      </div>
    )}
  </div>
</div>
```

### Validation Rules
- Required field
- `chat`: Only enabled if model supports chat templates
- Auto-updates when model changes
- Must match uploaded dataset format

---

## 5. Dataset Upload Component

### File: `components/training/DatasetUpload.tsx`

### UI Elements
```tsx
<div className="dataset-upload">
  <h3>Dataset *</h3>
  
  <input 
    type="file" 
    accept=".json,.jsonl"
    onChange={handleFileUpload}
  />
  
  {dataset && (
    <>
      <div className="dataset-summary">
        <span>📊 {dataset.length} examples</span>
        <span>Format: {detectedFormat}</span>
        {detectedFormat !== strategy && (
          <span className="warning">
            ⚠ Format mismatch! Dataset is {detectedFormat} but strategy is {strategy}
          </span>
        )}
      </div>
      
      <div className="dataset-preview">
        <h4>Preview (first 3 examples):</h4>
        {dataset.slice(0, 3).map((example, idx) => (
          <div key={idx} className="example-card">
            <strong>Example {idx + 1}:</strong>
            <pre>{JSON.stringify(example, null, 2)}</pre>
          </div>
        ))}
      </div>
      
      {detectedFormat !== strategy && (
        <div className="format-mismatch-actions">
          <button onClick={() => setStrategy(detectedFormat)}>
            Use {detectedFormat} strategy
          </button>
          <button onClick={handleConvertFormat}>
            Convert to {strategy} format
          </button>
        </div>
      )}
    </>
  )}
</div>
```

### Format Detection Logic
```typescript
function detectDatasetFormat(dataset: any[]): 'chat' | 'standard' {
  if (!dataset || dataset.length === 0) return 'standard';
  
  const firstExample = dataset[0];
  
  if ('messages' in firstExample) {
    return 'chat';
  } else if ('text' in firstExample) {
    return 'standard';
  }
  
  return 'standard';
}
```

### Validation Rules
- Required field (must upload file)
- Minimum 10 examples (warning if less)
- Format must match strategy
- Each example must have required fields
- JSON must be valid

---

## 6. Training Parameters Component

### File: `components/training/TrainingParams.tsx`

### UI Elements
```tsx
<div className="training-params">
  <h3>Training Parameters</h3>
  
  <div className="form-row">
    <label>Number of Epochs *</label>
    <input 
      type="number" 
      min="1" 
      max="100"
      value={numEpochs}
      onChange={handleEpochsChange}
    />
    <span className="hint">Recommended: 1-10</span>
    {numEpochs > 10 && (
      <span className="warning">⚠ High epoch count may lead to overfitting</span>
    )}
  </div>
  
  <div className="form-row">
    <label>Batch Size *</label>
    <select value={batchSize} onChange={handleBatchSizeChange}>
      <option value="1">1 (Safest, slowest)</option>
      <option value="2">2</option>
      <option value="4">4 (Recommended)</option>
      <option value="8">8 (Requires more VRAM)</option>
      <option value="16">16 (High VRAM required)</option>
    </select>
    <span className="hint">GPU: RTX 4060 Ti 16GB - Recommended: 4-8</span>
  </div>
  
  <div className="form-row">
    <label>Learning Rate *</label>
    <input 
      type="number" 
      min="0.000001" 
      max="0.01"
      step="0.000001"
      value={learningRate}
      onChange={handleLRChange}
    />
    <span className="hint">Recommended: 1e-5 to 5e-4 (0.00001 to 0.0005)</span>
    {learningRate > 0.001 && (
      <span className="warning">⚠ High learning rate may cause instability</span>
    )}
  </div>
</div>
```

### Validation Rules
- `num_epochs`: Must be > 0, warn if > 10
- `batch_size`: Must be > 0, recommend 4-8 for RTX 4060 Ti
- `learning_rate`: Must be > 0, warn if > 0.001

---

## 7. Validation Summary Component

### File: `components/training/ValidationSummary.tsx`

### UI Elements
```tsx
<div className="validation-summary">
  <h3>Validation Status</h3>
  
  {errors.length > 0 && (
    <div className="error-list">
      <h4>❌ Errors ({errors.length})</h4>
      <ul>
        {errors.map((error, idx) => (
          <li key={idx} className="error">{error}</li>
        ))}
      </ul>
    </div>
  )}
  
  {warnings.length > 0 && (
    <div className="warning-list">
      <h4>⚠ Warnings ({warnings.length})</h4>
      <ul>
        {warnings.map((warning, idx) => (
          <li key={idx} className="warning">{warning}</li>
        ))}
      </ul>
    </div>
  )}
  
  {errors.length === 0 && warnings.length === 0 && (
    <div className="success">
      ✓ All validations passed
    </div>
  )}
  
  <button 
    className="submit-btn"
    disabled={errors.length > 0}
    onClick={handleSubmit}
  >
    {errors.length > 0 ? 'Fix errors to continue' : 'Start Training'}
  </button>
  
  {warnings.length > 0 && errors.length === 0 && (
    <p className="warning-note">
      You can proceed with warnings, but review them first.
    </p>
  )}
</div>
```

### Validation Function
```typescript
interface ValidationResult {
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

function validateTrainingConfig(config: TrainingConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!config.model?.name) {
    errors.push('Model selection is required');
  }
  
  if (!config.training?.method) {
    errors.push('Training method is required');
  }
  
  if (!config.dataset || config.dataset.length === 0) {
    errors.push('Dataset is required');
  }
  
  // Model-specific validation
  if (config.model?.name) {
    const modelInfo = KNOWN_MODELS.find(m => m.id === config.model.name);
    
    if (modelInfo && !modelInfo.supportsChatTemplate && config.data?.strategy === 'chat') {
      errors.push(
        `Model '${modelInfo.displayName}' does not support chat templates. ` +
        `Use 'standard' strategy or choose a different model.`
      );
    }
    
    // LoRA targets validation
    if (config.lora?.target_modules) {
      const expectedTargets = modelInfo?.loraTargets || [];
      const providedTargets = config.lora.target_modules;
      
      const invalidTargets = providedTargets.filter(t => !expectedTargets.includes(t));
      if (invalidTargets.length > 0) {
        errors.push(
          `Invalid LoRA target modules for ${modelInfo?.displayName}: ${invalidTargets.join(', ')}. ` +
          `Expected: ${expectedTargets.join(', ')}`
        );
      }
    }
  }
  
  // Dataset format validation
  if (config.dataset && config.dataset.length > 0) {
    const detectedFormat = detectDatasetFormat(config.dataset);
    const expectedFormat = config.data?.strategy || 'standard';
    
    if (detectedFormat !== expectedFormat) {
      errors.push(
        `Dataset format mismatch: Dataset is ${detectedFormat} format but ` +
        `strategy is set to ${expectedFormat}. Either change strategy or convert dataset.`
      );
    }
    
    if (config.dataset.length < 10) {
      warnings.push(
        `Small dataset: Only ${config.dataset.length} examples. ` +
        `Recommend at least 10 examples for meaningful training.`
      );
    }
  }
  
  // Numeric validations
  if (config.training?.num_epochs !== undefined) {
    if (config.training.num_epochs <= 0) {
      errors.push('Number of epochs must be positive');
    }
    if (config.training.num_epochs > 10) {
      warnings.push('High epoch count may lead to overfitting');
    }
  }
  
  if (config.training?.batch_size !== undefined && config.training.batch_size <= 0) {
    errors.push('Batch size must be positive');
  }
  
  if (config.training?.learning_rate !== undefined) {
    if (config.training.learning_rate <= 0) {
      errors.push('Learning rate must be positive');
    }
    if (config.training.learning_rate > 0.001) {
      warnings.push('High learning rate may cause training instability');
    }
  }
  
  if (config.lora?.r !== undefined && config.lora.r <= 0) {
    errors.push('LoRA rank (r) must be positive');
  }
  
  if (config.lora?.alpha !== undefined && config.lora.alpha <= 0) {
    errors.push('LoRA alpha must be positive');
  }
  
  return {
    errors,
    warnings,
    isValid: errors.length === 0
  };
}
```

---

## 8. Pre-Submission Modal

### File: `components/training/PreSubmitModal.tsx`

### UI Elements
```tsx
<Modal open={showPreSubmit} onClose={handleClose}>
  <div className="pre-submit-modal">
    <h2>Ready to Start Training?</h2>
    
    <div className="config-summary">
      <h3>Configuration Summary</h3>
      <table>
        <tbody>
          <tr>
            <td>Model:</td>
            <td>{config.model.name}</td>
          </tr>
          <tr>
            <td>Dataset:</td>
            <td>{config.dataset.length} examples ({datasetFormat} format)</td>
          </tr>
          <tr>
            <td>Strategy:</td>
            <td>{config.data.strategy}</td>
          </tr>
          <tr>
            <td>Epochs:</td>
            <td>{config.training.num_epochs}</td>
          </tr>
          <tr>
            <td>Batch Size:</td>
            <td>{config.training.batch_size}</td>
          </tr>
          <tr>
            <td>Learning Rate:</td>
            <td>{config.training.learning_rate}</td>
          </tr>
          <tr>
            <td>LoRA Rank:</td>
            <td>{config.lora.r}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <ValidationSummary errors={validationErrors} warnings={validationWarnings} />
    
    {!modelInfo.isCached && (
      <div className="download-warning">
        <h4>⚠ Model Download Required</h4>
        <p>
          This model is not cached. The first training run will download 
          {modelInfo.sizeGB} GB. This may take several minutes depending on 
          your internet connection.
        </p>
      </div>
    )}
    
    <div className="modal-actions">
      <button onClick={handleClose}>Cancel</button>
      <button 
        onClick={handleConfirmSubmit}
        disabled={validationErrors.length > 0}
        className="primary"
      >
        Confirm & Start Training
      </button>
    </div>
  </div>
</Modal>
```

---

## 9. Implementation Checklist

### Phase 1: Basic Components
- [ ] Create ModelSelector component
- [ ] Create LoRAConfig component
- [ ] Create DataStrategySelector component
- [ ] Create TrainingParams component
- [ ] Wire up form state management

### Phase 2: Dataset Handling
- [ ] Create DatasetUpload component
- [ ] Implement format detection
- [ ] Add dataset preview
- [ ] Add format conversion helper

### Phase 3: Validation
- [ ] Implement validateTrainingConfig function
- [ ] Create ValidationSummary component
- [ ] Add inline validation messages
- [ ] Add real-time validation on field changes

### Phase 4: Advanced Features
- [ ] Create PreSubmitModal
- [ ] Add model cache status checking
- [ ] Add download progress indicator
- [ ] Add recommended value helpers

### Phase 5: Polish
- [ ] Add tooltips and help text
- [ ] Add keyboard shortcuts
- [ ] Add form auto-save
- [ ] Add validation error focus management

---

## 10. Styling Conventions

### Color Scheme
```css
.error { color: #dc2626; background: #fef2f2; }
.warning { color: #ea580c; background: #fff7ed; }
.success { color: #16a34a; background: #f0fdf4; }
.info { color: #2563eb; background: #eff6ff; }
.disabled { color: #9ca3af; opacity: 0.6; }
```

### Status Indicators
- ✓ Cached / Valid
- ⬇ Download Required
- ❌ Error
- ⚠ Warning
- 📊 Statistics
- 🔍 Preview

---

## Testing Strategy

### Unit Tests
- Test validation function with all error cases
- Test format detection with various datasets
- Test LoRA target auto-population
- Test strategy filtering based on model

### Integration Tests
- Test full form submission flow
- Test format conversion
- Test pre-submit modal
- Test error recovery

### User Testing Scenarios
1. Select GPT-2, try to use chat strategy (should be disabled)
2. Upload messages dataset with standard strategy (should show error)
3. Enter negative epochs (should show error)
4. Upload small dataset (should show warning but allow)
5. Select uncached model (should show download warning)
