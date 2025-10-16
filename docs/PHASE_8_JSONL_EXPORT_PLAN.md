# Phase 8: JSONL Export for LLM Training

**Feature:** Export conversations with metrics in JSONL format for LLM fine-tuning
**Estimated Time:** 2-3 hours
**Priority:** HIGH - Enables training pipeline
**Status:** Planning Complete - Ready for Implementation

---

## Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [JSONL Format Specification](#jsonl-format-specification)
4. [Implementation Plan](#implementation-plan)
5. [Verification Checklist](#verification-checklist)
6. [Testing Strategy](#testing-strategy)

---

## Overview

### Objective
Create JSONL export formatter to export conversations with all captured metrics (from Phase 7) in formats compatible with OpenAI and Anthropic fine-tuning APIs.

### Success Criteria
- Export conversations in valid JSONL format (one JSON object per line)
- Include all Phase 7 metrics (latency, tokens, tools, errors, evaluations)
- Support both OpenAI and Anthropic fine-tuning formats
- Integrate with existing export system
- No breaking changes to current export functionality

### Key Principle
**Never assume - always verify before implementing**

---

## Current State Analysis

### Existing Export System (Verified)

**Location:** `lib/export/`

**Current Components:**
- `exportService.ts` - Main export orchestration
- `formatters/jsonFormatter.ts` - Standard JSON export
- `formatters/markdownFormatter.ts` - Markdown export
- `formatters/txtFormatter.ts` - Plain text export
- `types.ts` - Type definitions

**Current Export Formats:**
```typescript
export type ExportFormat = 'pdf' | 'markdown' | 'json' | 'txt' | 'html';
```

**Integration Pattern:**
1. Format generators implement `FormatGenerator` interface
2. Registered in exportService via `registerFormatter()`
3. Exported via `lib/export/formatters/index.ts`

### Database Schema with Metrics (Phase 7)

**Messages Table Columns:**
```sql
-- Core fields
id UUID
conversation_id UUID
user_id UUID
role TEXT ('user' | 'assistant')
content TEXT
created_at TIMESTAMPTZ

-- Phase 7 metrics
latency_ms INTEGER
input_tokens INTEGER
output_tokens INTEGER
tools_called JSONB
tool_success BOOLEAN
fallback_used BOOLEAN
error_type TEXT
```

**Message Evaluations Table:**
```sql
id UUID
message_id UUID
evaluator_id UUID
rating INTEGER (1-5)
success BOOLEAN
failure_tags TEXT[]
notes TEXT
expected_behavior TEXT
actual_behavior TEXT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

## JSONL Format Specification

### OpenAI Fine-Tuning Format

**Standard Format (Chat Completions):**
```jsonl
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```

**With Metrics (Extended Format):**
```jsonl
{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}], "metrics": {"latency_ms": 1234, "input_tokens": 100, "output_tokens": 50, "tools_called": [...], "tool_success": true}, "evaluation": {"rating": 5, "success": true}}
```

### Anthropic Fine-Tuning Format

**Standard Format:**
```jsonl
{"prompt": "Human: ...\n\nAssistant:", "completion": " ..."}
{"prompt": "Human: ...\n\nAssistant:", "completion": " ..."}
```

**With Metrics (Extended Format):**
```jsonl
{"prompt": "Human: ...\n\nAssistant:", "completion": " ...", "metrics": {"latency_ms": 1234, "input_tokens": 100, "output_tokens": 50}, "evaluation": {"rating": 5}}
```

### Custom Training Format (Full Metrics)

**Complete format with all metrics:**
```jsonl
{"conversation_id": "uuid", "turn": 1, "messages": {"user": "...", "assistant": "..."}, "metrics": {"latency_ms": 1234, "input_tokens": 100, "output_tokens": 50, "tools_called": [{"name": "calculator", "success": true}], "tool_success": true, "error_type": null}, "evaluation": {"rating": 5, "success": true, "failure_tags": [], "notes": "Perfect response"}, "timestamp": "2025-10-13T12:00:00Z"}
```

---

## Implementation Plan

### Phase 8.1: Update Type Definitions

**File:** `lib/export/types.ts`
**Line:** 12

**Change: Add 'jsonl' to ExportFormat type**
```typescript
// Before:
export type ExportFormat = 'pdf' | 'markdown' | 'json' | 'txt' | 'html';

// After:
export type ExportFormat = 'pdf' | 'markdown' | 'json' | 'txt' | 'html' | 'jsonl';
```

**Add JSONL-specific options:**
```typescript
/**
 * JSONL export sub-format for LLM training
 */
export type JsonlSubFormat = 'openai' | 'anthropic' | 'full';

/**
 * Extended export options for JSONL
 */
export interface JsonlExportOptions extends ExportOptions {
  /** Sub-format for JSONL export */
  jsonlFormat?: JsonlSubFormat;

  /** Include Phase 7 metrics */
  includeMetrics?: boolean;

  /** Include human evaluations */
  includeEvaluations?: boolean;
}
```

**Verification Steps:**
1. Read current types.ts file
2. Add 'jsonl' to ExportFormat union type
3. Add JsonlSubFormat type
4. Add JsonlExportOptions interface
5. Verify TypeScript compiles

---

### Phase 8.2: Create JSONL Formatter

**File:** `lib/export/formatters/jsonlFormatter.ts` (NEW FILE)

**Implementation:**
```typescript
/**
 * JSONL Format Generator for LLM Training
 *
 * Generates JSONL (JSON Lines) exports with metrics for fine-tuning.
 * Supports OpenAI, Anthropic, and full custom formats.
 *
 * @module lib/export/formatters/jsonlFormatter
 */

import {
  FormatGenerator,
  ConversationData,
  ExportOptions,
  JsonlSubFormat,
} from '../types';
import { supabase } from '@/lib/supabaseClient';

/**
 * JSONL formatter for LLM training
 */
export class JsonlFormatter implements FormatGenerator {
  private subFormat: JsonlSubFormat;
  private includeMetrics: boolean;
  private includeEvaluations: boolean;

  constructor(
    subFormat: JsonlSubFormat = 'full',
    includeMetrics: boolean = true,
    includeEvaluations: boolean = true
  ) {
    this.subFormat = subFormat;
    this.includeMetrics = includeMetrics;
    this.includeEvaluations = includeEvaluations;
  }

  /**
   * Generate JSONL export
   */
  async generate(
    conversations: ConversationData[],
    options: ExportOptions
  ): Promise<string> {
    const lines: string[] = [];

    for (const conv of conversations) {
      // Load evaluations if needed
      const evaluations = this.includeEvaluations
        ? await this.loadEvaluations(conv.messages.map(m => m.id))
        : {};

      // Process conversation turns
      const turns = this.extractTurns(conv.messages);

      for (const turn of turns) {
        const line = this.formatTurn(turn, evaluations, conv.id);
        if (line) {
          lines.push(line);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract conversation turns (user + assistant pairs)
   */
  private extractTurns(messages: MessageData[]): ConversationTurn[] {
    const turns: ConversationTurn[] = [];
    let currentUser: MessageData | null = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        currentUser = msg;
      } else if (msg.role === 'assistant' && currentUser) {
        turns.push({
          user: currentUser,
          assistant: msg,
        });
        currentUser = null;
      }
    }

    return turns;
  }

  /**
   * Format a single turn based on sub-format
   */
  private formatTurn(
    turn: ConversationTurn,
    evaluations: Record<string, any>,
    conversationId: string
  ): string | null {
    switch (this.subFormat) {
      case 'openai':
        return this.formatOpenAI(turn, evaluations);
      case 'anthropic':
        return this.formatAnthropic(turn, evaluations);
      case 'full':
        return this.formatFull(turn, evaluations, conversationId);
      default:
        return null;
    }
  }

  /**
   * Format for OpenAI fine-tuning
   */
  private formatOpenAI(
    turn: ConversationTurn,
    evaluations: Record<string, any>
  ): string {
    const obj: any = {
      messages: [
        { role: 'user', content: turn.user.content },
        { role: 'assistant', content: turn.assistant.content },
      ],
    };

    if (this.includeMetrics && turn.assistant.metadata) {
      obj.metrics = this.extractMetrics(turn.assistant.metadata);
    }

    if (this.includeEvaluations && evaluations[turn.assistant.id]) {
      obj.evaluation = evaluations[turn.assistant.id];
    }

    return JSON.stringify(obj);
  }

  /**
   * Format for Anthropic fine-tuning
   */
  private formatAnthropic(
    turn: ConversationTurn,
    evaluations: Record<string, any>
  ): string {
    const obj: any = {
      prompt: `Human: ${turn.user.content}\n\nAssistant:`,
      completion: ` ${turn.assistant.content}`,
    };

    if (this.includeMetrics && turn.assistant.metadata) {
      obj.metrics = this.extractMetrics(turn.assistant.metadata);
    }

    if (this.includeEvaluations && evaluations[turn.assistant.id]) {
      obj.evaluation = evaluations[turn.assistant.id];
    }

    return JSON.stringify(obj);
  }

  /**
   * Format full training format with all metrics
   */
  private formatFull(
    turn: ConversationTurn,
    evaluations: Record<string, any>,
    conversationId: string
  ): string {
    const obj: any = {
      conversation_id: conversationId,
      timestamp: turn.assistant.created_at.toISOString(),
      messages: {
        user: turn.user.content,
        assistant: turn.assistant.content,
      },
    };

    if (this.includeMetrics && turn.assistant.metadata) {
      obj.metrics = this.extractMetrics(turn.assistant.metadata);
    }

    if (this.includeEvaluations && evaluations[turn.assistant.id]) {
      obj.evaluation = evaluations[turn.assistant.id];
    }

    return JSON.stringify(obj);
  }

  /**
   * Extract metrics from message metadata
   */
  private extractMetrics(metadata: Record<string, unknown>): any {
    return {
      latency_ms: metadata.latency_ms || null,
      input_tokens: metadata.input_tokens || null,
      output_tokens: metadata.output_tokens || null,
      tools_called: metadata.tools_called || null,
      tool_success: metadata.tool_success || null,
      error_type: metadata.error_type || null,
    };
  }

  /**
   * Load evaluations for messages
   */
  private async loadEvaluations(
    messageIds: string[]
  ): Promise<Record<string, any>> {
    if (messageIds.length === 0) return {};

    const { data, error } = await supabase
      .from('message_evaluations')
      .select('message_id, rating, success, failure_tags, notes')
      .in('message_id', messageIds);

    if (error || !data) return {};

    return data.reduce((acc: any, eval: any) => {
      acc[eval.message_id] = {
        rating: eval.rating,
        success: eval.success,
        failure_tags: eval.failure_tags || [],
        notes: eval.notes || null,
      };
      return acc;
    }, {});
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'jsonl';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'application/jsonl';
  }
}

/**
 * Helper interface for conversation turns
 */
interface ConversationTurn {
  user: MessageData;
  assistant: MessageData;
}

// Import MessageData type
import { MessageData } from '../types';
```

**Verification Steps:**
1. Create file with complete implementation
2. Verify TypeScript compiles
3. Test with sample data
4. Verify JSONL format (one JSON per line)

---

### Phase 8.3: Update Formatter Index

**File:** `lib/export/formatters/index.ts`
**Line:** 12

**Change: Export JSONL formatter**
```typescript
export { MarkdownFormatter } from './markdownFormatter';
export { JsonFormatter } from './jsonFormatter';
export { TxtFormatter } from './txtFormatter';
export { JsonlFormatter } from './jsonlFormatter'; // NEW
```

**Verification Steps:**
1. Read current index.ts
2. Add export line
3. Verify no import errors

---

### Phase 8.4: Update ExportService to Load Metrics

**File:** `lib/export/exportService.ts`
**Line:** 172-177

**Current Query:**
```typescript
const { data: allMessages, error: msgError } = await supabase
  .from('messages')
  .select('id, conversation_id, role, content, created_at, metadata')
  .in('conversation_id', conversationIds)
  .order('created_at', { ascending: true });
```

**Updated Query (include metrics columns):**
```typescript
const { data: allMessages, error: msgError } = await supabase
  .from('messages')
  .select(`
    id, conversation_id, role, content, created_at, metadata,
    latency_ms, input_tokens, output_tokens, tools_called,
    tool_success, fallback_used, error_type
  `)
  .in('conversation_id', conversationIds)
  .order('created_at', { ascending: true });
```

**Update Message Mapping (lines 212-227):**
```typescript
// Map messages with optional metadata
if (!options.includeMetadata) {
  messages = messages.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    created_at: new Date(msg.created_at),
  }));
} else {
  messages = messages.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    created_at: new Date(msg.created_at),
    metadata: {
      ...msg.metadata,
      // Add Phase 7 metrics to metadata
      latency_ms: msg.latency_ms,
      input_tokens: msg.input_tokens,
      output_tokens: msg.output_tokens,
      tools_called: msg.tools_called,
      tool_success: msg.tool_success,
      fallback_used: msg.fallback_used,
      error_type: msg.error_type,
    },
  }));
}
```

**Verification Steps:**
1. Read current exportService.ts
2. Update query to include metrics columns
3. Update message mapping to include metrics in metadata
4. Verify TypeScript compiles

---

### Phase 8.5: Register JSONL Formatter

**File:** `app/api/export/generate/route.ts`

**Need to verify current registration pattern, then add:**
```typescript
import { JsonlFormatter } from '@/lib/export/formatters';

// Register formatters
exportService.registerFormatter('jsonl', new JsonlFormatter('full', true, true));
```

**Verification Steps:**
1. Read current generate route
2. Identify formatter registration pattern
3. Add JSONL formatter registration
4. Verify API works

---

## Verification Checklist

### Code Changes
- [ ] Update ExportFormat type to include 'jsonl'
- [ ] Add JsonlSubFormat and JsonlExportOptions types
- [ ] Create jsonlFormatter.ts with complete implementation
- [ ] Export JsonlFormatter from formatters/index.ts
- [ ] Update exportService to load metrics columns
- [ ] Update message mapping to include metrics in metadata
- [ ] Register JSONL formatter in API route
- [ ] TypeScript compilation succeeds

### Functional Testing
- [ ] Export single conversation to JSONL (OpenAI format)
- [ ] Export single conversation to JSONL (Anthropic format)
- [ ] Export single conversation to JSONL (full format)
- [ ] Export multiple conversations
- [ ] Verify one JSON object per line
- [ ] Verify metrics included when enabled
- [ ] Verify evaluations included when enabled
- [ ] Verify file downloads correctly
- [ ] Verify MIME type is correct

### Data Validation
- [ ] Each line is valid JSON
- [ ] OpenAI format matches specification
- [ ] Anthropic format matches specification
- [ ] Metrics match database values
- [ ] Evaluations match database values
- [ ] User-assistant turn pairing is correct
- [ ] Timestamps are ISO format
- [ ] No data loss during export

---

## Testing Strategy

### Unit Tests

**Test jsonlFormatter.ts:**
```typescript
describe('JsonlFormatter', () => {
  it('should format OpenAI training data', async () => {
    // Test OpenAI format
  });

  it('should format Anthropic training data', async () => {
    // Test Anthropic format
  });

  it('should format full metrics data', async () => {
    // Test full format
  });

  it('should extract conversation turns', () => {
    // Test turn extraction
  });

  it('should include metrics when enabled', async () => {
    // Test metrics inclusion
  });

  it('should include evaluations when enabled', async () => {
    // Test evaluation inclusion
  });

  it('should return correct MIME type', () => {
    expect(formatter.getMimeType()).toBe('application/jsonl');
  });

  it('should return correct extension', () => {
    expect(formatter.getExtension()).toBe('jsonl');
  });
});
```

### Integration Tests

1. **End-to-End Export:**
   - Create test conversation with metrics
   - Export to JSONL
   - Validate format
   - Clean up

2. **Large Dataset:**
   - Export 100+ conversations
   - Verify performance
   - Check memory usage

3. **Edge Cases:**
   - Conversation with no assistant responses
   - Messages with null metrics
   - Messages with no evaluations
   - System messages mixed in

### Manual Testing

1. Export real conversation
2. Open JSONL file
3. Verify each line is valid JSON
4. Check metrics are correct
5. Upload to OpenAI/Anthropic for validation

---

## Rollback Plan

### If Implementation Fails
1. Remove JsonlFormatter from formatters/index.ts
2. Revert types.ts changes
3. Revert exportService.ts changes
4. Clear .next cache
5. Restart dev server

### Backward Compatibility
- All changes are additive
- Existing export formats unaffected
- Metrics columns are nullable (Phase 7)
- Can deploy incrementally

---

## Next Steps After Phase 8

1. **Phase 9: Evaluation UI** - Add rating/tagging interface to messages
2. **Phase 10: Analytics Dashboard** - Visualize metrics and trends
3. **Phase 11: Automated Training** - CI/CD pipeline for model fine-tuning

---

**Document Version:** 1.0
**Created:** 2025-10-13
**Last Updated:** 2025-10-13
**Status:** Ready for Implementation
