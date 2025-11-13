# Training Comparison: Qwen 1.7B vs Qwen 0.6B

**Date**: 2025-11-01

---

## 📊 Model Comparison Summary

| Metric | Qwen 1.7B | Qwen 0.6B | Winner |
|--------|-----------|-----------|--------|
| **Model Size** | 1.7B parameters | 0.6B parameters | - |
| **Total Epochs** | 1 | 2 | 0.6B (more training) |
| **Total Steps** | 950 | 1,570 | 0.6B (65% more steps) |
| **Metric Points Collected** | 105 | 174 | 0.6B (66% more data) |

---

## 🎯 Loss Metrics Comparison

### Best Performance

| Metric | Qwen 1.7B | Qwen 0.6B | Winner | Improvement |
|--------|-----------|-----------|--------|-------------|
| **Best Eval Loss** | 2.836 | 1.691 | ✅ **0.6B** | **40% better** |
| **Best Epoch** | 0 (first) | 1 (second) | 0.6B (continued improving) |
| **Best Step** | 300 | 1,500 | 0.6B (5x more steps) |

### Training Loss Statistics

| Metric | Qwen 1.7B | Qwen 0.6B | Winner | Difference |
|--------|-----------|-----------|--------|------------|
| **Min Train Loss** | 15.19 | 3.20 | ✅ **0.6B** | **4.7x better** |
| **Max Train Loss** | 64.69 | 10.78 | ✅ **0.6B** | **6x better** |
| **Avg Train Loss** | 19.75 | 3.65 | ✅ **0.6B** | **5.4x better** |

### Evaluation Loss Statistics

| Metric | Qwen 1.7B | Qwen 0.6B | Winner | Difference |
|--------|-----------|-----------|--------|------------|
| **Min Eval Loss** | 2.836 | 1.691 | ✅ **0.6B** | **40% better** |
| **Max Eval Loss** | 3.476 | 2.082 | ✅ **0.6B** | **40% better** |
| **Avg Eval Loss** | 2.941 | 1.746 | ✅ **0.6B** | **41% better** |

---

## 💡 Training Configuration

### Learning Rate

| Model | Avg Learning Rate | Analysis |
|-------|-------------------|----------|
| **Qwen 1.7B** | 1.0e-5 (0.00001) | Very conservative |
| **Qwen 0.6B** | 2.5e-5 (0.000025) | **2.5x higher** - more aggressive |

**Insight**: The 0.6B model used a higher learning rate and achieved better results!

### GPU Memory Usage

| Model | Avg GPU Memory | Efficiency |
|-------|----------------|------------|
| **Qwen 1.7B** | 2.05 GB | 2.8x larger footprint |
| **Qwen 0.6B** | 0.92 GB | ✅ More efficient |

---

## 🚨 Key Issues with Qwen 1.7B Training

### 1. **Extremely High Training Loss** ❌

- **Min train loss**: 15.19 (vs 3.20 for 0.6B)
- **Max train loss**: 64.69 (vs 10.78 for 0.6B)
- **Average**: 19.75 (vs 3.65 for 0.6B)

**Analysis**: Training loss should be lower than eval loss typically. The 1.7B model's training loss is **7x higher than its eval loss** (19.75 vs 2.94), which is extremely unusual and suggests:

- Training instability
- Gradient explosion issues
- Possible data/preprocessing problems
- Might need gradient clipping

### 2. **Stopped Too Early** ⏸️

- Only completed **1 epoch** (vs 2 for 0.6B)
- Only **950 steps** (vs 1,570 for 0.6B)
- Best performance at step 300, then stopped at 950
- **Conclusion**: Should have trained for 2+ epochs like the 0.6B model

### 3. **Learning Rate Too Conservative** 📉

- LR: 1.0e-5 vs 2.5e-5 for 0.6B
- Larger models can typically handle higher learning rates with proper warmup
- Conservative LR may have slowed convergence

### 4. **No Final Loss Recorded** ⚠️

- `final_loss: null`
- `final_eval_loss: null`
- Suggests training may have stopped prematurely or crashed

---

## ✅ Why Qwen 0.6B Performed Better

### 1. **More Training Time**

- 2 epochs vs 1 epoch
- 1,570 steps vs 950 steps
- Continued improving into second epoch

### 2. **Better Convergence**

- Training loss: 3.65 avg (very reasonable)
- Eval loss: 1.75 avg (excellent)
- Small gap between train/eval (3.65 vs 1.75) - healthy

### 3. **Higher Learning Rate**

- 2.5x higher LR allowed faster learning
- Still remained stable throughout training

### 4. **Completion**

- Finished full training run
- Best performance at step 1,500 (near end)
- Shows continued improvement

---

## 🎓 Perplexity Analysis

**Perplexity = exp(loss)**

| Model | Best Eval Loss | Perplexity | Interpretation |
|-------|---------------|------------|----------------|
| **Qwen 1.7B** | 2.836 | 17.06 | Poor - high uncertainty |
| **Qwen 0.6B** | 1.691 | 5.43 | ✅ **Good** - much better predictions |

**Lower perplexity = better language understanding**

The 0.6B model's perplexity of **5.43 is 3.1x better** than the 1.7B model's 17.06!

---

## 🔧 Recommendations for Future 1.7B Training

### 1. **Increase Training Duration** ⏰

```
Current: 1 epoch, 950 steps
Recommended: 2-3 epochs, 2000+ steps
```

### 2. **Increase Learning Rate** 📈

```
Current: 1.0e-5
Recommended: 2.0e-5 to 3.0e-5 (match or slightly exceed 0.6B)
With proper warmup: 100-200 steps
```

### 3. **Add Gradient Clipping** ✂️

```python
max_grad_norm: 1.0  # Prevent gradient explosion
```

### 4. **Monitor for Stability** 👀

- Watch for sudden loss spikes
- Check if training loss >> eval loss (red flag)
- Add early stopping if loss diverges

### 5. **Increase Batch Size (if possible)** 📦

- Larger models benefit from larger batches
- Provides more stable gradients
- May need gradient accumulation if GPU memory limited

### 6. **Verify Data Quality** 🔍

- Check for corrupted samples
- Verify preprocessing is correct
- Ensure dataset format matches model expectations

---

## 📈 Training Health Scorecard

| Metric | Qwen 1.7B | Qwen 0.6B |
|--------|-----------|-----------|
| **Loss Convergence** | ❌ Poor (train >> eval) | ✅ Excellent |
| **Stability** | ❌ High variance | ✅ Stable |
| **Training Completion** | ⚠️ Incomplete (1 epoch) | ✅ Complete (2 epochs) |
| **Final Performance** | ❌ Poor (2.84 eval loss) | ✅ Good (1.69 eval loss) |
| **GPU Efficiency** | ⚠️ 2.05 GB | ✅ 0.92 GB |
| **Overall Grade** | ❌ **D** (Failed) | ✅ **A** (Excellent) |

---

## 🎯 Conclusion

**The Qwen 0.6B model significantly outperformed the 1.7B model** despite being smaller:

- ✅ **40% better** eval loss (1.69 vs 2.84)
- ✅ **5.4x better** average training loss
- ✅ **3.1x better** perplexity (5.43 vs 17.06)
- ✅ More efficient (0.92 GB vs 2.05 GB GPU memory)
- ✅ More stable training
- ✅ Completed full training run

**The 1.7B training had serious issues** that need to be addressed:

1. Training instability (very high train loss)
2. Stopped too early (only 1 epoch)
3. Conservative learning rate
4. No final metrics recorded

**Recommendation**: Re-run the 1.7B model with:

- 2-3 epochs
- Learning rate: 2.5e-5
- Gradient clipping: 1.0
- Verify data preprocessing
- Monitor for loss spikes

The smaller model won because it was **trained better**, not because it's inherently superior. A well-trained 1.7B model should outperform the 0.6B model.
