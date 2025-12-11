/**
 * Shared type definitions for Chat components
 * 
 * This file contains all core types used across chat-related components.
 * Extracted from Chat.tsx to improve code organization and reusability.
 */

import type { Citation } from "@/lib/graphrag/service";

/**
 * Represents a single chat message
 */
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  contextsUsed?: number;
  // Model and performance metadata (populated for assistant messages)
  model_id?: string;
  provider?: string;
  llm_model_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  // Additional metadata fields (persisted from API, includes model_name snapshot)
  // Using unknown to match MessageData from conversation-validator
  metadata?: unknown;
  content_json?: unknown;
  tools_called?: unknown;
  // Model name for display (persisted in metadata, computed for old messages via useMessages)
  model_name?: string;
  // Index signature for compatibility with MessageData from conversation-validator
  [key: string]: unknown;
}

/**
 * Represents a conversation in the sidebar
 */
export interface SidebarConversation {
  id: string;
  title: string;
  in_knowledge_graph?: boolean;
  neo4j_episode_id?: string;
  promoted_at?: string;
  archived?: boolean;
  archived_at?: string;
  message_count?: number;
  session_id?: string | null;
  experiment_name?: string | null;
}

/**
 * Widget configuration for embedded chat
 */
export interface WidgetConfig {
  sessionId: string;
  modelId: string;
  apiKey: string;
  userId?: string;
  theme?: string;
}

/**
 * Props for the main Chat component
 */
export interface ChatProps {
  widgetConfig?: WidgetConfig;
  demoMode?: boolean;
}

/**
 * Modal types - used for centralized modal state management
 */
export type OpenModal = 
  | 'knowledge-base'
  | 'archive-manager'
  | 'export-dialog'
  | 'delete-confirm'
  | 'settings'
  | 'context-inspector'
  | 'model-comparison'
  | null;
