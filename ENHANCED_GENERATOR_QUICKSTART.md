# Enhanced Dataset Generator - Quick Start Guide

**New Script:** `generate_tier2_enhanced.py`

## What's New?

### 1. OpenRouter Integration ✅
- Access to **100+ models** via single API
- DeepSeek V2.5: **$0.0004/example** (95% cheaper than gpt-4o-mini!)
- Gemini Flash: **$0.0002/example** (98% cheaper!)
- Automatic fallback if one model fails

### 2. Batch Prompting ✅
- Generate **5 examples per request** instead of 1
- **30-40% cost savings** (shared system prompt)
- Faster generation (fewer API calls)

### 3. Mix-and-Match Strategy ✅
- **80% with cheap model** (DeepSeek) for bulk
- **20% with expensive model** (Claude Sonnet) for quality
- Best of both worlds: cost + quality

### 4. Progress Persistence ✅
- **Resume from interruption** (auto-saves progress)
- **Real-time cost tracking**
- **Automatic retry** on failures (3 attempts with exponential backoff)

---

## Installation

### 1. Install OpenAI Library

```bash
pip install openai
```

**Note:** OpenRouter uses OpenAI-compatible API, so we use the `openai` package.

### 2. Get OpenRouter API Key

1. Visit: https://openrouter.ai/keys
2. Sign up (free tier available)
3. Create API key
4. **Optional:** Add $5-10 credits (or use free tier with limits)

### 3. Set API Key

**Windows:**
```cmd
set OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

**Linux/Mac:**
```bash
export OPENROUTER_API_KEY=sk-or-v1-xxxxx
```

**Permanent (add to .env):**
```bash
echo "OPENROUTER_API_KEY=sk-or-v1-xxxxx" >> .env
```

---

## Usage

### Basic Usage (Interactive)

```bash
python generate_tier2_enhanced.py
```

The script will ask you:
1. **Strategy:** Single model or mix-and-match?
2. **Model:** Which model(s) to use?
3. **Quantity:** How many examples?
4. **Batch size:** 1-5 examples per request?

Then it shows **cost estimate** before starting.

---

## Examples

### Example 1: Ultra-Cheap Bulk Generation

**Goal:** Generate 1,000 examples for ~$0.40

```
Strategy: 1 (Single model)
Model: 1 (deepseek/deepseek-chat)
Quantity: 1000
Batch size: 5

Estimated cost: $0.40
Actual cost: ~$0.38-0.42

Time: ~20-30 minutes
```

**Cost comparison:**
- DeepSeek: $0.40
- gpt-4o-mini: $5.00
- **Savings: 92%**

---

### Example 2: Mix-and-Match for Quality

**Goal:** 1,000 examples with quality control

```
Strategy: 2 (Mix-and-match)
Configuration:
  - 80% DeepSeek (800 examples)
  - 20% Claude Sonnet (200 examples)
Quantity: 1000
Batch size: 5

Bulk cost:    $0.32 (DeepSeek)
Quality cost: $4.80 (Claude)
Total:        $5.12

vs. All Claude: $24.00
Savings: 79%
```

**Best for:** Training data where you want high-quality examples mixed with bulk data.

---

### Example 3: Testing (Small Batch)

**Goal:** Test before committing to large generation

```
Strategy: 1 (Single model)
Model: 2 (google/gemini-flash-1.5)
Quantity: 10
Batch size: 5

Cost: ~$0.02
Time: ~1 minute
```

**Use this to:**
- Verify prompts work correctly
- Check output quality
- Test different models

---

## Model Comparison

### Ultra-Cheap (Recommended for Bulk)

| Model | Cost/Example | Speed | Quality |
|-------|--------------|-------|---------|
| **DeepSeek Chat** | $0.0004 | Fast | Good |
| **Gemini Flash** | $0.0002 | Very Fast | Good |

**Best for:** 10K+ examples, initial dataset creation

---

### Balanced (Good Quality/Cost Ratio)

| Model | Cost/Example | Speed | Quality |
|-------|--------------|-------|---------|
| **GPT-4o Mini** | $0.005 | Fast | Very Good |
| **Claude Haiku** | $0.004 | Fast | Very Good |
| **Llama 3.1 70B** | $0.001 | Medium | Good |

**Best for:** 1K-10K examples, production datasets

---

### Premium (Best Quality)

| Model | Cost/Example | Speed | Quality |
|-------|--------------|-------|---------|
| **Claude 3.5 Sonnet** | $0.12 | Medium | Excellent |
| **GPT-4o** | $0.08 | Medium | Excellent |
| **Gemini Pro 1.5** | $0.05 | Fast | Excellent |

**Best for:** Quality examples, final 20% in mix-and-match

---

## Cost Scenarios

### Scenario 1: 10K Training Dataset

**Mix-and-match (RECOMMENDED):**
- 8,000 examples @ DeepSeek = $3.20
- 2,000 examples @ Claude Sonnet = $240
- **Total: $243.20**

**vs. All GPT-4o Mini:** $500
**vs. All Claude Sonnet:** $1,200

**Savings: 52% vs gpt-4o-mini, 80% vs claude-sonnet**

---

### Scenario 2: 100K Dataset (Enterprise)

**Mix-and-match:**
- 80K @ DeepSeek = $32
- 20K @ GPT-4o = $1,600
- **Total: $1,632**

**vs. All GPT-4o:** $8,000
**Savings: 80%**

---

### Scenario 3: Quick Iteration (500 examples)

**Single model (Gemini Flash):**
- 500 @ Gemini Flash = $0.10
- **Under 10 cents!**

Perfect for rapid prototyping and testing prompts.

---

## Advanced Features

### Resume Capability

If generation is interrupted:

```bash
python generate_tier2_enhanced.py
# Select same configuration
# Script automatically resumes from progress file
```

Progress saved to: `generation_progress.json`

---

### Custom Models

Edit the script to add more models from OpenRouter:

```python
MODEL_PRICING = {
    # Add your model
    "custom/my-model": {"input": 0.10, "output": 0.20, "provider": "openrouter"},
}
```

Browse all models: https://openrouter.ai/models

---

### Batch Size Tuning

**Batch size trade-offs:**

| Batch Size | Cost Savings | Reliability | Speed |
|------------|--------------|-------------|-------|
| 1 | 0% | Highest | Slowest |
| 3 | 20-25% | High | Medium |
| **5 (Recommended)** | **30-40%** | **Medium** | **Fast** |
| 10 | 40-50% | Lower | Fastest |

**Recommendation:** Use 5 for best balance.

---

## Troubleshooting

### Error: "OPENROUTER_API_KEY not set"

**Solution:**
```bash
# Windows
set OPENROUTER_API_KEY=your-key

# Linux/Mac
export OPENROUTER_API_KEY=your-key
```

---

### Error: "OpenAI library not installed"

**Solution:**
```bash
pip install openai
```

---

### Error: "Rate limit exceeded"

**Solutions:**
1. Wait a few seconds and resume (script auto-resumes)
2. Add more credits to OpenRouter account
3. Use slower batch size (1 instead of 5)
4. Switch to a model with higher rate limits

---

### JSON Parse Errors

**Cause:** Model didn't return valid JSON

**Solutions:**
1. Check `generation_progress.json` - valid examples are saved
2. Retry failed batches (script auto-retries 3 times)
3. Try a different model (Gemini/GPT-4 are more reliable)

---

## Output Format

### JSONL Output (one JSON per line)

```jsonl
{"conversations": [{"from": "user", "value": "..."}, {"from": "assistant", "value": "..."}], "metadata": {...}}
{"conversations": [{"from": "user", "value": "..."}, {"from": "assistant", "value": "..."}], "metadata": {...}}
```

**Compatible with:**
- Your training system
- Axolotl
- LLaMA Factory
- HuggingFace datasets

---

## Next Steps

### 1. Test with Small Batch
```bash
python generate_tier2_enhanced.py
# Select: Single model, Gemini Flash, 10 examples, batch size 5
# Cost: ~$0.02
```

### 2. Generate Bulk Dataset
```bash
python generate_tier2_enhanced.py
# Select: Mix-and-match, 1000 examples, batch size 5
# Cost: ~$5
```

### 3. Review Quality
- Check `output/tier2_generated_deepseek.jsonl`
- Manually review 10-20 examples
- Look for hallucinations, incorrect facts, poor reasoning

### 4. Upload to Training System
- Use web UI to upload JSONL file
- Start fine-tuning!

---

## Cost Calculator

Want to estimate cost for your specific needs?

```python
from generate_tier2_enhanced import CostCalculator

calc = CostCalculator()

# Estimate for 5000 examples with DeepSeek
cost = calc.estimate_cost(
    model="deepseek/deepseek-chat",
    avg_prompt_tokens=1500,
    avg_completion_tokens=2000,
    num_requests=5000 // 5  # Batch size of 5
)

print(f"Estimated cost: ${cost:.2f}")
# Output: Estimated cost: $2.00
```

---

## Tips & Best Practices

### 1. Start Small, Scale Up
- Generate 10-100 examples first
- Review quality manually
- Then scale to 1K-10K

### 2. Use Mix-and-Match for Training Data
- Bulk examples teach general patterns
- Quality examples teach expert reasoning
- 80/20 mix is optimal

### 3. Monitor Costs in Real-Time
- Script shows running cost
- Saved in `generation_progress.json`
- Can pause anytime (Ctrl+C) and resume

### 4. Curate After Generation
- Not all generated examples are perfect
- Review and remove low-quality examples
- Target 80-90% quality rate

### 5. Experiment with Models
- Different models have different strengths
- DeepSeek: Great for factual Q&A
- Claude: Better for reasoning/analysis
- Gemini: Fast for simple tasks

---

## Comparison: Old vs Enhanced

| Feature | Old Script | Enhanced Script |
|---------|-----------|-----------------|
| **API Integration** | Manual copy-paste | Automatic via OpenRouter |
| **Models** | GPT-4 only | 100+ models |
| **Cost (1K examples)** | $15 (manual) | $0.40-5.00 |
| **Batch Processing** | No | Yes (5 per request) |
| **Cost Tracking** | Manual | Real-time |
| **Resume Capability** | No | Yes |
| **Retry on Failure** | Manual | Automatic (3x) |
| **Mix-and-Match** | No | Yes |

---

## FAQ

**Q: Do I need a paid OpenRouter account?**
A: No! Free tier includes access to many models. For heavy usage, add $5-10 credits.

**Q: Can I use my OpenAI API key instead?**
A: Yes, but you'll only have access to OpenAI models. OpenRouter gives you 100+ models.

**Q: Which model should I use?**
A: For testing: Gemini Flash. For bulk: DeepSeek. For quality: Claude Sonnet.

**Q: How long does it take to generate 1,000 examples?**
A: With batch size 5: ~20-30 minutes (200 API calls @ 5-10s each)

**Q: Can I pause and resume?**
A: Yes! Press Ctrl+C to stop. Run script again with same settings to resume.

**Q: What if I run out of credits mid-generation?**
A: Progress is auto-saved. Add credits, then resume.

---

## Support

**Issues:**
- Check `generation_progress.json` for error details
- Review OpenRouter docs: https://openrouter.ai/docs
- Check model status: https://openrouter.ai/models

**Need help?** Open an issue with:
- Error message
- Model used
- Batch size
- Progress file (if available)

---

**Happy generating! 🚀**
