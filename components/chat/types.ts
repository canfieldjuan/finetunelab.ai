/**
 * Shared type definitions for Chat components
 * 
 * This file contains all core types used across chat-related components.
 * Extracted from Chat.tsx to improve code organization and reusability.
 */

import type { Citation } from "@/lib/graphrag/service";
import type { ChatAttachmentDto } from "@/lib/chat/attachments";
import type { WebSearchDocument } from "@/lib/tools/web-search/types";

export interface ChatToolCall {
  name: string;
  success: boolean;
  error?: string;
}

/**
 * Represents a single chat message
 */
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  contentTruncated?: boolean;
  originalContentLength?: number;
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
  attachment_ids?: string[];
  attachments?: ChatAttachmentDto[];
  webSearchResults?: WebSearchDocument[];
  // Model name for display (persisted in metadata, computed for old messages via useMessages)
  model_name?: string;
  // GraphRAG retrieval metadata (extracted from metadata.graphrag)
  graphrag_used?: boolean;
  graphrag_nodes?: number;
  graphrag_chunks?: number;
  graphrag_retrieval_ms?: number;
  graphrag_relevance?: number;
  graphrag_grounded?: boolean;
  graphrag_method?: string;
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
 * Per-chat generation controls sent with each request.
 */
export interface GenerationSettings {
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface PortalChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export type PendingChatAttachmentStatus = 'uploading' | 'uploaded' | 'deleting' | 'error';

export interface PendingChatAttachment {
  clientId: string;
  conversationId: string;
  filename: string;
  sizeBytes: number;
  status: PendingChatAttachmentStatus;
  attachment?: ChatAttachmentDto;
  error?: string;
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
