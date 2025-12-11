# Atlas v2 Dataset Curation Log

## Project Context

**Goal:** Create a new training dataset for FineTuneLab's assistant model that teaches domain knowledge directly rather than through Q&A format.

**Target Model:** Mistral 7B Instruct

**Problem with v1 (atlas_no_think.jsonl):**
- Q&A format dilutes signal with repetitive patterns ("That's a great question!")
- Model learns to answer questions rather than internalize product knowledge
- Training showed loss decrease but model didn't adopt specific recommendations

**New Approach:** Instructional narratives that read like internal documentation - first-person walkthroughs that teach the model to KNOW the product, not just answer about it.

---

## Dataset Format Specification

### Unified JSON Format
```json
{
  "type": "fact | narrative | procedure",
  "category": "<category_name>",
  "topic": "<specific_topic>",
  "content": "<the actual knowledge content>"
}
```

### Types
- **fact**: Discrete information (pricing, limits, supported formats, yes/no capabilities)
- **narrative**: Feature explanations, concepts, how things work together
- **procedure**: Step-by-step workflows, how to accomplish tasks
- **correction**: Common misconceptions and their corrections ("Users often think X, but Y")

### Categories (from v1 extraction)
- workflow_training
- workflow_batch_testing
- workflow_dataset
- workflow_deployment
- navigation_components
- troubleshooting
- feature_analytics
- feature_predictions
- feature_chat
- settings_secrets
- settings_general
- pricing_billing

### Voice/Tone Guidelines
- Direct, declarative statements
- No questions, no filler phrases
- Use exact UI names: "Ctrl+K", "Training > Monitor", "Secrets Vault"
- Include relationships between features
- State constraints and limits explicitly
- Consistent structure across all entries

---

## Source Files

**Original dataset:** `/home/juan-canfield/Desktop/New Folder/atlas_no_think.jsonl` (2,093 entries)

**Extracted responses only:** `/home/juan-canfield/Desktop/New Folder/atlas_responses_only.jsonl` (2,105 responses)

**Categorized (all):** `/home/juan-canfield/Desktop/New Folder/atlas_categorized.jsonl`

**FineTuneLab-specific only:** `/home/juan-canfield/Desktop/New Folder/atlas_finetunelab_only.jsonl` (1,520 responses)

**Split by category:** `/home/juan-canfield/Desktop/New Folder/categories/`
- navigation_components.jsonl (395)
- feature_analytics.jsonl (255)
- workflow_training.jsonl (191)
- feature_chat.jsonl (167)
- workflow_batch_testing.jsonl (97)
- settings_secrets.jsonl (89)
- pricing_billing.jsonl (77)
- troubleshooting.jsonl (59)
- workflow_dataset.jsonl (56)
- feature_predictions.jsonl (47)
- workflow_deployment.jsonl (45)
- settings_general.jsonl (42)

**Removed (external ML concepts):** `/home/juan-canfield/Desktop/New Folder/atlas_removed.jsonl` (585 responses)

---

## Curation Progress

### Output File
`/home/juan-canfield/Desktop/New Folder/atlas_v2_curated.jsonl`

### Progress by Category

| Category | Source Count | Curated | Status |
|----------|--------------|---------|--------|
| settings_general | 42 | 19 | DONE |
| workflow_deployment | 45 | 24 | DONE |
| feature_predictions | 47 | 25 | DONE |
| workflow_dataset | 56 | 23 | DONE |
| troubleshooting | 59 | 26 | DONE |
| pricing_billing | 77 | 23 | DONE |
| settings_secrets | 89 | 24 | DONE |
| workflow_batch_testing | 97 | 23 | DONE |
| feature_chat | 167 | 13 | DONE |
| workflow_training | 191 | 90 | DONE |
| feature_analytics | 255 | 41 | DONE |
| navigation_components | 395 | 41 | DONE |

**Total Curated:** 519 entries (after augmentation)

### Type Breakdown (Final)
| Type | Count | % |
|------|-------|---|
| Narrative | 188 | 36% |
| Fact | 183 | 35% |
| Procedure | 110 | 21% |
| Correction | 38 | 7% |

---

## Session Log

### Session 1 - 2024-12-10
- Extracted 2,105 responses from original dataset
- Categorized into 16 categories
- Filtered to 1,520 FineTuneLab-specific responses (removed 585 external ML)
- Split into 12 category files
- Defined new format specification
- Starting with smallest file: settings_general.jsonl (42 entries)

### Session 2 - 2024-12-10 (continued)
- Completed all 12 categories
- Total source entries processed: 1,520
- Total curated entries produced: 359
- Curation ratio: ~4.2:1 (heavy duplication and external ML content removed)
- workflow_training had most unique content (90 curated from 191)
- feature_analytics/navigation_components had most duplication (~6-10:1 ratio)

**Key observations during curation:**
- Heavy duplication in source: same answers repeated 4-15x
- External ML code (drift detection, medical summarization) filtered out
- Consistent patterns: navigation locations, "no terminal logs", "no integrations"
- Rich unique content: training configs, GPU selection, cost tracking, metrics interpretation

**Curation Complete!**

### Session 3 - 2024-12-10 (augmentation)
- Added procedure entries to fix type imbalance (was 9% procedures, now 21%)
- Added troubleshooting procedures with FineTune Lab UI guidance
- Added content from user recordings: GraphRAG, settings, billing, predictions
- Fixed brand name: "FineTuneLab" → "FineTune Lab"
- Converted to Mistral 7B Instruct format

**Augmentation decisions:**
- Tested paraphrase variations - rejected (too similar, low value)
- Tested contextual combinations - rejected (just concatenation)
- Tested scenario-based entries - marginal value
- **Adopted correction pairs** - high value, teaches model to handle misconceptions

Generated 38 correction pairs using o3-mini for high-confusion facts:
- Billing/costs misconceptions
- Platform scope (not for production)
- Feature limitations (no terminal, no integrations)
- Workflow constraints (can't modify running jobs)
- RunPod relationship

---

## Output Files

**Curated dataset:** `/home/juan-canfield/Desktop/New Folder/atlas_v2_curated.jsonl` (519 entries)

**Mistral format:** `/home/juan-canfield/Desktop/New Folder/atlas_v2_mistral.jsonl` (519 entries, shuffled)

**Mistral format spec:**
```
<s>[INST] {instruction_by_type} [/INST] {content}</s>
```

---

## What's Missing (Value-Add Opportunities)

### High Value - Requires User Input
1. **Error messages & recovery** - What specific errors appear in the UI? What should users do?
2. **Edge cases** - What happens when you hit RunPod limits? When deployment fails?
3. **New features** - Any features added since dataset creation?
4. **Real user confusion points** - Support tickets, common questions from actual users

### Medium Value - Can Generate with LLM
1. **More correction pairs** - Currently 38, could expand to 60-80 for more misconception coverage
2. **Comparison entries** - "Unlike [competitor/assumption], FineTune Lab does X"
3. **Conditional guidance** - "If you see X, do Y. If you see Z, do W."

### Low Value - Skip
- Paraphrase variations (tested, rejected - too similar)
- Simple concatenation of facts (no new signal)
- Q&A format (goes against v2 approach)

---

## Notes for Context Compaction

When resuming this work:
1. Check this log file for current progress
2. Curated file: `/home/juan-canfield/Desktop/New Folder/atlas_v2_curated.jsonl`
3. Mistral format: `/home/juan-canfield/Desktop/New Folder/atlas_v2_mistral.jsonl`
4. Use correction pairs for augmentation (proven high value)
5. Target model is Mistral 7B Instruct
6. 519 entries ready for training
