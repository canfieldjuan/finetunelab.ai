/**
 * Context Tracking Types
 * Phase 6: Context Tracking & Management
 * Date: 2025-10-17
 *
 * Defines interfaces for tracking conversation context usage
 * and managing token accumulation across messages.
 */

// ============================================================================
// Token Tracking Types
// ============================================================================

/**
 * Represents token usage for a single message exchange
 */
export interface MessageTokens {
  input_tokens: number;
  output_tokens: number;
  graphrag_tokens: number; // Estimated tokens from RAG context injection
  total: number; // Sum of all tokens for this message
}

/**
 * Accumulated context usage for entire conversation
 */
export interface ContextUsage {
  conversationId: string;
  modelId: string | null;

  // Token counts
  totalTokens: number;           // Running total
  maxContextTokens: number;      // Model's context window size
  percentageUsed: number;        // 0-100

  // Message breakdown
  messageCount: number;
  messages: MessageTokens[];     // History of token usage per message

  // Status flags
  hasWarning: boolean;           // Any warning active
  warningLevel: 'none' | 'low' | 'medium' | 'high';

  // Timestamps
  lastUpdated: Date;
}

/**
 * Configuration for context tracking behavior
 */
export interface ContextConfig {
  // Warning thresholds (percentages)
  lowWarningThreshold: number;    // Default: 70%
  mediumWarningThreshold: number; // Default: 85%
  highWarningThreshold: number;   // Default: 95%

  // Estimation factors
  graphragTokensPerSource: number; // Default: 500
  systemPromptEstimate: number;    // Default: 500
  toolDefinitionEstimate: number;  // Default: 100 per tool

  // Display preferences
  showRealTimeUpdates: boolean;    // Default: true
  showDetailedBreakdown: boolean;  // Default: false
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  lowWarningThreshold: 70,
  mediumWarningThreshold: 85,
  highWarningThreshold: 95,
  graphragTokensPerSource: 500,
  systemPromptEstimate: 500,
  toolDefinitionEstimate: 100,
  showRealTimeUpdates: true,
  showDetailedBreakdown: false,
};

// ============================================================================
// Per-Model Context Tracking (Phase 7.1)
// ============================================================================

/**
 * Context usage for a single model within a conversation
 */
export interface ModelContext {
  modelId: string | null;
  modelName: string;

  // Token tracking
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  graphragTokens: number;

  // Capacity
  maxContextTokens: number;
  percentageUsed: number;

  // Message tracking
  messageCount: number;
  messages: MessageTokens[];

  // Status
  hasWarning: boolean;
  warningLevel: 'none' | 'low' | 'medium' | 'high';

  // Timestamps
  firstMessageAt: Date | null;
  lastMessageAt: Date | null;
}

/**
 * All model contexts for a conversation
 */
export interface ConversationModelContexts {
  conversationId: string;
  activeModelId: string | null;
  contexts: Record<string, ModelContext>; // key: modelId or '__default__'
}

/**
 * Database record from conversation_model_contexts table
 */
export interface ConversationModelContextRecord {
  id: string;
  conversation_id: string;
  model_id: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  graphrag_tokens: number;
  message_count: number;
  first_message_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Return type for context calculations
 */
export interface ContextCalculation {
  tokens: number;
  percentage: number;
  warningLevel: 'none' | 'low' | 'medium' | 'high';
  shouldWarn: boolean;
  message?: string; // Warning message if applicable
}

// ============================================================================
// Context Injection Types (Phase: Context Injection)
// Date: 2025-10-24
// ============================================================================

/**
 * User profile context for injection (35 tokens)
 */
export interface UserProfileContext {
  name: string;
  timezone: string;
  locale: string;
  role?: string;
  company?: string;
  responseLength: 'concise' | 'balanced' | 'detailed';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Feature flags and permissions context (30-50 tokens)
 */
export interface FeatureFlagsContext {
  enabledFeatures: string[];
  plan: string;
  permissions: {
    canCreateTrainingJobs: boolean;
    canAccessAdvancedFeatures: boolean;
  };
  limits: {
    apiCallsRemaining: number;
    apiCallsLimit: number;
    percentUsed: number;
  };
}

/**
 * Recent activity context (0-100 tokens conditional)
 */
export interface RecentActivityContext {
  recentFiles: string[];
  recentConversations: Array<{ topic: string; date: string }>;
  activeProject?: string;
}

/**
 * Combined conditional context
 */
export interface ConditionalContext {
  profile: UserProfileContext;
  features: FeatureFlagsContext;
  activity?: RecentActivityContext;
  graphrag?: {
    context: string;
    sources: number;
  };
}

/**
 * Result of context injection
 */
export interface ContextInjectionResult {
  context: ConditionalContext;
  systemMessage: string;
  estimatedTokens: number;
  contextTypes: string[];
}

/**
 * Context detection result
 */
export interface ContextDetectionResult {
  needsProfile: boolean;
  needsFeatures: boolean;
  needsActivity: boolean;
  needsGraphRAG: boolean;
  reason: string;
}
