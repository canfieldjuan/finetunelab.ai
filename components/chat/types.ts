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
