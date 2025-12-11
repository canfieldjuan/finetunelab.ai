# Dataset Balance Best Practices for LLM Fine-Tuning

## Overview
This guide outlines best practices for creating balanced, high-quality datasets for training language models on company-specific Q&A data. Based on research from Stanford Alpaca, Self-Instruct, and industry practices.

---

## Core Question Types (Distribution)

### 1. Factual/Informational (30-40%)
- Direct questions with clear, specific answers
- "What is X?", "What are the specs of Y?"
- Examples:
  - "What's the default learning rate?"
  - "What GPUs are available?"
  - "What's the API endpoint for training?"

### 2. Instructional/How-to (25-30%)
- Step-by-step guidance
- Process explanations
- Configuration instructions
- Examples:
  - "How do I deploy a model to RunPod?"
  - "How do I configure gradient accumulation?"
  - "What's the process for dataset validation?"

### 3. Comparative (10-15%)
- Side-by-side comparisons
- Trade-off analysis
- "Which is better for X scenario?"
- Examples:
  - "What's the difference between LoRA and full fine-tuning?"
  - "Should I use DPO or SFT for my use case?"
  - "Lambda Labs vs RunPod - which is cheaper?"

### 4. Troubleshooting/Debugging (15-20%)
- Problem-solving scenarios
- Error resolution
- Performance issues
- Examples:
  - "Getting CUDA out of memory error, what can I do?"
  - "Why are my training metrics not updating?"
  - "Model is overfitting, how to fix?"

### 5. Multi-step/Complex (10-15%)
- Questions requiring multiple pieces of information
- Workflows and pipelines
- System design questions
- Examples:
  - "What's the complete workflow from dataset to deployment?"
  - "How do I set up a full training pipeline with evaluation?"
  - "What are all the hyperparameters I should tune?"

---

## Critical Quality Elements

### Diversity Requirements

#### Ambiguous Questions (5-10%)
Questions that need clarification or have multiple valid interpretations:
- "How do I train faster?" (faster convergence? faster wall-clock time? lower cost?)
- "What's the best model?" (best for what use case? best quality? best cost?)
- "How much does training cost?" (which GPU? how long? what size model?)

**Purpose:** Teaches the model to ask clarifying questions instead of making assumptions.

#### Adversarial/Edge Cases (5-10%)
Trick questions, contradictions, boundary conditions:
- "Can I train a 70B model on a single A4000?" (technically possible but impractical)
- "Why is my training taking 0 seconds?" (indicates error, not success)
- "Should I use a learning rate of 1.0 for fine-tuning?" (dangerously high)
- Questions with conflicting requirements
- Impossible scenarios
- Questions testing model limitations

**Purpose:** Prevents confident but wrong answers. Teaches the model to recognize when something is problematic.

#### Negative Examples (10-15%)
Questions the model should refuse, redirect, or say "I don't know":
- Out of scope: "How do I train on AWS SageMaker?" (if you only support RunPod/Lambda)
- Unethical: "How do I bypass rate limits?"
- Outdated: "How do I use the old API v1?" (if deprecated)
- Unknown: "What's the exact training cost for my specific dataset?" (requires calculation)

**Purpose:** Teaches the model its boundaries and when to defer to humans.

#### Open-ended vs Closed-ended
- **Closed (40%):** "Yes/No", specific values, definite answers
- **Open (60%):** Exploratory, multiple approaches, context-dependent

#### Context Variations
Same topic asked in different ways:
- "What's the GPU memory requirement?"
- "How much VRAM do I need?"
- "Will this fit on a 24GB GPU?"
- "Minimum GPU memory for training?"

---

## Response Characteristics

### Varying Lengths
- **Short (50-150 words)** - 30%: Quick facts, simple how-tos
- **Medium (150-400 words)** - 50%: Standard explanations with examples
- **Long (400-800+ words)** - 20%: Complex topics, comprehensive guides

### Different Tones
- **Professional/Technical** (40%): Precise terminology, formal
- **Conversational** (40%): Friendly, accessible, encouraging
- **Mixed** (20%): Technical content in approachable language

### With/Without Examples
- **With code/examples** (60%): Practical, actionable
- **Conceptual only** (40%): Theory, explanations, principles

---

## Domain Coverage for Company Data

### Product Features (20%)
- Core capabilities
- Feature descriptions
- What the product can/cannot do

### API/Technical Integration (15%)
- Endpoints
- Parameters
- Integration patterns
- SDK usage

### Pricing/Billing (10%)
- Cost structures
- Pricing models
- Budget estimation

### Setup/Configuration (15%)
- Installation
- Environment setup
- Configuration options

### Best Practices (10%)
- Recommended workflows
- Optimization tips
- Common patterns

### Limitations/Constraints (10%)
- Known issues
- Boundaries
- Not supported features

### Use Cases/Workflows (10%)
- Real-world scenarios
- End-to-end examples
- Industry-specific applications

### Company Policies (10%)
- Terms of service
- Data handling
- Support channels

---

## Balance Rules

### ✅ DO Include

1. **Adversarial Examples** - Questions designed to expose weaknesses
   - Contradictory requirements
   - Impossible scenarios
   - Edge cases at limits

2. **Ambiguous Queries** - Test clarification abilities
   - Vague questions
   - Multiple interpretations
   - Missing context

3. **Difficulty Levels**
   - Easy (40%): Single fact retrieval
   - Medium (40%): Multi-step reasoning
   - Hard (20%): Complex analysis, trade-offs

4. **Input Length Variation**
   - Short (5-20 words): 40%
   - Medium (20-100 words): 40%
   - Long (100-200+ words): 20%

5. **Negative Examples** - "I don't know" / out-of-scope responses
   - Questions about competitors
   - Outdated features
   - Future roadmap items
   - Personal/sensitive data requests

6. **Multi-turn Context** (10-20%)
   - Conversational follow-ups
   - Clarification requests
   - Progressive refinement

7. **Real User Language**
   - Typos and misspellings (5%)
   - Informal phrasing
   - Unclear or incomplete questions
   - Mixed terminology

### ❌ AVOID

1. **Repetitive patterns** - Same structure repeated
2. **Only happy path** - Include failure modes
3. **Perfect grammar only** - Include realistic user input
4. **Single response style** - Vary formality and depth
5. **Only in-scope questions** - Include boundary testing
6. **Only correct assumptions** - Include clarification scenarios

---

## Key Research Insights

### From Stanford Alpaca & Self-Instruct

> **Diversity > Quantity**
> 
> Better to have 1,000 highly varied examples than 10,000 repetitive ones.

**Focus on covering different:**
- **Verb types**: create, analyze, compare, debug, explain, configure, deploy, monitor
- **Object types**: features, data, configurations, workflows, metrics, models
- **Complexity levels**: simple queries → multi-step reasoning → system design
- **Edge cases and failure modes**: What breaks? What's confusing? What's ambiguous?

### Recommended Dataset Size

For company Q&A with good generalization:
- **Minimum viable:** 1,000 examples (highly diverse)
- **Recommended:** 5,000-10,000 examples (balanced composition)
- **Production quality:** 10,000-50,000 examples (comprehensive coverage)

---

## Quality Metrics to Track

### Distribution Metrics
- [ ] Question type distribution matches targets
- [ ] Response length variance (not all same length)
- [ ] Tone/style variety
- [ ] Domain coverage across all categories

### Diversity Metrics
- [ ] Unique verb usage (50+ different verbs)
- [ ] Unique topics/entities (100+ different subjects)
- [ ] Lexical diversity (TTR > 0.3)
- [ ] N-gram overlap < 30% between examples

### Quality Metrics
- [ ] Factual accuracy (human review)
- [ ] Completeness (answers address the question)
- [ ] Appropriate length (not too verbose/terse)
- [ ] Appropriate tone (matches question context)

### Edge Case Coverage
- [ ] At least 5-10% adversarial examples
- [ ] At least 5-10% ambiguous questions
- [ ] At least 10-15% negative/refuse examples
- [ ] At least 5% with typos/informal language

---

## Example Composition for 5,000 Example Dataset

| Category | Count | % | Notes |
|----------|-------|---|-------|
| **Question Types** | | | |
| Factual/Informational | 1,750 | 35% | Core knowledge |
| Instructional/How-to | 1,400 | 28% | Practical guidance |
| Comparative | 600 | 12% | Trade-offs |
| Troubleshooting | 900 | 18% | Problem-solving |
| Multi-step/Complex | 350 | 7% | System design |
| **Quality Elements** | | | |
| Ambiguous questions | 400 | 8% | Need clarification |
| Adversarial/Edge cases | 400 | 8% | Stress testing |
| Negative examples | 600 | 12% | Boundaries |
| Multi-turn context | 500 | 10% | Conversations |
| Typos/informal | 250 | 5% | Real user input |
| **Response Types** | | | |
| Short (50-150w) | 1,500 | 30% | Quick answers |
| Medium (150-400w) | 2,500 | 50% | Standard depth |
| Long (400-800w+) | 1,000 | 20% | Comprehensive |

---

## Implementation Checklist

### Phase 1: Foundation (First 1,000 examples)
- [ ] Cover all 8 domain categories at 10-15% each
- [ ] Include all 5 core question types
- [ ] Mix of short, medium, long responses
- [ ] At least 10% negative examples

### Phase 2: Diversity (1,000 → 3,000)
- [ ] Add ambiguous questions
- [ ] Add adversarial examples
- [ ] Add multi-turn conversations
- [ ] Add real user language variations

### Phase 3: Edge Cases (3,000 → 5,000)
- [ ] Stress test boundaries
- [ ] Add failure modes
- [ ] Add clarification scenarios
- [ ] Add complex multi-step examples

### Phase 4: Quality Review (Ongoing)
- [ ] Human review random 10%
- [ ] Check distribution metrics
- [ ] Verify diversity metrics
- [ ] Test on holdout evaluation set

---

## References

- Stanford Alpaca: https://github.com/tatsu-lab/stanford_alpaca
- Self-Instruct: https://arxiv.org/abs/2212.10560
- InstructGPT: https://arxiv.org/abs/2203.02155
- LLM Survey: https://arxiv.org/abs/2303.18223

---

## Quick Reference Card

**Golden Rules:**
1. **Diversity beats quantity** - 1K varied > 10K repetitive
2. **Include failures** - Adversarial, ambiguous, negative examples
3. **Match real users** - Typos, informal language, vague questions
4. **Test boundaries** - Edge cases, contradictions, out-of-scope
5. **Vary everything** - Length, tone, complexity, style
6. **Balance domains** - Even coverage across all categories
7. **Quality over speed** - Better to spend time curating than generating garbage

**Red Flags:**
- ⚠️ All questions follow same template
- ⚠️ All responses same length
- ⚠️ No negative examples
- ⚠️ No ambiguous questions
- ⚠️ Perfect grammar only
- ⚠️ No failure modes
- ⚠️ Single domain dominating
