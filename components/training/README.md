# Training UI Components

Complete set of React components for building training configuration forms with built-in validation.

## Components Overview

### Form Components (7/7 Complete)

1. **ModelSelector** - Model selection with cache status
2. **LoRAConfig** - LoRA parameter configuration
3. **DataStrategySelector** - Data format strategy selection
4. **DatasetValidator** - Dataset upload and validation
5. **TrainingParams** - Training parameters configuration
6. **ValidationSummary** - Validation results display
7. **PreSubmitModal** - Final confirmation before submission

## Installation

```bash
# All components are in components/training/
# Import from the index file
```

## Quick Start

```typescript
import {
  ModelSelector,
  LoRAConfigComponent,
  DataStrategySelector,
  DatasetValidator,
  TrainingParamsComponent,
  ValidationSummary,
  PreSubmitModal,
} from '@/components/training';
import { validateTrainingConfig } from '@/lib/training/validation';
```

## Complete Example

See `TrainingFormExample.tsx` for a full working example that combines all components.

### Basic Usage

```typescript
function MyTrainingForm() {
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [loraConfig, setLoraConfig] = useState<LoRAConfig>({
    r: 16,
    alpha: 32,
    dropout: 0.1,
    target_modules: [],
  });
  const [strategy, setStrategy] = useState<DataStrategy>('standard');
  const [dataset, setDataset] = useState<DatasetExample[] | null>(null);
  const [trainingParams, setTrainingParams] = useState<TrainingParams>({
    method: 'sft',
    num_epochs: 3,
    batch_size: 4,
    learning_rate: 0.0001,
  });

  // Auto-populate LoRA targets when model changes
  useEffect(() => {
    if (selectedModel) {
      setLoraConfig(prev => ({
        ...prev,
        target_modules: selectedModel.loraTargets
      }));
    }
  }, [selectedModel]);

  // Validate configuration
  const validation = validateTrainingConfig({
    model: selectedModel || undefined,
    lora: loraConfig,
    data: { strategy },
    dataset: dataset || undefined,
    training: trainingParams,
  });

  return (
    <div>
      <ModelSelector 
        selectedModel={selectedModel?.id} 
        onChange={setSelectedModel} 
      />
      
      <LoRAConfigComponent
        config={loraConfig}
        onChange={setLoraConfig}
        selectedModel={selectedModel || undefined}
      />
      
      <DataStrategySelector
        strategy={strategy}
        onChange={setStrategy}
        selectedModel={selectedModel || undefined}
      />
      
      <DatasetValidator
        dataset={dataset}
        onChange={setDataset}
        expectedStrategy={strategy}
      />
      
      <TrainingParamsComponent
        params={trainingParams}
        onChange={setTrainingParams}
      />
      
      <ValidationSummary
        validation={validation}
        onSubmit={() => console.log('Submit!')}
      />
    </div>
  );
}
```

## Component Details

### ModelSelector

Displays a dropdown of available models with cache status indicators.

**Props:**
```typescript
interface ModelSelectorProps {
  selectedModel?: string;        // Model ID
  onChange: (modelInfo: ModelInfo | null) => void;
  disabled?: boolean;
}
```

**Features:**
- Shows model size, chat support, cache status
- Download warning for uncached models
- Displays LoRA target modules
- Auto-populates dependent fields

**Known Models:**
- GPT-2 (124M) - Cached, no chat template
- Phi-2 (2.7B) - Not cached, supports chat
- Llama 2 7B - Not cached, supports chat

### LoRAConfig

Configures LoRA parameters with automatic target module population.

**Props:**
```typescript
interface LoRAConfigProps {
  config: LoRAConfig;
  onChange: (config: LoRAConfig) => void;
  selectedModel?: ModelInfo;
  disabled?: boolean;
}
```

**Features:**
- Rank (r) validation: 1-256, recommended 8-64
- Alpha suggestion: 2x rank
- Dropout range: 0-1
- Read-only target modules (auto-populated from model)
- Warnings for extreme values

### DataStrategySelector

Selects between chat and standard data formats.

**Props:**
```typescript
interface DataStrategySelectorProps {
  strategy: DataStrategy;
  onChange: (strategy: DataStrategy) => void;
  selectedModel?: ModelInfo;
  disabled?: boolean;
}
```

**Features:**
- Auto-disables chat for incompatible models (GPT-2, GPT-Neo, GPT-J)
- Shows format examples
- Visual indication of disabled options

**Strategies:**
- `chat`: Messages with roles (user, assistant)
- `standard`: Plain text format

### DatasetValidator

Uploads and validates dataset files.

**Props:**
```typescript
interface DatasetValidatorProps {
  dataset: DatasetExample[] | null;
  onChange: (dataset: DatasetExample[] | null) => void;
  expectedStrategy: DataStrategy;
  disabled?: boolean;
}
```

**Features:**
- File upload (JSON/JSONL)
- Auto-detect format (messages vs text)
- Preview first 3 examples
- Format mismatch warnings
- Small dataset warnings (<10 examples)
- Dataset statistics display

### TrainingParams

Configures training hyperparameters.

**Props:**
```typescript
interface TrainingParamsProps {
  params: TrainingParams;
  onChange: (params: TrainingParams) => void;
  disabled?: boolean;
}
```

**Features:**
- Training method: SFT or DPO
- Epochs: 1-100, recommended 1-10
- Batch size: 1/2/4/8/16 (GPU-specific recommendations)
- Learning rate: Scientific notation input
- Validation warnings for extreme values

### ValidationSummary

Displays validation results and submit button.

**Props:**
```typescript
interface ValidationSummaryProps {
  validation: ValidationResult;
  onSubmit?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}
```

**Features:**
- Error list (blocks submission)
- Warning list (allows submission with confirmation)
- Success indicator
- Disabled submit button when errors present

### PreSubmitModal

Final confirmation modal before starting training.

**Props:**
```typescript
interface PreSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  config: TrainingConfig;
  validation: ValidationResult;
  isSubmitting?: boolean;
}
```

**Features:**
- Configuration summary table
- Validation results display
- Download warnings for uncached models
- Estimated training time
- Loading state during submission

## Validation

The validation system prevents all common configuration errors:

### Automatically Prevented Issues

1. **LoRA Target Mismatch** - Auto-populated from model architecture
2. **Chat Template Errors** - Chat disabled for incompatible models
3. **Dataset Format Mismatch** - Real-time detection and warnings
4. **Missing Required Fields** - Validation before submission
5. **Invalid Numeric Values** - Input constraints and range checks
6. **Model Download Confusion** - Clear cache status indicators

### Validation Function

```typescript
import { validateTrainingConfig } from '@/lib/training/validation';

const validation = validateTrainingConfig({
  model: selectedModel || undefined,
  lora: loraConfig,
  data: { strategy },
  dataset: dataset || undefined,
  training: trainingParams,
});

// Returns:
// {
//   errors: string[],      // Blocks submission
//   warnings: string[],    // Allows submission
//   isValid: boolean       // true if no errors
// }
```

## API Integration

### Submitting to Training Server

```typescript
const response = await fetch('http://localhost:8000/api/training/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    config: {
      model: { name: selectedModel?.name },
      lora: loraConfig,
      data: { strategy },
      training: trainingParams,
    },
    dataset_content: dataset,
    dataset_path: '/tmp/dataset.json',
    execution_id: `exec_${Date.now()}`,
    name: `Training ${selectedModel?.displayName}`,
  }),
});

const result = await response.json();
console.log('Job ID:', result.job_id);
```

### Server-Side Validation

The training server also validates configs and returns helpful errors:

```json
{
  "detail": "Configuration validation failed: Invalid LoRA target_modules ['q_proj', 'v_proj'] for model 'gpt2'. Expected modules for this architecture: ['c_attn', 'c_proj']."
}
```

## Styling

All components use Tailwind CSS for styling with a consistent design system:

- **Colors:** Blue for primary, Red for errors, Amber for warnings, Green for success
- **Icons:** Unicode characters (✓, ⬇, ❌, ⚠, etc.)
- **Layout:** Responsive with proper spacing
- **States:** Disabled, hover, active, focus

## TypeScript Types

All components are fully typed:

```typescript
// Export from components/training/index.ts
export type { ModelInfo } from './ModelSelector';
export type { LoRAConfig } from './LoRAConfig';
export type { DataStrategy } from './DataStrategySelector';
export type { DatasetExample } from './DatasetValidator';
export type { TrainingParams } from './TrainingParams';
export type { ValidationResult } from './ValidationSummary';
```

## Best Practices

### Auto-population

Always auto-populate LoRA targets when model changes:

```typescript
useEffect(() => {
  if (selectedModel) {
    setLoraConfig(prev => ({
      ...prev,
      target_modules: selectedModel.loraTargets
    }));
  }
}, [selectedModel]);
```

### Validation Before Submission

Always validate before showing the pre-submit modal:

```typescript
const handleSubmit = () => {
  const validation = validateTrainingConfig(config);
  if (!validation.isValid) {
    return; // Errors will be displayed in ValidationSummary
  }
  setShowPreSubmit(true);
};
```

### Error Handling

Handle server errors gracefully:

```typescript
try {
  const response = await fetch('/api/training/execute', { ... });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Training submission failed');
  }
} catch (error) {
  console.error('Submission error:', error);
  alert(error.message);
}
```

## Testing

See `UI_VALIDATION_SPEC.md` for comprehensive testing strategy.

## Documentation

- `VALIDATION_LESSONS_LEARNED.md` - Issues encountered and solutions
- `UI_VALIDATION_SPEC.md` - Complete component specifications
- `METRICS_REFERENCE.md` - Available training metrics
- `SESSION_SUMMARY.md` - Implementation progress

## Support

All components have zero TypeScript errors and follow React best practices.
