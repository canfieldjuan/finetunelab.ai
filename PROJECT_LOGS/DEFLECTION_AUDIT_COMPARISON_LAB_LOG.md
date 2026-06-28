# Deflection Audit Comparison Lab Log

## Why this exists

The Model Comparison Lab is currently a manual model-vs-model testing surface. It should stay that way for now.

This note couples the lab to the Deflection Audit Report workflow without turning it into an Audit-specific evaluator, benchmark runner, or RAG test harness yet.

## What the lab does today

- Sends the same prompt to 2-4 registered models.
- Shows responses side by side.
- Tracks response latency and token metadata when the chat API emits it.
- Lets a reviewer score each response on clarity, accuracy, conciseness, and overall quality.
- Lets a reviewer mark a response as preferred or rejected.
- Exports the comparison as JSONL preference data.
- Uses the same `/api/chat` route as the main chat surface, with `modelId` and `forceNonStreaming`.

## What we compare

Use the lab to compare model behavior, not Audit product logic.

Good comparisons:

- Base model vs fine-tuned model.
- Local model vs hosted model.
- LM Studio endpoint vs vLLM endpoint, when both are registered.
- Small fast model vs larger quality model.
- Qwen-family model vs Llama-family model.
- Candidate model for Audit report writing vs current default model.

Avoid using this lab as proof that the Audit product is correct. It is a response-quality inspection surface, not the Audit scoring engine.

## How it supports the Deflection Audit Report

The Deflection Audit Report needs models that can explain the report without flattening the product language.

Use the lab to test whether a model can:

- Preserve key terms like deflection, resolution, false deflection, owner lane, repeat resolution spend, and preventable overage.
- Explain the report shape: repeated issue, cost, evidence, probable owner lane, and recommended fix.
- Describe the shift from a ranked FAQ/content list to an owner-assigned operating report.
- Write plainly without sounding robotic, polished, or generically corporate.
- Keep the point of the Audit intact: support is paying for repeated symptoms that another team often owns.
- Ask useful questions about how a team currently resolves the repeated issues the Audit surfaces.

## Current Audit-linked prompt examples

Use prompts like these when comparing candidate models:

```text
Explain the Deflection Audit Report to a Head of Support in plain language. Keep the terms deflection, resolution, owner lane, and false deflection intact.
```

```text
Write a LinkedIn post about why repeated support questions often belong to Product, Billing, or Engineering. Make the Deflection Audit relevant without making the post sound like a pitch.
```

```text
Summarize this report shape: repeated issue, monthly cost, evidence, probable owner lane, recommended fix. Explain why this is more useful than a ranked list of FAQs to write.
```

```text
Write ad copy for a Head of Support who is paying for the same unresolved issue every month. Keep the language direct, not corporate.
```

## What it does not do yet

- It does not run a full Audit benchmark suite.
- It does not automatically score whether a response is faithful to product truth.
- It does not inject the full Audit RAG context by default.
- It does not compare prompt variants against the same model.
- It does not run a judge model.
- It does not decide which model should ship.

## Near-term use

For now, use the lab as a judgment aid:

1. Pick 2-4 candidate models.
2. Run the same Audit-related prompt.
3. Compare whether each model preserves the product terms and owner-lane framing.
4. Rate the responses manually.
5. Export JSONL when the comparison is useful for later preference data or fine-tune examples.

The useful output is not just "which answer is nicer." The useful output is which model best preserves the Audit's core claim: repeated support demand is often a measurable operational leak owned outside Support.
