/**
 * Context Tracker Service
 * Phase 6: Context Tracking & Management
 * Date: 2025-10-17
 *
 * Core service for tracking and managing conversation context usage.
 * Accumulates token counts, calculates warnings, and provides context stats.
 */

import type {
  ContextUsage,
  ContextConfig,
  MessageTokens,
  ContextCalculation,
  ModelContext,
  ConversationModelContextRecord,
} from './types';
import { DEFAULT_CONTEXT_CONFIG } from './types';

// ============================================================================
// Context Tracker Class
// ============================================================================

export class ContextTracker {
  // Phase 7.1: Multi-model tracking
  private conversationId: string;
  private activeModelId: string | null;
  private contexts: Map<string, ModelContext>;
  private config: ContextConfig;

  constructor(
    conversationId: string,
    modelId: string | null,
    maxContextTokens: number,
    config: Partial<ContextConfig> = {},
    modelName: string = 'Unknown Model'
  ) {
    this.conversationId = conversationId;
    this.activeModelId = modelId;
    this.contexts = new Map();
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };

    // Initialize first model context
    const contextKey = this.getContextKey(modelId);
    const initialContext = this.createModelContext(
      modelId,
      modelName,
      maxContextTokens
    );
    this.contexts.set(contextKey, initialContext);

    console.log('[ContextTracker] Initialized (multi-model):', {
      conversationId,
      modelId,
      modelName,
      maxContextTokens,
      contextKey,
    });
  }

  /**
   * Generate context key for Map storage
   * Uses '__default__' for null modelId to handle conversations without specific models
   */
  private getContextKey(modelId: string | null): string {
    return modelId || '__default__';
  }

  /**
   * Create a new ModelContext instance
   */
  private createModelContext(
    modelId: string | null,
    modelName: string,
    maxContextTokens: number
  ): ModelContext {
    return {
      modelId,
      modelName,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      graphragTokens: 0,
      maxContextTokens,
      percentageUsed: 0,
      messageCount: 0,
      messages: [],
      hasWarning: false,
      warningLevel: 'none',
      firstMessageAt: null,
      lastMessageAt: null,
    };
  }

  /**
   * Get the active model's context (or throw if not found)
   */
  private getActiveContext(): ModelContext {
    const key = this.getContextKey(this.activeModelId);
    const context = this.contexts.get(key);

    if (!context) {
      console.error('[ContextTracker] ERROR: Active model context not found', {
        activeModelId: this.activeModelId,
        contextKey: key,
        availableKeys: Array.from(this.contexts.keys()),
      });
      throw new Error(`Context not found for active model: ${this.activeModelId}`);
    }

    return context;
  }

  /**
   * Add tokens from a new message exchange (works on active model)
   */
  addMessage(
    inputTokens: number,
    outputTokens: number,
    graphragTokens: number = 0
  ): ContextUsage {
    // Validate inputs
    if (inputTokens < 0 || outputTokens < 0 || graphragTokens < 0) {
      console.error('[ContextTracker] ERROR: Negative token count received', {
        inputTokens,
        outputTokens,
        graphragTokens,
        activeModelId: this.activeModelId,
      });
      return this.getUsage();
    }

    // Get active model's context
    const context = this.getActiveContext();

    const messageTokens: MessageTokens = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      graphrag_tokens: graphragTokens,
      total: inputTokens + outputTokens + graphragTokens,
    };

    // Add to history
    context.messages.push(messageTokens);
    context.messageCount++;

    // Update breakdown totals
    context.inputTokens += inputTokens;
    context.outputTokens += outputTokens;
    context.graphragTokens += graphragTokens;
    context.totalTokens += messageTokens.total;

    // Update timestamps
    const now = new Date();
    if (!context.firstMessageAt) {
      context.firstMessageAt = now;
    }
    context.lastMessageAt = now;

    // Recalculate percentage and warnings
    context.percentageUsed = this.calculatePercentage(context);
    this.updateWarningLevel(context);

    console.log('[ContextTracker] Added message to model:', {
      modelId: this.activeModelId,
      modelName: context.modelName,
      input: inputTokens,
      output: outputTokens,
      graphrag: graphragTokens,
      total: messageTokens.total,
      cumulativeTotal: context.totalTokens,
      percentage: context.percentageUsed.toFixed(1) + '%',
      messageCount: context.messageCount,
    });

    return this.getUsage();
  }

  /**
   * Calculate current percentage of context window used for a model
   */
  private calculatePercentage(context: ModelContext): number {
    if (context.maxContextTokens === 0) {
      console.warn('[ContextTracker] Max context tokens is 0 for model:', context.modelName);
      return 0;
    }
    return (context.totalTokens / context.maxContextTokens) * 100;
  }

  /**
   * Update warning level based on current percentage for a model
   */
  private updateWarningLevel(context: ModelContext): void {
    const percentage = context.percentageUsed;

    if (percentage >= this.config.highWarningThreshold) {
      context.warningLevel = 'high';
      context.hasWarning = true;
      console.warn(
        `[ContextTracker] HIGH warning threshold reached for ${context.modelName}:`,
        percentage.toFixed(1) + '%'
      );
    } else if (percentage >= this.config.mediumWarningThreshold) {
      context.warningLevel = 'medium';
      context.hasWarning = true;
      console.warn(
        `[ContextTracker] MEDIUM warning threshold reached for ${context.modelName}:`,
        percentage.toFixed(1) + '%'
      );
    } else if (percentage >= this.config.lowWarningThreshold) {
      context.warningLevel = 'low';
      context.hasWarning = true;
      console.log(
        `[ContextTracker] Low warning threshold reached for ${context.modelName}:`,
        percentage.toFixed(1) + '%'
      );
    } else {
      context.warningLevel = 'none';
      context.hasWarning = false;
    }
  }

  /**
   * Get current context usage stats (backward compatible)
   * Converts active ModelContext to ContextUsage format
   */
  getUsage(): ContextUsage {
    const context = this.getActiveContext();

    return {
      conversationId: this.conversationId,
      modelId: context.modelId,
      totalTokens: context.totalTokens,
      maxContextTokens: context.maxContextTokens,
      percentageUsed: context.percentageUsed,
      messageCount: context.messageCount,
      messages: context.messages,
      hasWarning: context.hasWarning,
      warningLevel: context.warningLevel,
      lastUpdated: context.lastMessageAt || new Date(),
    };
  }

  /**
   * Get context calculation with warning details (works on active model)
   */
  getCalculation(): ContextCalculation {
    const context = this.getActiveContext();
    const warning = this.getWarningMessage(context);

    return {
      tokens: context.totalTokens,
      percentage: context.percentageUsed,
      warningLevel: context.warningLevel,
      shouldWarn: context.hasWarning,
      message: warning,
    };
  }

  /**
   * Get warning message based on current level
   */
  private getWarningMessage(context: ModelContext): string | undefined {
    switch (context.warningLevel) {
      case 'high':
        return 'Context nearly full - start new conversation soon';
      case 'medium':
        return 'Consider summarizing or starting new conversation';
      case 'low':
        return 'Context filling up';
      default:
        return undefined;
    }
  }

  /**
   * Reset tracker (for new conversation or model)
   */
  reset(
    conversationId: string,
    modelId: string | null,
    maxContextTokens: number,
    modelName: string = 'Unknown Model'
  ): void {
    this.conversationId = conversationId;
    this.activeModelId = modelId;
    this.contexts.clear();

    const contextKey = this.getContextKey(modelId);
    const newContext = this.createModelContext(modelId, modelName, maxContextTokens);
    this.contexts.set(contextKey, newContext);

    console.log('[ContextTracker] Reset for new conversation:', {
      conversationId,
      modelId,
      modelName,
      maxContextTokens,
    });
  }

  /**
   * Switch to a different model (Phase 7.1)
   * Creates new context if model hasn't been used yet
   */
  switchModel(
    modelId: string | null,
    maxContextTokens: number,
    modelName: string = 'Unknown Model'
  ): void {
    const contextKey = this.getContextKey(modelId);

    // Check if context already exists for this model
    if (!this.contexts.has(contextKey)) {
      console.log('[ContextTracker] Creating new context for model:', {
        modelId,
        modelName,
        maxContextTokens,
      });
      const newContext = this.createModelContext(modelId, modelName, maxContextTokens);
      this.contexts.set(contextKey, newContext);
    } else {
      console.log('[ContextTracker] Switching to existing context for model:', {
        modelId,
        modelName,
        existingTokens: this.contexts.get(contextKey)?.totalTokens,
      });
    }

    this.activeModelId = modelId;

    const context = this.getActiveContext();
    console.log('[ContextTracker] Model switched:', {
      modelId,
      modelName: context.modelName,
      totalTokens: context.totalTokens,
      percentageUsed: context.percentageUsed.toFixed(1) + '%',
      messageCount: context.messageCount,
    });
  }

  /**
   * Get all model contexts (Phase 7.1)
   */
  getAllModelContexts(): Map<string, ModelContext> {
    return new Map(this.contexts);
  }

  /**
   * Get specific model's context (Phase 7.1)
   */
  getModelContext(modelId: string | null): ModelContext | null {
    const key = this.getContextKey(modelId);
    return this.contexts.get(key) || null;
  }

  /**
   * Restore context from database record (Phase 7.1)
   * Used when loading existing conversation to restore token counts
   */
  restoreFromDatabase(record: ConversationModelContextRecord, maxContextTokens: number, modelName: string): void {
    const contextKey = this.getContextKey(record.model_id);

    const restoredContext: ModelContext = {
      modelId: record.model_id,
      modelName,
      totalTokens: record.total_tokens,
      inputTokens: record.input_tokens,
      outputTokens: record.output_tokens,
      graphragTokens: record.graphrag_tokens,
      maxContextTokens,
      percentageUsed: (record.total_tokens / maxContextTokens) * 100,
      messageCount: record.message_count,
      messages: [], // Message history not stored in DB, only totals
      hasWarning: false,
      warningLevel: 'none',
      firstMessageAt: record.first_message_at ? new Date(record.first_message_at) : null,
      lastMessageAt: record.last_message_at ? new Date(record.last_message_at) : null,
    };

    // Update warning level based on percentage
    this.updateWarningLevel(restoredContext);

    this.contexts.set(contextKey, restoredContext);

    console.log('[ContextTracker] Restored context from database:', {
      modelId: record.model_id,
      modelName,
      totalTokens: record.total_tokens,
      percentageUsed: restoredContext.percentageUsed.toFixed(1) + '%',
      messageCount: record.message_count,
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate GraphRAG token usage based on number of sources
 */
export function estimateGraphRAGTokens(
  numSources: number,
  tokensPerSource: number = DEFAULT_CONTEXT_CONFIG.graphragTokensPerSource
): number {
  return numSources * tokensPerSource;
}

/**
 * Get warning color for UI
 */
export function getWarningColor(level: 'none' | 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    case 'low':
      return 'yellow';
    default:
      return 'green';
  }
}
