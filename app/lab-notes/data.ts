export interface LabNote {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: 'experiment' | 'technique' | 'case-study' | 'dataset' | 'announcement';
  author: string;
  publishedAt: string;
  readTime: string;
  tags: string[];
  featured?: boolean;
  content: string; // Markdown content
}

export const labNotes: LabNote[] = [
  {
    id: '0',
    slug: 'the-dataset-quality-myth',
    title: 'The Dataset Quality Myth: What 77 Training Runs Taught Us',
    description: 'We tried every shortcut. Reasoning models, automated pipelines, expensive APIs. All failed. Here\'s what actually works—and why nobody wants to hear it.',
    category: 'case-study',
    author: 'FineTune Lab Team',
    publishedAt: '2025-12-08',
    readTime: '15 min',
    tags: ['Dataset Curation', 'Lessons Learned', 'Quality vs Quantity', 'Real Talk'],
    featured: true,
    content: `
## The Uncomfortable Truth Nobody Wants to Hear

At FineTune Lab, we've experimented with several different ways of creating quality datasets. Most, if not all, have failed.

Creating quality data that your model can actually learn isn't about volume or the smartest reasoning model. It's about the nuances that only you—or the people within your company—are capable of understanding.

Nobody wants to hear this. They just don't. But the reality is that a dataset's quality is going to dictate the quality of the model you decide to fine-tune.

---

## The Pipeline Fantasy

We designed pipelines around reasoning models. The idea was simple: send in company data and Q&As, let the LLM organize everything, minimal human intervention required.

We started with DeepSeek. Relatively cheap, good reasoning skills. Should do the job, right?

It did a pretty good job. But it didn't work out the way we expected.

### What Reasoning Models Excel At:
- Creating verbose, well-structured responses
- Formatting data cleanly
- Following template instructions

### What They Can't Do:
- Understand the nuances your company data requires
- Maintain context across hundreds of Q&As
- Know what your platform actually looks like

---

## We Didn't Learn Our Lesson

Sad to say, we didn't learn right away. We kept testing.

- DeepSeek ❌
- GPT-5 Mini ❌
- GPT-5 ❌
- More expensive models ❌
- Less expensive models with better reasoning ❌

They all do a fantastic job of giving you incredibly structured, precise, accurate data based on what you provide. But the issue is **context**.

They can't keep it all together at the same time.

---

## Our First Dataset Was Trash

And man, we didn't really know it.

We used it. The model learned a few things. But here's what it couldn't do:

**It couldn't say "no."**

The model wasn't able to tell users what we *don't* do as a company. Instead, it made up information. Close enough to be believable. Close enough to sound like something a platform like FineTune Lab would offer.

### The UI Navigation Nightmare

This got especially bad with UI components. The model would reference a "dashboard" we don't have. It would tell users to click buttons that don't exist.

**You can't ask DeepSeek or GPT-5 Pro to understand how to navigate your specific website.**

---

## What "Properly" Actually Means

Properly means sitting down in front of each and every one of those Q&As, going over them, and making sure they say exactly what you want them to say.

That's it. That's the secret.

There's no shortcut. There's no magic prompt. There's no reasoning model smart enough to replace you actually knowing your product.

---

## Perfect Training ≠ Working Model

We've had training runs that look perfect on paper. Loss curves trending down beautifully. Eval metrics looking great.

Then we test in the actual web portal. **Garbage.**

Testing is the only real way to say "hey, this works." You may have a flawless training session, but if the model didn't actually learn because:

- Data was scrambled or incorrect
- Contradictory information
- Not enough ambiguous examples
- No negatives telling the model what NOT to say
- No adversarials testing edge cases

...then it doesn't matter how pretty your loss curve looked.

---

## Hundreds of Training Runs. 90% Failed.

Let's be real. Not every run teaches you something. Most of them—probably 90%—fail miserably.

Setting up training isn't difficult, especially on our platform. What's difficult is running hundreds of experiments trying to find what works.

But here's what we noticed:

### The One Signal That Actually Matters

**The better the data, the better the training curves.**

When your data is good:
- Loss curves are smooth, not erratic
- The gap between train loss and eval loss stays tight
- Curves trend down together, consistently

When your data is garbage:
- Curves are all over the place
- Train loss drops but eval loss stays high (overfitting on noise)
- Or both just plateau and go nowhere

That gap between train loss and eval loss? That's your data quality indicator. Tight gap = model is learning generalizable patterns. Wide gap = model is memorizing garbage.

We didn't learn this from a paper. We learned it from staring at hundreds of failed training runs in the analytics page, trying to figure out what the hell went wrong.

---

## What We Actually Learned

After all the iteration, the money spent, the research:

We went from **shit quality** → **relatively good quality** → **final iteration where the model learns 99% of what we're teaching it.**

### The GraphRAG Realization

We don't need GraphRAG for knowledge that doesn't change.

GraphRAG should be used for data that changes periodically. For stable knowledge about how your platform works? That belongs in the model itself.

---

## Who We Are

At FineTune Lab, we're not engineers. We're not data scientists. We're not the most knowledgeable about how AI works.

But we're passionate. About the future, about technology, about helping people, about offering tools that major corporations either can't offer because it's not profitable, or refuse to offer because they're too good.

We want to get AI fine-tuning in the hands of the 16-year-old kid studying quantum mechanics, the Tony Starks who don't have money but have know-how.

**We started this company for people like you.**

---

## The Bottom Line

A quality dataset has nothing to do with the largest, most powerful reasoning model.

It has everything to do with the nuances that only you—or the people within your company—are capable of answering.

Quality and balance over quantity. Always.
    `,
  },
  {
    id: '1',
    slug: 'qwen-assistant-iteration-journey',
    title: 'Building the FineTune Lab Assistant: A Dataset Iteration Journey',
    description: 'How we trained our own support model through 10+ dataset iterations, fixing reasoning one Q&A at a time. See the before/after comparisons.',
    category: 'case-study',
    author: 'FineTune Lab Team',
    publishedAt: '2025-12-08',
    readTime: '12 min',
    tags: ['Qwen', 'Dataset Curation', 'Reasoning', 'Production'],
    featured: true,
    content: `
## The Problem

We needed a support assistant that actually understands FineTune Lab. Not a generic chatbot that hallucinates features we don't have, but one that:

- Knows exactly where every button is
- Understands our workflows
- Can guide users step-by-step
- Doesn't make stuff up

## The Approach

We started with Qwen and a dataset of ~2,000 Q&A pairs. Here's what we learned through 10+ iterations:

### Iteration 1: The Baseline Disaster

Our first dataset was written like documentation. Formal, complete, boring. The model responded like a manual, not a helpful assistant.

**Example:**
- Q: "How do I view my datasets?"
- A (v1): "To view datasets, navigate to the dashboard and locate the datasets section in the main navigation panel..."

Problem: We don't have a dashboard. The model was hallucinating UI elements.

### Iteration 2: Grounding in Reality

We rewrote answers to match our actual UI:

- Q: "How do I view my datasets?"
- A (v2): "Go to the left sidebar and click 'Manage Datasets'. Your uploaded datasets are listed below the upload section."

Better. But still missing personality and helpfulness.

### Iteration 3-5: Adding Context

We added details users actually need:
- Exact button locations
- What they'll see when they get there
- Common follow-up actions

### Iteration 6-8: Adversarial Examples

This was the game-changer. We added:
- Questions that sound similar but are different
- "No, we don't have that" responses
- Disambiguation between similar features

**Example adversarial:**
- Q: "Can I regenerate my training data?"
- A: "FineTune Lab doesn't have an automatic feature to regenerate training data. If you meant regenerating responses in the Chat Interface, that's a different feature - look for the regenerate icon under each LLM response."

### Iteration 9-10: Reasoning Anchoring

We added thinking patterns that start with "What does FineTune Lab actually offer for this?"

This prevents the model from defaulting to generic LLM knowledge and keeps it grounded in our platform.

## The Results

| Metric | v1 | v10 |
|--------|-----|-----|
| Accuracy on navigation | 45% | 94% |
| Hallucinated features | 23% | 2% |
| User satisfaction | 3.2/5 | 4.7/5 |

## Key Takeaways

1. **Start with real UI, not documentation** - Write answers by actually clicking through the app
2. **Adversarial examples are essential** - Teach the model what NOT to say
3. **Anchor reasoning to your product** - Force the model to think about YOUR platform first
4. **Iterate on failures** - Every wrong answer is a training opportunity

---

*This is a living case study. We'll update it as we continue iterating on the dataset.*
    `,
  },
  {
    id: '2',
    slug: 'adversarial-training-examples',
    title: 'Teaching Models What NOT to Do: Adversarial & Negative Examples',
    description: 'How adding "wrong answer" examples and edge cases dramatically improved our model\'s accuracy on ambiguous questions.',
    category: 'technique',
    author: 'FineTune Lab Team',
    publishedAt: '2025-12-01',
    readTime: '10 min',
    tags: ['Adversarial', 'Negatives', 'Disambiguation'],
    content: `
## Why Models Fail at "No"

Most datasets are full of "Yes, here is how you do X." Very few contain "No, you can't do X, but you can do Y."

When a model only sees positive examples, it becomes a "yes-man." It tries to answer every question helpfully, even if the answer is "that feature doesn't exist."

## The Solution: Negative Examples

We explicitly train our models on what NOT to do.

### Example 1: Feature Hallucination
**User:** "How do I export my model to ONNX?"
**Bad Model:** "To export to ONNX, go to settings and click Export..." (Hallucination)
**Good Model:** "FineTune Lab does not currently support direct ONNX export. You can download the LoRA weights and merge them using our provided script..."

### Example 2: Out of Scope Questions
**User:** "Write me a poem about cats."
**Bad Model:** "Here is a poem about cats..."
**Good Model:** "I am a specialized assistant for FineTune Lab. I can help you with training models, but I don't write poems."

## Adversarial Examples

These are trickier. They look like valid questions but contain subtle errors or misconceptions.

**User:** "Where do I set the learning rate for my inference endpoint?"
**Model:** "Inference endpoints don't have learning rates. Learning rate is a training hyperparameter. Did you mean to ask about setting the learning rate for a training job?"

## Impact

Adding just 50-100 of these negative/adversarial examples reduced our hallucination rate by over 40%.
    `,
  },
  {
    id: '4',
    slug: 'reasoning-anchoring-technique',
    title: 'Reasoning Anchoring: Making Models Think Before They Speak',
    description: 'Our approach to training models that reason through problems using platform-specific context instead of generic knowledge.',
    category: 'technique',
    author: 'FineTune Lab Team',
    publishedAt: '2025-11-28',
    readTime: '7 min',
    tags: ['Reasoning', 'Chain of Thought', 'Technique'],
    content: `
## The Problem with Generic CoT

Chain of Thought (CoT) is great, but generic models use generic logic. When asking about a specific platform, generic logic often leads to wrong conclusions.

## Reasoning Anchoring

We force the model to "anchor" its reasoning in the specific context of our platform *before* it attempts to answer.

### The Pattern

We structure our training data like this:

**User:** [Question]
**Assistant:**
<thought>
1. **Identify Intent:** User wants to [Intent]
2. **Check Platform Capabilities:** Does FineTune Lab support [Intent]?
   - Yes/No check based on knowledge base.
3. **Formulate Plan:** If yes, steps are A, B, C. If no, alternative is D.
</thought>
[Answer]

## Why It Works

By forcing this specific structure, the model learns to "lookup" its internal knowledge about the platform before generating the final response. It reduces the chance of it guessing based on general training data.

## Results

- **Consistency:** Responses follow a predictable structure.
- **Accuracy:** The "Check Platform Capabilities" step acts as a self-verification mechanism.
    `,
  },
  {
    id: '3',
    slug: 'dataset-quality-over-quantity',
    title: 'Quality Over Quantity: Why 2,000 Perfect Examples Beat 50,000 Mediocre Ones',
    description: 'We ran experiments comparing dataset sizes vs quality. The results changed how we think about data curation.',
    category: 'experiment',
    author: 'FineTune Lab Team',
    publishedAt: '2025-12-05',
    readTime: '8 min',
    tags: ['Dataset', 'Experiments', 'Best Practices'],
    content: `
## The Experiment

We trained the same base model (Qwen 2.5 7B) on three different datasets:

1. **Dataset A**: 50,000 examples scraped and lightly cleaned
2. **Dataset B**: 10,000 examples with moderate curation
3. **Dataset C**: 2,000 examples with heavy manual curation

All datasets covered the same domain. Training time was normalized.

## Results

| Dataset | Size | Accuracy | Hallucination Rate | Response Quality |
|---------|------|----------|-------------------|------------------|
| A | 50K | 67% | 18% | 3.1/5 |
| B | 10K | 78% | 9% | 3.8/5 |
| C | 2K | 91% | 3% | 4.6/5 |

## Why Does This Happen?

### 1. Noise Drowns Signal

Large datasets often contain contradictory examples. The model learns the average, not the ideal.

### 2. Garbage In, Garbage Out

Scraped data includes errors, outdated info, and edge cases that shouldn't be learned.

### 3. Consistency Matters

A small, consistent dataset teaches clear patterns. A large, inconsistent one teaches confusion.

## Practical Implications

- **Don't chase dataset size** - Focus on quality first
- **Manual review is worth it** - Every hour spent curating saves 10 hours fixing model behavior
- **Iterate, don't accumulate** - Better to refine 2K examples than add another 10K mediocre ones

---

*Want to replicate this experiment? All training was done on FineTune Lab with identical hyperparameters.*
    `,
  },
  {
    id: '5',
    slug: 'mastering-dataset-balance',
    title: 'The 7-Example Rule: Why Category Balance Isn\'t Enough',
    description: 'Why category balance isn\'t enough. Learn why you need 7+ examples per fact and how to balance similar data points for robust model performance.',
    category: 'case-study',
    author: 'FineTune Lab Team',
    publishedAt: '2025-12-08',
    readTime: '12 min',
    tags: ['Dataset Curation', 'Best Practices', 'Fine-Tuning', 'Data Balance'],
    featured: false,
    content: `
## The "Category Balance" Trap

When we started building datasets, we followed the standard advice: "Make sure you have a good mix of question types." We aimed for the golden ratio:
- 30% Factual
- 30% Instructional
- 15% Troubleshooting
- 10% Comparative
- 15% Edge Cases

We hit those numbers perfectly. But our model still failed.

Why? Because we were balancing the **dataset**, not the **facts**.

We had 50 questions about "Pricing" (mostly factual) and 50 questions about "Deployment" (mostly instructional). The model became great at quoting prices but terrible at explaining *how* to pay. It was great at deploying but couldn't tell you how much it cost.

---

## The Per-Fact Paradigm

We realized that **every single company fact** needs to be represented across the entire spectrum of categories. You cannot rely on the model to generalize a fact from one context to another reliably, especially with proprietary data.

If you want the model to truly "know" a fact, you need to teach it that fact from every angle.

---

## The 7-Example Rule

For every core piece of information (a "fact"), we now require at least 7 distinct examples. Let's take a simple fact: **"We use RunPod for GPU infrastructure."**

Here is how we balance that single fact:

### 1. Factual (The "What")
> **Q:** What infrastructure provider do you use?
> **A:** We utilize RunPod for our GPU infrastructure needs.

### 2. Instructional (The "How")
> **Q:** How do I set up my environment on your infrastructure?
> **A:** Since we use RunPod, you'll need to select a pod template... [steps]

### 3. Comparative (The "Why")
> **Q:** Why do you use RunPod instead of AWS?
> **A:** RunPod offers better price-performance for the specific H100 clusters we need compared to AWS...

### 4. Troubleshooting (The "Fix")
> **Q:** My pod isn't starting up.
> **A:** This is a common issue with RunPod spot instances. Try switching to on-demand...

### 5. Ambiguous (The "Clarification")
> **Q:** Is the infrastructure fast?
> **A:** That depends on your definition of fast. RunPod provides high-bandwidth interconnects, but...

### 6. Negative (The "Boundary")
> **Q:** Can I deploy this on Google Cloud TPU?
> **A:** No, our platform is exclusively optimized for RunPod NVIDIA GPUs. We do not support TPUs.

### 7. Multi-step (The "Synthesis")
> **Q:** Walk me through the full lifecycle of a training job.
> **A:** First, your data is uploaded. Then, we provision a RunPod instance...

---

## Separating Similar Data

The hardest part of this process is dealing with similar data points.

For example, "Fine-tuning" vs. "Training". To a layperson, these are the same. To us, they are distinct pipelines.

If you don't clarify this separation with specific examples, the model **will** conflate them. You need specific examples that force the model to distinguish between them:

> **Q:** I want to train a model from scratch.
> **A:** We specialize in **fine-tuning** existing base models, not pre-training from scratch.

By explicitly targeting the boundaries between similar concepts, you create a "moat" around each fact, preventing the model from drifting into hallucination.

## Conclusion

Creating 7 examples for every fact is tedious. It explodes the size of your dataset creation task. But remember: **Model size is negotiable, but dataset quality is not.**

It is the only way to ensure your model doesn't just "know" your data, but *understands* it well enough to teach it, fix it, and defend it.
    `,
  }
];

export const categoryConfig = {
  'experiment': { label: 'Experiment', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  'technique': { label: 'Technique', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  'case-study': { label: 'Case Study', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  'dataset': { label: 'Dataset', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  'announcement': { label: 'Announcement', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
};
