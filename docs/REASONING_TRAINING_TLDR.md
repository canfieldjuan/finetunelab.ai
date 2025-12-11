# Reasoning Training - TL;DR

**Date:** 2025-11-30

---

## ❓ Question: Do We Need New Training Methods for Reasoning?

## ✅ Answer: NO! Use Existing SFT & DPO

Your trainer already supports everything needed:
- ✅ SFT (Supervised Fine-Tuning)
- ✅ DPO (Direct Preference Optimization)
- ✅ Standard `messages` format

**The only difference is the DATA, not the training method.**

---

## 📊 The Difference Explained

### Standard Training Data (Brief Answers):

**SFT Example:**
```json
{
  "messages": [
    {"role": "user", "content": "What is 15% of 240?"},
    {"role": "assistant", "content": "36"}
  ]
}
```

**DPO Example:**
```json
{
  "prompt": "What is 15% of 240?",
  "chosen": "36",
  "rejected": "35"
}
```

### Reasoning Training Data (Detailed Answers):

**SFT Example (same format, richer content):**
```json
{
  "messages": [
    {"role": "user", "content": "What is 15% of 240?"},
    {"role": "assistant", "content": "Let me solve this step by step:\n\n1. Convert 15% to decimal: 15/100 = 0.15\n2. Multiply by 240: 0.15 × 240 = 36\n\nTherefore, 15% of 240 is 36."}
  ]
}
```

**DPO Example (same format, comparing reasoning quality):**
```json
{
  "prompt": "What is 15% of 240?",
  "chosen": "Let me solve step by step:\n1. 15% = 0.15\n2. 0.15 × 240 = 36\nAnswer: 36",
  "rejected": "Um, I think it's around 35 or maybe 36"
}
```

---

## 🎯 What Actually Changes

| Aspect | Standard Training | Reasoning Training |
|--------|------------------|-------------------|
| **Training Method** | SFT or DPO | SFT or DPO (SAME!) |
| **Data Format** | `messages` or `prompt/chosen/rejected` | `messages` or `prompt/chosen/rejected` (SAME!) |
| **Code Changes** | None needed | None needed (SAME!) |
| **What's Different** | Brief answers | Step-by-step explanations |

---

## 🚀 How to Train for Reasoning (3 Steps)

### Step 1: Generate Reasoning Data

Use the provided script:
```bash
cd /home/juan-canfield/Desktop/web-ui
python lib/training/generate_reasoning_data.py
```

This creates:
- `datasets/reasoning_sft_math.jsonl` - For SFT training
- `datasets/reasoning_dpo_math.jsonl` - For DPO training

Both use **standard formats** your trainer already supports!

### Step 2: Upload to Your Web UI

Upload the `.jsonl` files through your dataset upload interface.

### Step 3: Train Normally

Select:
- **SFT** for the reasoning_sft_math.jsonl dataset
- **DPO** for the reasoning_dpo_math.jsonl dataset

**Everything else is the same as regular training!**

---

## 🔧 Data Generation Options

### Option A: Use Claude/GPT-4 (Recommended)

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{
        "role": "user",
        "content": "Solve step by step: What is 15% of 240?"
    }]
)

training_example = {
    "messages": [
        {"role": "user", "content": "What is 15% of 240?"},
        {"role": "assistant", "content": response.content[0].text}
    ]
}

# Save as JSONL
import json
with open('reasoning_data.jsonl', 'a') as f:
    f.write(json.dumps(training_example) + '\n')
```

### Option B: Human Annotation

Have humans write step-by-step solutions:

```json
{
  "messages": [
    {"role": "user", "content": "Calculate 25% of 80"},
    {"role": "assistant", "content": "I'll solve this step by step:\n\n1. Convert percentage to decimal:\n   25% = 25/100 = 0.25\n\n2. Multiply by the number:\n   0.25 × 80 = 20\n\nAnswer: 25% of 80 is 20"}
  ]
}
```

### Option C: STaR (Self-Taught Reasoner)

1. Train base model on simple problems
2. Generate reasoning for harder problems
3. Keep only correct solutions
4. Retrain on expanded dataset
5. Repeat

(See `/docs/REASONING_FINETUNING_GUIDE.md` for full details)

---

## 📈 Training Progression Strategy

### Phase 1: Simple Reasoning (Week 1)
- Single-step problems
- Basic math, logic
- ~500-1000 examples

**Example:**
```
Q: What is 10% of 50?
A: 10% = 0.1, so 0.1 × 50 = 5
```

### Phase 2: Multi-Step Reasoning (Week 2-3)
- 2-3 step problems
- Intermediate calculations
- ~1000-2000 examples

**Example:**
```
Q: If 3 pencils cost $6, how much do 7 pencils cost?
A: First, find cost per pencil: $6 ÷ 3 = $2
   Then multiply by 7: $2 × 7 = $14
```

### Phase 3: Complex Reasoning (Week 4+)
- Multi-step with reasoning chains
- Self-verification
- ~2000+ examples

**Example:**
```
Q: A store has 20% off sale. Item costs $60. Tax is 8%. What's the final price?
A: Let me work through this:
   1. Calculate discount: 20% of $60 = 0.20 × 60 = $12
   2. Subtract discount: $60 - $12 = $48
   3. Calculate tax: 8% of $48 = 0.08 × 48 = $3.84
   4. Add tax: $48 + $3.84 = $51.84

   Verification: $60 → 20% off → $48 → 8% tax → $51.84 ✓

   Final price: $51.84
```

---

## 💡 Key Insights

1. **No New Code**: Your `standalone_trainer.py` already has everything
2. **Same Formats**: Uses `messages` array you're already using
3. **Just Better Data**: Responses show reasoning instead of just answers
4. **Progressive Training**: Start simple, increase complexity
5. **Works with SFT & DPO**: Both methods work for reasoning

---

## 🎓 Why This Works

### For SFT:
Model learns to generate step-by-step reasoning by seeing examples.

### For DPO:
Model learns to prefer detailed reasoning over quick guesses by comparing:
- ✅ Chosen: "Step 1... Step 2... Answer: X"
- ❌ Rejected: "I think it's around X"

---

## 📚 Resources

- **Full Guide**: `/docs/REASONING_FINETUNING_GUIDE.md`
- **Data Generator**: `/lib/training/generate_reasoning_data.py`
- **Your Trainer**: `/lib/training/standalone_trainer.py` (already supports this!)

---

## ⚡ Quick Start Command

```bash
# 1. Generate data
python lib/training/generate_reasoning_data.py

# 2. Upload to web UI
# (Use your dataset upload interface)

# 3. Train with SFT method
# (Select the dataset and choose "SFT" training)

# That's it! No code changes needed.
```

---

## 🎯 Bottom Line

**You asked:** "Do we need new templates for training? Are SFT/DPO not the kind of training we need?"

**Answer:**
- ✅ SFT and DPO are **exactly** what you need
- ✅ No new templates required
- ✅ No code changes required
- ✅ Just need **better training data** (with reasoning)
- ✅ Everything else stays the same

**It's not about changing HOW you train, it's about changing WHAT you train on.**

---

**End of Document**
