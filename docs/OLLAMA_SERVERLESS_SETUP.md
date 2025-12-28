# Ollama Serverless Setup Guide

Complete guide for using 70B models via serverless platforms for code review, analysis, and CI/CD.

## Quick Start: Replicate (5 minutes)

### 1. Sign Up & Get API Token

```bash
# 1. Visit https://replicate.com
# 2. Sign up (free tier includes $5 credit)
# 3. Get API token: https://replicate.com/account/api-tokens
# 4. Add to your environment
echo 'export REPLICATE_API_TOKEN=your_token_here' >> ~/.bashrc
source ~/.bashrc
```

### 2. Test the Integration

```bash
# Stage some files
git add app/api/chat/route.ts

# Run code review
npx tsx scripts/replicate-code-review.ts
```

**Expected Output:**
```
🔍 Replicate Code Review - Qwen 2.5 Coder 70B

📂 Reviewing 1 file(s):
   app/api/chat/route.ts

🚀 Sending request to Replicate...
⏳ Prediction started: abc123xyz
......

================================================================================
📋 CODE REVIEW RESULTS
================================================================================

[Detailed analysis from 70B model]

✅ No critical issues detected.
```

### 3. Add to Pre-Commit Hook (Optional)

```bash
# Create .git/hooks/pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Running Replicate code review..."

# Run review script
npx tsx scripts/replicate-code-review.ts

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  read -p "Critical issues found. Commit anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

exit 0
EOF

chmod +x .git/hooks/pre-commit
```

---

## Cost Analysis

### Replicate Pricing

| Model | Cost per Second | Cost per Hour | Typical Review |
|-------|----------------|---------------|----------------|
| Qwen 2.5 Coder 32B | $0.00065 | $2.34/hr | ~$0.05 (3s) |
| Qwen 2.5 Coder 70B | $0.0013 | $4.68/hr | ~$0.10 (8s) |

**Monthly Estimates:**

| Usage Pattern | Reviews/Day | Cost/Month |
|---------------|-------------|------------|
| Light (2 commits/day) | 2 | ~$6 |
| Medium (5 commits/day) | 5 | ~$15 |
| Heavy (20 commits/day) | 20 | ~$60 |
| CI/CD (50 PRs/week) | ~10/day | ~$30 |

**Compare to:**
- Local 7B: $0 (but lower quality)
- GPT-4 API: $500-2000/month
- GitHub Copilot: $10/user/month (but no code review)

---

## Advanced: RunPod Setup (24/7 Availability)

For teams that need always-on access to 70B models:

### 1. Create RunPod Account

```bash
# Visit https://runpod.io
# Add payment method
# Get API key
export RUNPOD_API_KEY=your_key
```

### 2. Deploy Ollama Serverless Endpoint

```bash
# Use RunPod web UI:
# 1. Go to Serverless > Deploy
# 2. Select "Ollama" template
# 3. Choose GPU: A100 80GB
# 4. Set min workers: 0 (scales to zero)
# 5. Set max workers: 1
# 6. Deploy

# Pull model (one-time setup)
curl -X POST https://{your-endpoint-id}.runpod.net/api/pull \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -d '{"model": "qwen2.5-coder:70b"}'
```

### 3. Update Code Review Script

```typescript
// scripts/replicate-code-review.ts
const USE_RUNPOD = process.env.USE_RUNPOD === 'true';
const RUNPOD_ENDPOINT = process.env.RUNPOD_ENDPOINT_ID;

if (USE_RUNPOD) {
  const response = await fetch(
    `https://${RUNPOD_ENDPOINT}.runpod.net/api/generate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder:70b',
        prompt: prompt,
        stream: false,
      }),
    }
  );
}
```

**RunPod Costs:**

| Usage | Active Hours | Idle Hours | Monthly Cost |
|-------|--------------|------------|--------------|
| Part-time (4hr/day) | 120 | 600 | ~$209 |
| Full-time (8hr/day) | 240 | 480 | ~$295 |
| 24/7 | 720 | 0 | ~$641 |

---

## Modal Setup (Best for CI/CD)

True serverless with no idle costs:

### 1. Install Modal

```bash
pip install modal
modal setup  # Follow authentication flow
```

### 2. Create Modal Function

```python
# scripts/modal_ollama.py
import modal

app = modal.App("code-review-70b")

@app.function(
    image=modal.Image.debian_slim()
        .run_commands("curl -fsSL https://ollama.com/install.sh | sh")
        .run_commands("ollama pull qwen2.5-coder:70b"),
    gpu="A100-80GB",
    timeout=600,
)
def review_code(prompt: str) -> str:
    import subprocess

    # Start Ollama server in background
    subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL)

    # Run inference
    result = subprocess.run(
        ["ollama", "run", "qwen2.5-coder:70b", prompt],
        capture_output=True,
        text=True,
    )

    return result.stdout

# Deploy:
# modal deploy scripts/modal_ollama.py
```

### 3. Use in TypeScript

```typescript
// scripts/modal-code-review.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function reviewWithModal(prompt: string): Promise<string> {
  const { stdout } = await execAsync(
    `modal run scripts/modal_ollama.py::review_code --prompt "${prompt}"`
  );

  return stdout;
}
```

**Modal Costs:**
- $4/hour (only when running)
- No idle costs
- Perfect for CI/CD bursts
- 10-20s cold start

---

## GitHub Actions Integration

### CI/CD Code Review

```yaml
# .github/workflows/code-review.yml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install -g tsx

      - name: Run Replicate Code Review
        env:
          REPLICATE_API_TOKEN: ${{ secrets.REPLICATE_API_TOKEN }}
        run: |
          # Get PR changed files
          CHANGED_FILES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD | grep -E '\.(ts|tsx|js|jsx)$' || echo "")

          if [ -n "$CHANGED_FILES" ]; then
            npx tsx scripts/replicate-code-review.ts $CHANGED_FILES
          else
            echo "No code files changed"
          fi

      - name: Comment PR with Results
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ AI Code Review found issues. Check the workflow logs for details.'
            })
```

---

## Comparison Matrix

| Feature | Local 7B | Replicate 70B | RunPod 70B | Modal 70B | GPT-4 API |
|---------|----------|---------------|------------|-----------|-----------|
| **Setup Time** | 10 min | 5 min | 30 min | 20 min | 5 min |
| **Quality** | Good | Excellent | Excellent | Excellent | Excellent |
| **Speed** | Fast (5-10s) | Medium (5-15s) | Fast (2-8s) | Medium (20-30s) | Fast (3-10s) |
| **Cost (monthly)** | $0 | $15-60 | $200-300 | $100-200 | $500-2000 |
| **Privacy** | Private | 3rd party | 3rd party | 3rd party | 3rd party |
| **Offline** | Yes | No | No | No | No |
| **Best For** | Dev workstation | Getting started | 24/7 teams | CI/CD | Production apps |

---

## Recommended Strategy

### Phase 1: Start with Replicate (Week 1)
- Quick setup (5 minutes)
- Test the workflow
- Validate 70B quality vs 7B
- Cost: ~$15-30 for testing

### Phase 2: Optimize Based on Usage (Week 2-4)
- **If <20 commits/day**: Stay on Replicate
- **If 20-50 commits/day**: Consider Modal for CI/CD
- **If >50 commits/day or 24/7**: Migrate to RunPod

### Phase 3: Hybrid Approach (Ongoing)
```
Local 7B (50% of queries):
- Quick dev questions
- Pre-commit hooks
- Offline work

Serverless 70B (30% of queries):
- PR reviews
- Architecture decisions
- Complex refactoring

GPT-4 (20% of queries):
- Critical production decisions
- User-facing features
```

**Expected Annual Savings:** $5,000-20,000 vs GPT-4-only approach

---

## Next Steps

1. **Test Replicate:** `npx tsx scripts/replicate-code-review.ts`
2. **Add to workflow:** Enable pre-commit hook
3. **Monitor costs:** Check Replicate dashboard after 1 week
4. **Scale decision:** Stay on Replicate or migrate to Modal/RunPod

## Support

- Replicate Docs: https://replicate.com/docs
- RunPod Docs: https://docs.runpod.io
- Modal Docs: https://modal.com/docs
- Questions: Open an issue in this repo
