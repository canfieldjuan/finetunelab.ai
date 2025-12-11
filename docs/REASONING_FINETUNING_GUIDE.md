# Reasoning & Thinking Finetuning Guide

**Date:** 2025-11-30
**Context:** How to finetune models for improved reasoning and thinking about responses

---

## 🎯 Overview

Finetuning for reasoning involves teaching models to:
1. **Show their work** (Chain-of-Thought)
2. **Self-correct** (Critique & Refinement)
3. **Verify answers** (Process Supervision)
4. **Think step-by-step** (Structured Reasoning)

---

## 📊 Dataset Construction Methods

### 1. Chain-of-Thought (CoT) Dataset

**Goal:** Train model to explain reasoning before answering

**Example Entry:**
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant. Always show your reasoning step-by-step before providing the final answer."
    },
    {
      "role": "user",
      "content": "A store sells apples for $3 per kg. If I buy 2.5 kg and pay with a $20 bill, how much change do I get?"
    },
    {
      "role": "assistant",
      "content": "Let me work through this step by step:\n\n**Step 1: Calculate total cost**\n- Price per kg: $3\n- Amount purchased: 2.5 kg\n- Total cost: $3 × 2.5 = $7.50\n\n**Step 2: Calculate change**\n- Amount paid: $20\n- Total cost: $7.50\n- Change: $20 - $7.50 = $12.50\n\n**Final Answer:** You would receive $12.50 in change."
    }
  ]
}
```

**How to Generate:**
```python
# Option A: Use strong model to generate reasoning
import anthropic

client = anthropic.Anthropic()

def generate_cot_example(question: str, answer: str):
    prompt = f"""Given this question and answer, generate a detailed step-by-step reasoning process:

Question: {question}
Correct Answer: {answer}

Show all reasoning steps clearly."""

    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000
    )

    return {
        "messages": [
            {"role": "user", "content": question},
            {"role": "assistant", "content": response.content[0].text}
        ]
    }

# Option B: Human annotation with reasoning templates
```

---

### 2. Self-Taught Reasoner (STaR)

**Goal:** Model generates its own reasoning, keeps what works

**Process:**
```python
def star_training(model, problems, iterations=3):
    """
    Self-Taught Reasoner training loop
    """
    training_data = []

    for iteration in range(iterations):
        print(f"STaR Iteration {iteration + 1}")

        for problem in problems:
            # Generate reasoning with current model
            reasoning = model.generate(
                f"Solve step by step: {problem['question']}"
            )

            # Check if answer is correct
            if verify_answer(reasoning, problem['correct_answer']):
                # Keep successful reasoning
                training_data.append({
                    "question": problem['question'],
                    "reasoning": reasoning
                })
            else:
                # Rationalization: give answer, ask for reasoning
                rationalized = model.generate(
                    f"The answer to '{problem['question']}' is "
                    f"{problem['correct_answer']}. Explain the "
                    f"step-by-step reasoning that leads to this answer."
                )
                training_data.append({
                    "question": problem['question'],
                    "reasoning": rationalized
                })

        # Finetune on accumulated data
        model = finetune(model, training_data)

    return model, training_data

def verify_answer(reasoning: str, correct_answer: str) -> bool:
    """Extract final answer from reasoning and compare"""
    # Use regex or parser to extract answer
    extracted = extract_final_answer(reasoning)
    return extracted.lower().strip() == correct_answer.lower().strip()
```

---

### 3. Process Reward Model (PRM) Training

**Goal:** Reward correct reasoning steps, not just final answers

**Step-Level Annotation:**
```json
{
  "question": "What is 15% of 240?",
  "reasoning_steps": [
    {
      "step": "Convert 15% to decimal: 15/100 = 0.15",
      "correct": true,
      "score": 1.0
    },
    {
      "step": "Multiply: 0.15 × 240",
      "correct": true,
      "score": 1.0
    },
    {
      "step": "Calculate: 0.15 × 240 = 3.6",
      "correct": false,
      "score": 0.0,
      "error": "Arithmetic error"
    },
    {
      "step": "Therefore answer is 3.6",
      "correct": false,
      "score": 0.0,
      "error": "Based on wrong calculation"
    }
  ],
  "correct_reasoning": [
    "Convert 15% to decimal: 15/100 = 0.15",
    "Multiply: 0.15 × 240 = 36",
    "Therefore 15% of 240 is 36"
  ]
}
```

**Training Approach:**
1. Train verifier model to score each step (0-1)
2. Use verifier to rank multiple reasoning paths
3. Finetune generator on highest-scored paths

---

### 4. Critique and Refinement

**Goal:** Model learns to check and improve its own reasoning

**Training Format:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Solve: If a train travels 120 km in 2 hours, what is its speed in m/s?"
    },
    {
      "role": "assistant",
      "content": "Initial attempt:\n120 km in 2 hours = 120/2 = 60 km/h"
    },
    {
      "role": "user",
      "content": "The question asks for m/s, not km/h. Please convert and check your work."
    },
    {
      "role": "assistant",
      "content": "You're right, I need to convert to m/s. Let me recalculate:\n\n**Step 1: Find speed in km/h**\n- Distance: 120 km\n- Time: 2 hours\n- Speed: 120 ÷ 2 = 60 km/h\n\n**Step 2: Convert km/h to m/s**\n- 1 km = 1000 m\n- 1 hour = 3600 seconds\n- 60 km/h = 60 × (1000/3600) = 60 × (5/18)\n- = 300/18 = 16.67 m/s\n\n**Verification:**\n- 16.67 m/s × 3600 s/h ÷ 1000 m/km = 60 km/h ✓\n\n**Final Answer:** 16.67 m/s"
    }
  ]
}
```

**Generation Script:**
```python
def generate_critique_data(problems):
    """Generate self-critique training examples"""
    training_data = []

    for problem in problems:
        # Get initial (possibly flawed) attempt
        initial = model.generate(problem, temperature=0.8)

        # Get critique
        critique = model.generate(
            f"Review this solution and identify any errors:\n\n"
            f"Problem: {problem}\n"
            f"Solution: {initial}\n\n"
            f"Are there any mistakes? If so, what are they?"
        )

        # Get refined solution
        refined = model.generate(
            f"Problem: {problem}\n"
            f"Initial attempt: {initial}\n"
            f"Issues found: {critique}\n\n"
            f"Provide a corrected, step-by-step solution:"
        )

        training_data.append({
            "messages": [
                {"role": "user", "content": problem},
                {"role": "assistant", "content": initial},
                {"role": "user", "content": "Please review and improve your answer"},
                {"role": "assistant", "content": refined}
            ]
        })

    return training_data
```

---

### 5. Self-Consistency Training

**Goal:** Use multiple reasoning paths, keep most consistent ones

**Process:**
```python
def generate_self_consistent_data(problems, n_samples=10):
    """
    Generate multiple reasoning paths per problem,
    keep those that lead to most common answer
    """
    training_data = []

    for problem in problems:
        # Generate N different reasoning paths
        paths = []
        for _ in range(n_samples):
            reasoning = model.generate(
                problem,
                temperature=0.7  # Higher temp for diversity
            )
            answer = extract_answer(reasoning)
            paths.append({
                "reasoning": reasoning,
                "answer": answer
            })

        # Find most common answer
        from collections import Counter
        answer_counts = Counter(p["answer"] for p in paths)
        most_common_answer, count = answer_counts.most_common(1)[0]

        # Keep only paths that got the most common answer
        if count >= n_samples * 0.6:  # At least 60% agreement
            consistent_paths = [
                p for p in paths
                if p["answer"] == most_common_answer
            ]

            # Use the most detailed/clear reasoning
            best_path = max(
                consistent_paths,
                key=lambda x: len(x["reasoning"])
            )

            training_data.append({
                "question": problem,
                "reasoning": best_path["reasoning"],
                "consistency_score": count / n_samples
            })

    return training_data
```

---

## 🔧 Integration with Web-UI Training Pipeline

### Add Reasoning Dataset Type

**File:** `lib/training/types.ts`

```typescript
export type DatasetType =
  | 'instruction'
  | 'conversation'
  | 'reasoning'      // NEW
  | 'critique'       // NEW
  | 'custom';

export interface ReasoningDatasetConfig {
  type: 'reasoning';
  reasoningStyle: 'chain-of-thought' | 'step-by-step' | 'critique' | 'self-consistency';
  includeVerification: boolean;
  maxSteps?: number;
}
```

### Dataset Preparation UI Component

**File:** `components/training/ReasoningDatasetBuilder.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface ReasoningExample {
  question: string;
  reasoning: string;
  answer: string;
  steps: string[];
}

export function ReasoningDatasetBuilder() {
  const [examples, setExamples] = useState<ReasoningExample[]>([]);
  const [generationModel, setGenerationModel] = useState('claude-3-5-sonnet-20241022');
  const [reasoningStyle, setReasoningStyle] = useState<'cot' | 'star' | 'critique'>('cot');

  const generateReasoningExamples = async (questions: string[]) => {
    const response = await fetch('/api/training/generate-reasoning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions,
        model: generationModel,
        style: reasoningStyle
      })
    });

    const { examples } = await response.json();
    setExamples(prev => [...prev, ...examples]);
  };

  return (
    <div className="space-y-4">
      <div>
        <label>Reasoning Style</label>
        <Select
          value={reasoningStyle}
          onChange={(e) => setReasoningStyle(e.target.value)}
        >
          <option value="cot">Chain-of-Thought</option>
          <option value="star">Self-Taught Reasoner</option>
          <option value="critique">Critique & Refinement</option>
        </Select>
      </div>

      <div>
        <label>Generation Model</label>
        <Select
          value={generationModel}
          onChange={(e) => setGenerationModel(e.target.value)}
        >
          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
          <option value="gpt-4">GPT-4</option>
          <option value="o1-preview">O1 Preview</option>
        </Select>
      </div>

      <Button onClick={() => generateReasoningExamples(questions)}>
        Generate Reasoning Examples
      </Button>

      {/* Display and edit examples */}
      <div className="space-y-2">
        {examples.map((ex, i) => (
          <ReasoningExampleCard key={i} example={ex} />
        ))}
      </div>
    </div>
  );
}
```

### API Endpoint for Reasoning Generation

**File:** `app/api/training/generate-reasoning/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function POST(req: NextRequest) {
  const { questions, model, style } = await req.json();

  const examples = [];

  for (const question of questions) {
    let prompt = '';

    if (style === 'cot') {
      prompt = `Solve this problem step-by-step, showing all your reasoning:

${question}

Format your response with clear steps and a final answer.`;
    } else if (style === 'star') {
      prompt = `First attempt to solve: ${question}

Then critique your solution and provide an improved version if needed.`;
    } else if (style === 'critique') {
      prompt = `Solve: ${question}

After solving, verify your answer by working backwards or using an alternative method.`;
    }

    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const reasoning = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    examples.push({
      question,
      reasoning,
      model,
      style
    });
  }

  return NextResponse.json({ examples });
}
```

---

## 📚 Reasoning Dataset Sources

### Public Datasets

1. **GSM8K** - Grade school math with reasoning
   - 8,500 problems with natural language solutions
   - Download: https://github.com/openai/grade-school-math

2. **MATH Dataset** - Competition math problems
   - 12,500 problems with step-by-step solutions
   - Download: https://github.com/hendrycks/math

3. **StrategyQA** - Questions requiring implicit reasoning
   - 2,780 yes/no questions with reasoning chains
   - Download: https://allenai.org/data/strategyqa

4. **ARC (AI2 Reasoning Challenge)**
   - Science questions requiring reasoning
   - Download: https://allenai.org/data/arc

5. **CommonsenseQA**
   - Questions requiring commonsense reasoning
   - Download: https://www.tau-nlp.org/commonsenseqa

### Data Augmentation for Reasoning

```python
def augment_with_reasoning(qa_dataset):
    """Add reasoning to simple Q&A datasets"""
    augmented = []

    for item in qa_dataset:
        # Use strong model to generate reasoning
        reasoning = generate_reasoning(
            question=item['question'],
            answer=item['answer']
        )

        augmented.append({
            'question': item['question'],
            'reasoning': reasoning,
            'answer': item['answer']
        })

    return augmented

def generate_reasoning(question: str, answer: str) -> str:
    """Generate reasoning given Q&A pair"""
    response = anthropic.messages.create(
        model="claude-3-5-sonnet-20241022",
        messages=[{
            "role": "user",
            "content": f"""Given this question and answer, generate the step-by-step reasoning that would lead to this answer:

Question: {question}
Answer: {answer}

Provide clear, logical reasoning steps."""
        }],
        max_tokens=2000
    )

    return response.content[0].text
```

---

## 🎯 Training Strategies

### Strategy 1: Progressive Reasoning Complexity

Start with simple reasoning, gradually increase complexity:

```python
# Phase 1: Simple single-step reasoning (1 week)
simple_data = filter_by_steps(dataset, max_steps=2)
model_v1 = finetune(base_model, simple_data)

# Phase 2: Multi-step reasoning (2 weeks)
medium_data = filter_by_steps(dataset, max_steps=5)
model_v2 = finetune(model_v1, medium_data)

# Phase 3: Complex reasoning (3 weeks)
complex_data = filter_by_steps(dataset, min_steps=5)
model_v3 = finetune(model_v2, complex_data)
```

### Strategy 2: Domain-Specific Reasoning

Train on specific reasoning types:

```python
reasoning_domains = {
    'mathematical': gsm8k_data + math_data,
    'logical': strategyqa_data + arc_data,
    'causal': because_data + commonsense_data,
    'code': code_reasoning_data
}

# Train specialist models
for domain, data in reasoning_domains.items():
    specialist = finetune(base_model, data)
    save_model(specialist, f'reasoning_{domain}')
```

### Strategy 3: Reasoning + RLHF

Combine reasoning finetuning with human feedback:

```python
# Step 1: Supervised finetuning on reasoning
model = finetune(base_model, reasoning_data)

# Step 2: Generate multiple reasoning paths
for problem in test_set:
    paths = [model.generate(problem) for _ in range(5)]

    # Human annotators rank the reasoning quality
    ranked = human_rank_reasoning(paths)

    # Use for preference learning (DPO/PPO)
    preference_data.append({
        'prompt': problem,
        'chosen': ranked[0],      # Best reasoning
        'rejected': ranked[-1]    # Worst reasoning
    })

# Step 3: RLHF training
model_rlhf = train_with_dpo(model, preference_data)
```

---

## 📊 Evaluation Metrics

### Reasoning Quality Metrics

```python
def evaluate_reasoning(model, test_set):
    """Comprehensive reasoning evaluation"""

    metrics = {
        'answer_accuracy': 0,
        'step_accuracy': 0,
        'logical_consistency': 0,
        'verification_rate': 0
    }

    for problem in test_set:
        response = model.generate(problem['question'])

        # 1. Final answer correctness
        answer = extract_answer(response)
        if answer == problem['correct_answer']:
            metrics['answer_accuracy'] += 1

        # 2. Step-by-step correctness
        steps = extract_steps(response)
        step_scores = [
            verify_step(step, problem)
            for step in steps
        ]
        metrics['step_accuracy'] += sum(step_scores) / len(step_scores)

        # 3. Logical consistency
        metrics['logical_consistency'] += check_consistency(steps)

        # 4. Self-verification present
        if contains_verification(response):
            metrics['verification_rate'] += 1

    # Normalize
    n = len(test_set)
    return {k: v/n for k, v in metrics.items()}
```

---

## 🚀 Quick Start Implementation

### Minimal Working Example

```python
#!/usr/bin/env python3
"""
Minimal reasoning finetuning pipeline
"""

import anthropic
import json
from typing import List, Dict

# 1. Generate reasoning dataset
def create_reasoning_dataset(questions: List[str]) -> List[Dict]:
    client = anthropic.Anthropic()
    dataset = []

    for q in questions:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"Solve step-by-step: {q}"
            }]
        )

        dataset.append({
            "messages": [
                {"role": "user", "content": q},
                {"role": "assistant", "content": response.content[0].text}
            ]
        })

    return dataset

# 2. Format for finetuning
def format_for_training(dataset: List[Dict]) -> str:
    """Convert to JSONL format"""
    lines = [json.dumps(item) for item in dataset]
    return '\n'.join(lines)

# 3. Create dataset
questions = [
    "What is 15% of 240?",
    "If a car travels 60 km in 45 minutes, what is its speed in km/h?",
    "A rectangle has length 8cm and width 5cm. What is its area and perimeter?",
    # Add more questions...
]

dataset = create_reasoning_dataset(questions)

# 4. Save for finetuning
with open('reasoning_training.jsonl', 'w') as f:
    f.write(format_for_training(dataset))

print(f"Created dataset with {len(dataset)} reasoning examples")
```

---

## 🎓 Best Practices

### 1. **Quality over Quantity**
- 1,000 high-quality reasoning examples > 10,000 poor ones
- Each step should be logically sound
- Verify final answers are correct

### 2. **Diverse Reasoning Patterns**
Include different types:
- Deductive (general → specific)
- Inductive (specific → general)
- Analogical (similar problems)
- Causal (cause → effect)

### 3. **Include Self-Verification**
Train model to check its work:
```
"Let me verify: 2(5) + 3 = 10 + 3 = 13 ✓"
```

### 4. **Show Wrong Paths**
Include examples of catching mistakes:
```
"Wait, that doesn't make sense because..."
"Let me reconsider this assumption..."
```

### 5. **Domain Coverage**
- Math (arithmetic, algebra, geometry)
- Logic (if-then, necessary/sufficient)
- Code (debugging, algorithm design)
- Science (hypothesis, experiment design)

---

## 📖 References

- **Chain-of-Thought Prompting**: Wei et al., 2022
- **Self-Taught Reasoner (STaR)**: Zelikman et al., 2022
- **Let's Verify Step by Step (PRM)**: Lightman et al., 2023
- **Self-Consistency**: Wang et al., 2022
- **Constitutional AI**: Bai et al., 2022

---

**End of Document**
