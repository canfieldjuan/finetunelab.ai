# Test Datasets for Format Validation

This directory contains minimal sample datasets for testing format validation and compatibility.

## Datasets

### 1. sample-chatml.jsonl
**Format:** ChatML (Chat Markup Language)
**Structure:** Messages with role and content
**Fields:**
- `messages`: Array of {role, content}
- Roles: system, user, assistant
**Compatible Methods:** SFT
**Use Case:** Chat-based instruction following

### 2. sample-sharegpt.jsonl
**Format:** ShareGPT
**Structure:** Conversations with from/value pairs
**Fields:**
- `conversations`: Array of {from, value}
- From: human, gpt
**Compatible Methods:** SFT
**Use Case:** Chat conversations

### 3. sample-dpo.jsonl
**Format:** DPO (Direct Preference Optimization)
**Structure:** Preference pairs with chosen/rejected responses
**Fields:**
- `prompt`: The instruction/question
- `chosen`: Preferred response
- `rejected`: Less preferred response
**Compatible Methods:** DPO, ORPO
**Use Case:** Preference-based alignment

### 4. sample-rlhf.jsonl
**Format:** RLHF (Reinforcement Learning from Human Feedback)
**Structure:** Prompt-response pairs with reward scores
**Fields:**
- `prompt`: The instruction
- `response`: Model's response
- `reward`: Numeric score (0.0-1.0)
**Compatible Methods:** RLHF
**Use Case:** Reward model training

### 5. sample-alpaca.jsonl
**Format:** Alpaca
**Structure:** Instruction-Input-Output triplets
**Fields:**
- `instruction`: What to do
- `input`: Optional input data
- `output`: Expected output
**Compatible Methods:** SFT
**Use Case:** Instruction following

### 6. sample-openorca.jsonl
**Format:** OpenOrca
**Structure:** System prompt + question-response pairs
**Fields:**
- `system_prompt`: System instructions
- `question`: User question
- `response`: Assistant response
**Compatible Methods:** SFT
**Use Case:** Question answering with system prompts

### 7. sample-unnatural.jsonl
**Format:** Unnatural Instructions
**Structure:** Task with multiple input-output instances
**Fields:**
- `instruction`: Task description
- `instances`: Array of {input, output} examples
**Compatible Methods:** SFT
**Use Case:** Multi-instance task learning

### 8. sample-text.jsonl
**Format:** Generic Text/JSONL
**Structure:** Simple text field with question-answer pairs
**Fields:**
- `text`: Plain text with Q&A
**Compatible Methods:** SFT, DPO (synthetic generation)
**Use Case:** Simple text-based training

## Usage in Tests

These datasets are used by:
- `test_format_compatibility.py` - Integration tests
- Format detection validation
- Training config validation tests

## Dataset Size

Each dataset contains 3 examples (minimal for testing):
- Sufficient for format validation
- Fast test execution
- Representative of format structure

## Adding New Test Datasets

When adding a new format:
1. Create `sample-<format>.jsonl` with 3 examples
2. Update this README with format description
3. Add to test_format_compatibility.py
4. Update format-validator compatibility matrix

## Notes

- These are MINIMAL test datasets (3 examples each)
- NOT suitable for actual training (too small)
- Used only for validation and testing
- All examples are valid and properly formatted
