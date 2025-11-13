# Sequential vs Async Batch Processing Comparison

## Current Test (Sequential - Running Now)

**Script**: `generate_test_batch.py`
**Method**: One request at a time, wait for response, then next request
**Status**: Currently running (50 examples)

### Performance
- **Time per example**: ~50-60 seconds
- **Total time for 50**: ~40-45 minutes
- **Concurrency**: 1 request at a time
- **Cost**: No savings

### Pros
- Simple, easier to debug
- No rate limiting issues
- Guaranteed order

### Cons
- ❌ VERY slow
- ❌ Not scalable (4,900 examples would take ~4 days!)
- ❌ Inefficient use of API capacity

---

## New Async Version (Ready to Use)

**Script**: `generate_batch_async.py`
**Method**: Multiple concurrent requests using Python asyncio
**Status**: Ready for testing

### Performance
- **Time per example**: ~4-5 seconds (with 15 concurrent)
- **Total time for 50**: ~3-4 minutes (**10x faster**)
- **Concurrency**: 15 requests simultaneously
- **Cost**: Same as sequential

### Pros
- ✅ 10x faster than sequential
- ✅ Scalable (4,900 examples in ~5-6 hours vs 4 days)
- ✅ Efficient API usage
- ✅ Progress tracking built-in

### Cons
- Slightly more complex
- Need to tune concurrency to avoid rate limits
- Order not guaranteed (doesn't matter for our use case)

---

## Performance Comparison

### 50 Examples (Current Test)
| Method | Time | Cost |
|--------|------|------|
| Sequential | 40-45 min | ~$0.22 |
| Async (15 concurrent) | 3-4 min | ~$0.22 |
| **Speedup** | **10x faster** | **Same cost** |

### 1,000 Examples (Full Batch)
| Method | Time | Cost |
|--------|------|------|
| Sequential | 13-14 hours | ~$4.50 |
| Async (15 concurrent) | 1.1-1.3 hours | ~$4.50 |
| **Speedup** | **10x faster** | **Same cost** |

### 4,900 Examples (All Batches)
| Method | Time | Cost |
|--------|------|------|
| Sequential | 3-4 DAYS | ~$22 |
| Async (15 concurrent) | 5-6 HOURS | ~$22 |
| **Speedup** | **10x faster** | **Same cost** |

---

## Concurrency Settings

The async version supports adjustable concurrency:

### Conservative (10 concurrent)
- Safest for rate limits
- ~8 hours for full 4,900
- Recommended for first run

### Balanced (15 concurrent) - **RECOMMENDED**
- Good balance of speed/safety
- ~5-6 hours for full 4,900
- Default setting

### Aggressive (20 concurrent)
- Fastest but risky
- ~4 hours for full 4,900
- May hit rate limits

### Maximum (30+ concurrent)
- ❌ Not recommended
- Will likely trigger rate limiting
- Could result in failed requests

---

## Usage Examples

### Test 50 examples (async)
```bash
python generate_batch_async.py \
  output/batches_for_deepseek/tier3/tier3_batch_001_storage.jsonl \
  output/async_test_50.jsonl \
  50 \
  15
```

### Full batch (1,000 examples)
```bash
python generate_batch_async.py \
  output/batches_for_deepseek/tier3/tier3_batch_001_storage.jsonl \
  output/tier3_batch_001_complete.jsonl \
  1000 \
  15
```

### Process entire file (no limit)
```bash
python generate_batch_async.py \
  output/batches_for_deepseek/tier3/tier3_batch_001_storage.jsonl \
  output/tier3_batch_001_complete.jsonl
```

---

## Recommendation

**For this 50-example test**: Let sequential finish (quality review)

**For full 4,900 examples**: Use async version
- Start with 10 concurrent (safe)
- Monitor for errors
- Increase to 15 if stable
- Process all 5 batches in ~5-6 hours instead of 3-4 days

---

## Cost Breakdown (Same for Both Methods)

### DeepSeek V3.2 Pricing
- **Input**: $0.27 per 1M tokens
- **Output**: $1.10 per 1M tokens

### Per Example (avg)
- Input: ~600 tokens = $0.00016
- Output: ~4,000 tokens = $0.00440
- **Total: ~$0.0046 per example**

### Full Dataset (4,900 examples)
- Input: ~2.9M tokens = $0.78
- Output: ~19.6M tokens = $21.56
- **Total: ~$22.34**

### vs Claude Sonnet 4.5
- Claude cost: ~$2,940 (120x more expensive)
- **Savings: $2,918 (98.6% cheaper)**

---

## Files Created

1. **generate_test_batch.py** - Sequential version (currently running)
2. **generate_batch_async.py** - Async version (ready to use)

Both scripts:
- Extract examples from batch files
- Send to DeepSeek with Marcus system prompt
- Track tokens and costs
- Save results in ShareGPT format
- Include metadata with statistics
