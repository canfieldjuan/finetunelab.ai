# Dataset Manager Tool: Evaluation and Enhancement Plan

**Tool:** `dataset-manager`
**Version:** 1.0.0
**Date:** October 21, 2025

## 1. Initial Evaluation

The `dataset-manager` tool provides foundational features for interacting with conversation data stored in a Supabase database. It allows users to list, get statistics for, validate, and export datasets.

### Strengths:
- **Core Functionality:** Implements the most critical features for a dataset management tool (`list`, `stats`, `export`, `validate`).
- **Clear Structure:** The code is well-organized into `index.ts` (tool definition), `dataset.service.ts` (business logic), `types.ts`, and `dataset.config.ts`.
- **Basic Validation:** Includes error handling for invalid operations and parameters.

### Weaknesses & Opportunities:
- **Performance Bottleneck:** The `listDatasets` function exhibits a classic "N+1 query problem," executing numerous queries for each conversation. This will lead to severe performance degradation and potential database strain as the number of conversations increases.
- **Limited Filtering:** Filtering capabilities are restricted to date ranges and conversation IDs, preventing more sophisticated dataset curation.
- **Incomplete Data Export:** Exported data lacks crucial evaluation metrics (ratings, success status), limiting its usefulness for targeted model training.
- **Read-Only Operations:** The tool lacks `delete` or `merge` capabilities, which are essential for dataset lifecycle management.

## 2. Three-Phase Enhancement Plan

To address these limitations, I propose the following enhancement plan, which prioritizes fixing the critical performance issue first.

### Phase 1: Performance and Query Optimization (Critical)

This phase will resolve the N+1 query problem in the `listDatasets` function.

- **Action 1.1:** Create a new SQL database function named `get_conversation_stats` that efficiently aggregates all required statistics (message counts, assistant counts, evaluation counts) for a given user in a single query.
- **Action 1.2:** Modify the `listDatasets` method in `dataset.service.ts` to call the new database function via `supabase.rpc()`. This will replace the inefficient loop with a single, performant database call.
- **Action 1.3:** Add comprehensive debug logging to the service layer to monitor query performance and parameters.
- **Action 1.4:** Enhance the existing test suite to validate the correctness and performance of the new implementation.

### Phase 2: Advanced Filtering and Data Enrichment

This phase will expand the tool's data filtering and export capabilities.

- **Action 2.1:** Add `min_rating` and `success_only` filter options to the `DatasetFilter` interface.
- **Action 2.2:** Update the `exportDataset` function to perform a `JOIN` with the `message_evaluations` table, enriching the exported records with `rating`, `success`, `failure_tags`, and `notes`.
- **Action 2.3:** Implement the logic for the new advanced filters in the `exportDataset` and `getDatasetStats` functions.

### Phase 3: Advanced Operations - `delete` and `merge`

This phase will introduce write operations for dataset curation.

- **Action 3.1:** Implement a `delete` operation to programmatically remove conversations based on a filter, with a built-in confirmation step to prevent accidental data loss.
- **Action 3.2:** Implement a `merge` operation to combine multiple conversations into a single, larger dataset.

---

I will now proceed with Phase 1.
