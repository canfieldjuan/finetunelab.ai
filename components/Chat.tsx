/**
 * Chat UI component for MVP chat portal
 *
 * ARCHITECTURE:
 * This component uses a composable hook architecture for state management:
 * - useConversationState: Conversation list management
 * - useConversationActions: CRUD operations for conversations
 * - useChat: Message sending, streaming, and chat state
 * - useMessages: Message loading with validation and feedback
 * - useModalState, useSearchState, useUIState: UI state management
 * - useSettings, useVoiceState: User preferences
 *
 * Refactored: Nov 2025 - Integrated custom hooks, reduced from 2,487 to ~1,714 lines (31% reduction)
 *
 * ⚠️ CRITICAL WARNING - DO NOT MODIFY THE SIDEBAR IMPLEMENTATION ⚠️
 * This component MUST use AppSidebar from './layout/AppSidebar'
 * DO NOT create custom sidebars or replace AppSidebar unless explicitly requested
 * The sidebar provides:
 *   - Page navigation (Chat, Models, Secrets, Training, Analytics)
 *   - User settings dropdown with logout
 *   - Conversations list passed as children
 */
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../contexts/AuthContext";
import { logSessionEvent } from "../lib/sessionLogs";
import { supabase } from "../lib/supabaseClient";
import { getEnabledTools } from "../lib/tools/toolManager";
import { AppSidebar } from "./layout/AppSidebar";
import { useDocuments } from "../hooks/useDocuments";
import { useArchive } from "../hooks/useArchive";

// Dynamic imports for heavy modal components - loaded only when needed
const DocumentUpload = dynamic(() => import("./graphrag/DocumentUpload").then(mod => ({ default: mod.DocumentUpload })), {
  loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg" />
});
const DocumentList = dynamic(() => import("./graphrag/DocumentList").then(mod => ({ default: mod.DocumentList })), {
  loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg" />
});
const ArchiveManager = dynamic(() => import("./export/ArchiveManager").then(mod => ({ default: mod.ArchiveManager })), {
  loading: () => <div className="h-32 bg-muted animate-pulse rounded-lg" />
});
const ResearchStreamViewer = dynamic(() => import("./research/ResearchStreamViewer").then(mod => ({ default: mod.ResearchStreamViewer })), {
  loading: () => <div className="h-24 bg-muted animate-pulse rounded-lg" />
});
const ExportDialog = dynamic(() => import("./export/ExportDialog").then(mod => ({ default: mod.ExportDialog })), {
  loading: () => null
});
import {
  Archive,
  Database,
  MoreVertical,
  CheckSquare,
  Trash2,
  Search,
  MessageSquare,
  StopCircle,
  Mic,
  MicOff,
  Send,
  Plus,
  User,
  Brain
} from "lucide-react";
const EvaluationModal = dynamic(() => import("./evaluation/EvaluationModal").then(mod => ({ default: mod.EvaluationModal })), {
  loading: () => null
});
import { ModelSelector } from "./models/ModelSelector";
import { MessageList } from "./chat/MessageList";
import { ScrollToBottomButton } from "./chat/ScrollToBottomButton";
import { ChatCommandPalette } from "./chat/ChatCommandPalette";
import { ChatHeader } from "./chat/ChatHeader";
const ContextInspectorPanel = dynamic(() => import("./debug/ContextInspectorPanel").then(mod => ({ default: mod.ContextInspectorPanel })), {
  loading: () => null
});
const ModelComparisonView = dynamic(() => import("./evaluation/ModelComparisonView").then(mod => ({ default: mod.ModelComparisonView })), {
  loading: () => null
});
import { ContextTracker } from "@/lib/context/context-tracker";
import type { ConversationModelContextRecord } from "@/lib/context/types";
import { ContextIndicator } from "./chat/ContextIndicator";
import type { ContextUsage } from "@/lib/context/types";
import { useTextToSpeech, type SpeechOptions } from "@/hooks/useTextToSpeech";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { SettingsDialog } from "./settings/SettingsDialog";
import { log } from "@/lib/utils/logger";
import { useConversationValidation } from "@/hooks/useConversationValidation";
import type { ConversationData, ConversationValidationResult } from "@/lib/validation/conversation-validator";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { ChatProps } from "./chat/types";
// New focused hooks for state management
import {
  useModalState,
  useSearchState,
  useResearchState,
  useSelectionState,
  useVoiceState,
  useFeedbackState,
  useModelSelection,
  useSettings,
  useChatContext,
  useChat,
  useConversationState,
  useConversationActions,
  useMessages,
  useAutoScroll,
} from '@/components/hooks';
import { useContextInjection } from '@/components/hooks/useContextInjection';

export default function Chat({ widgetConfig, demoMode = false }: ChatProps) {
  // Render counter for debugging
  const renderCount = useRef(0);
  renderCount.current++;

  const { user, session, signOut } = useAuth();
  const userId = demoMode ? 'demo-user' : (user?.id || null);
  
  // Workspace context for multi-workspace support
  const { currentWorkspace } = useWorkspace();
  
  // Track what changed to cause renders (moved to effect to avoid render-loop risks)
  const prevPropsRef = useRef<{ widgetConfig?: ChatProps['widgetConfig']; userId?: string | null }>({});
  useEffect(() => {
    const widgetChanged = prevPropsRef.current.widgetConfig !== widgetConfig;
    const userChanged = prevPropsRef.current.userId !== userId;
    if (widgetChanged || userChanged) {
      log.trace('Chat', 'Props changed', {
        renderCount: renderCount.current,
        widgetChanged,
        userChanged
      });
      prevPropsRef.current = { widgetConfig, userId };
    }

    // Commit-phase render trace
    log.trace('Chat', 'Committed render', { renderCount: renderCount.current });
  });

  // Conversations, activeId, debugInfo now managed by useConversationState hook (see below)
  // Input, loading, messages, error, abortController now managed by useChat hook (see chatHookResult below)
  const [connectionError, setConnectionError] = useState<boolean>(false);

  // Tool type matching useChat.ts Tool interface
  type Tool = {
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
  };
  const [tools, setTools] = useState<Tool[]>([]);
  
  // Feedback state management - using useFeedbackState hook
  const {
    copiedMessageId,
    feedback,
    setFeedback,
    handleCopyMessage: handleCopyMessageState,
    handleFeedback: handleFeedbackState,
  } = useFeedbackState();
  
  // Modal state management - using useModalState hook
  const {
    openModal,
    setOpenModal,
    openMenuId,
    setOpenMenuId,
    archivingId,
    setArchivingId,
    evaluatingMessageId,
    setEvaluatingMessageId,
  } = useModalState();
  
  // Model selection state - using useModelSelection hook
  const {
    selectedModelId,
    selectedModel,
    availableModels,
    handleModelChange,
  } = useModelSelection();

  // Conversation state management - using useConversationState hook
  // Pass currentWorkspace.id to filter conversations by workspace
  const conversationState = useConversationState(userId, !!widgetConfig, currentWorkspace?.id, currentWorkspace?.type);
  const {
    conversations,
    setConversations,
    activeId,
    setActiveId,
    setError: setConversationError,
    debugInfo,
    setDebugInfo,
    fetchConversations,
  } = conversationState;

  // Conversation actions - using useConversationActions hook
  // Pass currentWorkspace.id so new conversations are created in current workspace
  const conversationActions = useConversationActions(
    userId, 
    session, 
    activeId, 
    fetchConversations, 
    currentWorkspace?.id
  );
  const {
    handleNewConversation: handleNewConversationHook,
    handlePromoteConversation: handlePromoteConversationHook,
    handleDeleteConversation: handleDeleteConversationHook,
    handleBulkDelete: handleBulkDeleteHook,
  } = conversationActions;

  // Search state management - using useSearchState hook
  const {
    searchQuery,
    setSearchQuery,
    searchExpanded,
    setSearchExpanded,
    filteredConversations,
  } = useSearchState(conversations);

  // Research state management - using useResearchState hook
  const {
    researchProgress,
    setResearchProgress,
    activeResearchJob,
    setActiveResearchJob,
    enableDeepResearch,
    setEnableDeepResearch,
  } = useResearchState();

  // Selection state management - using useSelectionState hook
  const {
    selectMode,
    setSelectMode,
    selectedConvIds,
    setSelectedConvIds,
    toggleSelection: handleToggleSelection,
  } = useSelectionState();

  // Context injection preference - using useContextInjection hook
  const {
    enabled: contextInjectionEnabled,
    toggleEnabled: toggleContextInjection,
  } = useContextInjection();

  // Debug: Watch contextInjectionEnabled in Chat component
  useEffect(() => {
    console.log('[Chat.tsx] ===== contextInjectionEnabled changed =====', contextInjectionEnabled);
  }, [contextInjectionEnabled]);

  // Context tracking state - using useChatContext hook
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const { contextTrackerRef } = useChatContext(activeId, selectedModelId, selectedModel);

  // Ref to track if currently streaming (prevents effect loops)
  const isStreamingRef = useRef(false);

  // Thinking mode state - for Qwen3 and similar models with <think> tags
  const [enableThinking, setEnableThinking] = useState(false);

  // Determine widget/demo mode early so it's available to hooks below
  const isWidgetMode = !!widgetConfig;
  const isDemoOrWidget = demoMode || isWidgetMode;

  // Chat messaging state and actions - using useChat hook
  const {
    input,
    setInput,
    loading,
    setLoading,
    messages,
    setMessages,
    error,
    setError,
    messagesEndRef,
    messagesContainerRef,
    handleSendMessage,
    handleStop,
  } = useChat({
    user,
    activeId,
    tools,
    enableDeepResearch,
    selectedModelId,
    contextTrackerRef,
    setContextUsage,
    isStreamingRef,
    researchProgress,
    setResearchProgress,
    activeResearchJob,
    setActiveResearchJob,
    contextInjectionEnabled,
    enableThinking,
    allowAnonymous: isDemoOrWidget,
    widgetConfig: widgetConfig || null,
  });

  // Auto-scroll behavior with sticky scroll-to-bottom button
  const {
    showScrollButton,
    scrollToBottom: scrollToBottomWithButton,
  } = useAutoScroll(
    messagesContainerRef,
    loading, // isStreaming
    messages.length
  );

  // Voice/TTS state management - using useVoiceState hook
  const {
    selectedVoiceURI,
    setSelectedVoiceURI,
    setAutoSpeakEnabled,
    speakingMessageId,
    setSpeakingMessageId,
  } = useVoiceState();

  const {
    isSpeaking,
    isPaused,
    speak,
    cancel,
    pause,
    resume,
    isSupported: ttsSupported
  } = useTextToSpeech({
    onEnd: () => {
      log.debug('Chat', 'TTS ended');
      setSpeakingMessageId(null);
    },
    onStart: () => log.debug('Chat', 'TTS started'),
    onError: (error) => log.error('Chat', 'TTS error', { error })
  });

  // Settings state - using useSettings hook
  const { userSettings, setUserSettings } = useSettings(user?.id || null, session);


  // Refetch conversation after message completes to pick up session_id
  const previousLoadingRef = useRef(loading);
  useEffect(() => {
    const wasLoading = previousLoadingRef.current;
    previousLoadingRef.current = loading;
    
    // When loading transitions from true to false (message complete)
    if (wasLoading && !loading && activeId && !isWidgetMode) {
      log.debug('Chat', 'Message complete - refetching conversation to get session_id');
      fetchConversations();
    }
  }, [loading, activeId, isWidgetMode, fetchConversations]);

  // Memoize speech recognition callbacks to prevent infinite re-renders
  const handleSpeechResult = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      log.debug('Chat', 'Final transcript', { text });
      // Add the final transcript to the input
      setInput(prev => (prev + ' ' + text).trim());
    } else {
      log.trace('Chat', 'Interim transcript', { text });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setInput is stable from useState
  }, []);

  const handleSpeechStart = useCallback(() => {
    log.debug('Chat', 'STT started');
    // Stop TTS when starting to speak
    if (isSpeaking) {
      log.debug('Chat', 'Stopping TTS to avoid interference');
      cancel();
    }
  }, [isSpeaking, cancel]);

  const handleSpeechEnd = useCallback(() => {
    log.debug('Chat', 'STT ended');
  }, []);

  const handleSpeechError = useCallback((error: string) => {
    log.error('Chat', 'STT error', { error });
  }, []);

  // Memoize speech recognition options object
  const speechRecognitionOptions = useMemo(() => ({
    onResult: handleSpeechResult,
    onStart: handleSpeechStart,
    onEnd: handleSpeechEnd,
    onError: handleSpeechError
  }), [handleSpeechResult, handleSpeechStart, handleSpeechEnd, handleSpeechError]);

  // Speech recognition for voice-to-text
  const {
    isListening,
    startListening,
    stopListening,
    isSupported: sttSupported,
    error: sttError
  } = useSpeechRecognition(speechRecognitionOptions);


  // messagesEndRef and messagesContainerRef now provided by useChat hook
  const speakRef = useRef(speak);
  // lastScrolledMessagesLength now managed by useChat hook
  // Removed unused refs (researchPollRef, deliveredResearchJobsRef, autoSpokenMessageIds)
  const initialConversationCreatedRef = useRef(false);

  // Keep speakRef updated
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  

  const { documents, refetch: refetchDocuments } = useDocuments({
    userId: userId || undefined,
    autoFetch: false // TEMPORARILY DISABLED TO DEBUG FREEZE
  });

  const processedDocs = useMemo(() => documents.filter(doc => doc.processed), [documents]);
  const processingDocs = useMemo(() => documents.filter(doc => !doc.processed), [documents]);
  const showDocumentStatus = enableDeepResearch && !isDemoOrWidget && !!user;

  // Debug logging for deep research status (moved to useEffect to prevent render loops)
  useEffect(() => {
    log.debug('Chat', 'Deep Research Status', {
      enableDeepResearch,
      isWidgetMode,
      hasUser: !!user,
      showDocumentStatus,
      processedDocsCount: processedDocs.length,
      processingDocsCount: processingDocs.length
    });
  }, [enableDeepResearch, isWidgetMode, user, showDocumentStatus, processedDocs.length, processingDocs.length]);

  // Debug logging for documents (moved to useEffect to prevent render loops)
  useEffect(() => {
    log.debug('Chat', 'Documents state', {
      count: documents.length,
      userId: userId,
      isWidgetMode,
      documents: documents.map(d => ({ id: d.id, filename: d.filename, processed: d.processed }))
    });
  }, [documents, userId, isWidgetMode]);

  const { archive: archiveConversation, loading: archiveLoading } = useArchive();

  // Memoize validation error callback to prevent infinite re-renders
  const handleValidationError = useCallback((conversation: ConversationData, result: ConversationValidationResult) => {
    log.error('Chat', 'Conversation validation failed', {
      conversationId: conversation.id,
      errors: result.errors,
      warnings: result.warnings,
      healthScore: result.healthScore,
    });
  }, []);

  // Conversation validation to prevent UI freezes from corrupted data
  const { validateMultiple } = useConversationValidation({
    autoValidate: true,
    minHealthScore: 50,
    onValidationError: handleValidationError,
  });

  // Message and feedback loading - using useMessages hook
  const {
    messages: loadedMessages,
    feedback: loadedFeedback,
  } = useMessages(userId, activeId, connectionError, setConnectionError, validateMultiple);

  // Sync loaded messages to useChat's messages state
  useEffect(() => {
    if (loadedMessages.length > 0 || activeId) {
      setMessages(loadedMessages);
    }
  }, [loadedMessages, activeId, setMessages]);

  // Sync loaded feedback to useFeedbackState
  useEffect(() => {
    if (Object.keys(loadedFeedback).length > 0) {
      setFeedback(loadedFeedback);
    }
  }, [loadedFeedback, setFeedback]);

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      handleCopyMessageState(messageId);
      log.debug('Chat', 'Message copied', { messageId });
    } catch (err) {
      log.error('Chat', 'Failed to copy message', { error: err });
    }
  };

  const handleToggleTTS = (messageId: string, content: string) => {
    log.debug('Chat', 'Toggle TTS for message', { messageId });

    // If this message is currently speaking
    if (speakingMessageId === messageId) {
      if (isSpeaking && !isPaused) {
        log.debug('Chat', 'Pausing TTS');
        pause();
      } else if (isPaused) {
        log.debug('Chat', 'Resuming TTS');
        resume();
      }
    } else {
      // Start speaking this message (cancels any other message)
      log.debug('Chat', 'Starting TTS for new message');
      setSpeakingMessageId(messageId);
      const speechOptions: SpeechOptions = selectedVoiceURI
        ? { voiceURI: selectedVoiceURI }
        : {};
      speak(content, speechOptions);
    }
  };

  const handleStopTTS = () => {
    log.debug('Chat', 'Stopping TTS');
    cancel();
    setSpeakingMessageId(null);
  };

  // Helper function to detect deep research results
  const isDeepResearchResult = (content: string): boolean => {
    // Deep research results are typically long and contain web search results
    const hasWebSearchIndicator = content.includes('🔧 Using tool: web_search') ||
                                   content.toLowerCase().includes('based on the search results') ||
                                   content.toLowerCase().includes('comprehensive research');
    const isLongEnough = content.length > 1000; // Deep research results are substantial
    return hasWebSearchIndicator && isLongEnough;
  };

  // Handle email research - User will ask LLM naturally ("email this to...")
  const handleEmailResearch = (content: string) => {
    log.debug('Chat', 'Email research requested');
    // Note: The LLM handles this naturally via the intelligent_email tool
    // User can say "Email this research to sara@example.com"
    // For now, just copy to clipboard as a helpful fallback
    handleCopyMessage(content, 'deep-research-' + Date.now());
    alert('Research copied to clipboard. You can also ask me to email it by saying "Email this to [recipient]"');
  };

  // Handle download research as Markdown file
  const handleDownloadResearch = (content: string) => {
    log.debug('Chat', 'Download research requested');
    try {
      // Create a clean markdown version
      const markdown = content;
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deep-research-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      log.debug('Chat', 'Research downloaded successfully');
    } catch (err) {
      log.error('Chat', 'Failed to download research', { error: err });
      alert('Failed to download research. Please try copying it instead.');
    }
  };

  // scrollToBottom now handled by useChat hook
  // Auto-scroll effect also handled by useChat hook

  // DISABLED: Auto-speak should only be triggered manually via feedback icons, not automatically
  // Auto-speak effect removed - was causing UI freezes on every message update
  // Speech is handled by the manual speak button in MessageList feedback icons

  useEffect(() => {
    const loadTools = async () => {
      const { data, error: toolsError } = await getEnabledTools();
      if (toolsError) {
        log.error('Chat', 'Error loading tools', { error: toolsError });
        return;
      }
      const apiTools: Tool[] = data.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as {
            type: 'object';
            properties: Record<string, unknown>;
            required?: string[];
          }
        }
      }));
      setTools(apiTools);
      console.log('[Chat] ===== TOOLS LOADED =====');
      console.log('[Chat] Tools count:', apiTools.length);
      console.log('[Chat] Tool names:', apiTools.map(t => t.function.name));
      log.debug('Chat', 'Loaded tools', { count: apiTools.length });
    };
    loadTools();
  }, []);

  // Helper: Fetch research results and append to chat
  // Note: Research progress and results are now handled via SSE streaming (ResearchStreamViewer)
  // Legacy polling removed - research_progress events update state via handleSend streaming

  // fetchConversations now provided by useConversationState hook (see line 150-162)

  // Wrapper for handleNewConversation with UI state updates
  const handleNewConversation = useCallback(async () => {
    if (!userId && !demoMode) {
      setConversationError("You must be logged in to create a conversation");
      return;
    }

    // Call hook handler (handles DB operations and fetching)
    await handleNewConversationHook();

    // Additional UI state updates after conversation is created
    // fetchConversations (called by hook) will set the new conversation as active
    setMessages([]);
    setConversationError(null);
  }, [userId, handleNewConversationHook, setMessages, setConversationError]);

  useEffect(() => {
    log.trace('Chat', 'Initial conversation effect triggered', { 
      isWidgetMode, 
      userId, 
      alreadyCreated: initialConversationCreatedRef.current 
    });
    
    if (isWidgetMode) {
      log.trace('Chat', 'Widget mode - checking for existing widget conversation');
      
      // For widget mode, check if conversation exists by widget_session_id
      // The API will create the conversation on first message if it doesn't exist
      const checkWidgetConversation = async () => {
        if (!widgetConfig?.sessionId) {
          log.warn('Chat', 'Widget mode but no sessionId in widgetConfig');
          return;
        }
        
        try {
          // Query for existing conversation with this widget_session_id
          const { data, error } = await supabase
            .from('conversations')
            .select('id')
            .eq('widget_session_id', widgetConfig.sessionId)
            .maybeSingle();
          
          if (error) {
            log.error('Chat', 'Error checking widget conversation', { error });
            return;
          }
          
          if (data) {
            log.trace('Chat', 'Found existing widget conversation', { id: data.id });
            setActiveId(data.id);
          } else {
            log.trace('Chat', 'No existing widget conversation - will be created on first message');
          }
        } catch (error) {
          log.error('Chat', 'Exception checking widget conversation', { error });
        }
      };
      
      checkWidgetConversation();
      return;
    }

    // Only auto-create initial conversation once
    if (initialConversationCreatedRef.current) {
      log.trace('Chat', 'Skipping - initial conversation already created');
      return;
    }

    log.debug('Chat', 'Fetching conversations to check if we need to create initial');
    fetchConversations().then(async (list) => {
      log.debug('Chat', 'Fetch complete', { conversationCount: list.length });
      if (list.length === 0 && userId && !initialConversationCreatedRef.current) {
        log.debug('Chat', 'Creating initial conversation');
        initialConversationCreatedRef.current = true;
        await handleNewConversation();
      } else {
        log.debug('Chat', 'Skipping initial conversation creation - conversations exist or no userId');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWidgetMode, userId, widgetConfig?.sessionId]); // Added widgetConfig?.sessionId dependency

  // Load user settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (demoMode) {
        log.trace('Chat', 'Skipping settings load - demo mode');
        return;
      }
      if (!userId || !session?.access_token) {
        log.trace('Chat', 'Skipping settings load - no user or session');
        return;
      }

      try {
        log.debug('Chat', 'Loading user settings');
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          log.error('Chat', 'Settings API error', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          throw new Error(`Failed to load settings: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        if (data.settings) {
          log.debug('Chat', 'Settings loaded', { settings: data.settings });
          setUserSettings(data.settings);

          // Apply TTS settings
          if (data.settings.ttsVoiceUri) {
            setSelectedVoiceURI(data.settings.ttsVoiceUri);
          }
          setAutoSpeakEnabled(data.settings.ttsAutoPlay);
        } else {
          log.debug('Chat', 'No settings found, using defaults');
        }
      } catch (error) {
        log.error('Chat', 'Error loading settings', { error });
      }
    };

    loadSettings();
  }, [userId, session?.access_token, setSelectedVoiceURI, setAutoSpeakEnabled, setUserSettings]);


  // Message and feedback loading now handled by useMessages hook (see line 413-431)


  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on a menu button or inside an open menu
      if (target.closest('[data-conversation-menu]') || target.closest('[data-conversation-menu-button]')) {
        return;
      }
      setOpenMenuId(null);
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [setOpenMenuId]);

  // Initialize or reset context tracker when conversation changes
  useEffect(() => {
    if (!activeId) {
      log.debug('Chat', 'No active conversation, clearing context tracker');
      contextTrackerRef.current = null;
      setContextUsage(null);
      return;
    }

    const maxTokens = selectedModel?.context_length || 128000; // Increased from 8000 to match modern models
    const modelName = selectedModel?.name || 'Moderator';
    const modelId = selectedModelId === '__default__' ? null : selectedModelId;

    log.debug('Chat', 'Initializing context tracker', {
      conversationId: activeId,
      modelId,
      modelName,
      maxTokens,
      usingFallback: !selectedModel?.context_length
    });

    // Initialize context tracker
    const tracker = new ContextTracker(
      activeId,
      modelId,
      maxTokens,
      {},
      modelName
    );

    // Fetch and restore context from database using Supabase
    supabase
      .from('conversation_model_contexts')
      .select('*')
      .eq('conversation_id', activeId)
      .order('last_message_at', { ascending: false }).limit(25).then(({ data: contexts, error }) => {
        if (error) {
          log.error('Chat', 'Error fetching context', { error });
          contextTrackerRef.current = tracker;
          setContextUsage(tracker.getUsage());
          return;
        }

        if (contexts && contexts.length > 0) {
          log.debug('Chat', 'Restoring context from database', {
            contextCount: contexts.length,
            contexts: contexts.map((c: { model_id: string; total_tokens?: number }) => ({
              modelId: c.model_id,
              totalTokens: c.total_tokens
            }))
          });

          // Restore each model's context
          contexts.forEach((record) => {
            const typedRecord = record as unknown as ConversationModelContextRecord;
            const recordModelName = typedRecord.model_id === modelId ? modelName : typedRecord.model_id;
            tracker.restoreFromDatabase(typedRecord, maxTokens, recordModelName);
          });

          contextTrackerRef.current = tracker;
          setContextUsage(tracker.getUsage());
        } else {
          log.debug('Chat', 'No existing context found, starting fresh');
          contextTrackerRef.current = tracker;
          setContextUsage(tracker.getUsage());
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, selectedModelId, selectedModel]); // contextTrackerRef is a stable ref from useChatContext

  const handleFeedback = async (messageId: string, value: number) => {
    if (!user && !demoMode) return;

    try {
      handleFeedbackState(messageId, value);

      if (demoMode || !user) {
        log.trace('Chat', 'Skipping feedback DB write - demo mode or no user');
        return;
      }

      const { error: feedbackError } = await supabase.from("feedback").upsert({
        user_id: user.id,
        conversation_id: activeId,
        response_id: messageId,
        value: value
      });

      if (feedbackError) {
        log.error('Chat', 'Error saving feedback to database', { error: feedbackError });
      } else {
        await logSessionEvent(user.id, "feedback_given", activeId);
      }
    } catch (err) {
      log.error('Chat', 'Error submitting feedback', { error: err });
    }
  };

  // Handle regenerating an assistant message
  const handleRegenerate = useCallback((messageId: string) => {
    // Find the index of the assistant message being regenerated
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) {
      log.warn('Chat', 'Message not found for regeneration', { messageId });
      return;
    }

    // Find the user message that preceded this assistant message
    let userMessageContent: string | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessageContent = messages[i].content;
        break;
      }
    }

    if (!userMessageContent) {
      log.warn('Chat', 'No user message found before assistant message', { messageId });
      return;
    }

    // Remove the assistant message from the UI
    setMessages(prev => prev.filter(m => m.id !== messageId));

    // Resend the user's message to regenerate
    void handleSendMessage(userMessageContent);
  }, [messages, handleSendMessage, setMessages]);

  const handleArchiveConversation = async (conversationId: string) => {
    if ((!userId || !user) && !demoMode) {
      setError("You must be logged in to archive conversations");
      return;
    }

    try {
      setArchivingId(conversationId);
      await archiveConversation({ conversationIds: [conversationId] });
      setDebugInfo(`Conversation archived: ${conversationId}`);

      if (activeId === conversationId) {
        setActiveId("");
        setMessages([]);
      }

      await fetchConversations();
    } catch (err) {
      log.error('Chat', 'Archive error', { error: err, conversationId });
      setError(
        `Failed to archive conversation: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setArchivingId(null);
      setOpenMenuId(null);
    }
  };

  const handleBulkArchive = async () => {
    if ((!userId || !user) && !demoMode) {
      setError("You must be logged in to archive conversations");
      return;
    }

    const count = selectedConvIds.size;
    const idsToArchive = Array.from(selectedConvIds);
    log.debug('Chat', 'Bulk archive started', { count, conversationIds: idsToArchive });

    try {
      await archiveConversation({ conversationIds: idsToArchive });
      log.debug('Chat', 'Successfully archived conversations', { count });

      if (activeId && selectedConvIds.has(activeId)) {
        setActiveId('');
        setMessages([]);
      }

      setSelectedConvIds(new Set());
      setSelectMode(false);
      await fetchConversations();
    } catch (err) {
      log.error('Chat', 'Bulk archive error', { error: err, count });
      setError(
        `Failed to archive conversations: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  // Wrapper for handlePromoteConversation with UI state updates
  const handlePromoteConversation = async (conversationId: string) => {
    if (!user || isWidgetMode) return;

    try {
      setLoading(true);

      // Call hook handler (handles API call and fetching)
      await handlePromoteConversationHook(conversationId);

      // Optimistic UI update
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                in_knowledge_graph: true,
                promoted_at: new Date().toISOString()
              }
            : c
        )
      );
    } catch (err) {
      log.error('Chat', 'Promotion error', { error: err });
      setConversationError(
        err instanceof Error ? err.message : "Failed to promote conversation"
      );
    } finally {
      setLoading(false);
      setOpenMenuId(null);
    }
  };

  // Wrapper for handleDeleteConversation with UI state updates
  const handleDeleteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      // Call hook handler (handles DB operations, session logs, and fetching)
      await handleDeleteConversationHook(conversationId);

      // Optimistic UI update
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      // Clear active conversation if it's the one being deleted
      if (activeId === conversationId) {
        setActiveId("");
        setMessages([]);
      }
    } catch (err) {
      log.error('Chat', 'Delete error', { error: err, conversationId });
      setConversationError(
        err instanceof Error ? err.message : "Failed to delete conversation"
      );
    } finally {
      setOpenMenuId(null);
    }
  };

  // Wrapper for handleBulkDelete with UI state updates
  const handleBulkDelete = async () => {
    if (!user) return;

    const idsToDelete = Array.from(selectedConvIds);

    // Call hook handler (handles DB operations, session logs, and fetching)
    const { successCount, errorCount, deletedIds } = await handleBulkDeleteHook(idsToDelete);

    // Optimistic UI updates
    setConversations((prev) => prev.filter((c) => !deletedIds.includes(c.id)));

    if (activeId && deletedIds.includes(activeId)) {
      setActiveId('');
      setMessages([]);
    }

    // Reset selection state
    setSelectedConvIds(new Set());
    setSelectMode(false);

    // Show error if any deletions failed
    if (errorCount > 0) {
      setConversationError(`Deleted ${successCount} conversations. ${errorCount} failed.`);
    }
  };


  // handleStop now provided by useChat hook

  // Wrap useModelSelection's handleModelChange to add context tracker logic
  const handleModelChangeWithContext = (modelId: string, model?: { id: string; name: string; context_length: number }) => {
    log.debug('Chat', 'Model changed', { modelId, modelName: model?.name, contextLength: model?.context_length });
    handleModelChange(modelId, model);

    // Switch model in context tracker if it exists
    if (contextTrackerRef.current && activeId) {
      const maxTokens = model?.context_length || 128000;
      const modelName = model?.name || 'Moderator';
      log.debug('Chat', 'Switching context tracker to model', { 
        modelId, 
        modelName, 
        maxTokens, 
        usingFallback: !model?.context_length 
      });
      contextTrackerRef.current.switchModel(modelId === '__default__' ? null : modelId, maxTokens, modelName);
      setContextUsage(contextTrackerRef.current.getUsage());
    }
  };

  // Wrapper for handleSendMessage to match the old handleSend API (no parameters)
  const handleSend = () => {
    void handleSendMessage(input);
  };

  const hasActiveConversation = !!activeId;

  return (
    <div className={`flex ${demoMode ? 'h-full' : 'h-screen'} overflow-hidden bg-background`}>
      {/* Command Palette - Ctrl+K / Cmd+K */}
      <ChatCommandPalette
        conversations={conversations}
        models={availableModels}
        onNewConversation={() => setActiveId("")}
        onSelectConversation={(id) => setActiveId(id)}
        onSelectModel={(id) => {
          const model = availableModels.find(m => m.id === id);
          if (model) {
            handleModelChangeWithContext(id, { ...model, context_length: 128000 });
          }
        }}
        onOpenArchive={() => setOpenModal('archive-manager')}
        onOpenKnowledgeBase={() => setOpenModal('knowledge-base')}
        onOpenSettings={() => setOpenModal('settings')}
        onOpenContextInspector={() => setOpenModal('context-inspector')}
        onOpenModelComparison={() => setOpenModal('model-comparison')}
        onExport={() => setOpenModal('export-dialog')}
        onDeleteConversation={() => setOpenModal('delete-confirm')}
      />

      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b border-red-200 p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-800">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {debugInfo && !error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-50 border-b border-blue-200 p-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">🐛</span>
              <p className="text-sm text-blue-800">{debugInfo}</p>
            </div>
            <button
              onClick={() => setDebugInfo("")}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {user && !isWidgetMode && !demoMode && (
        <AppSidebar
          currentPage="chat"
          user={user}
          session={session}
          signOut={signOut}
        >
          <div className="flex flex-col space-y-0.5">
            <div>
              <span className="block text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Conversations
              </span>
            </div>

            <button
              onClick={(event) => {
                event.stopPropagation();
                const newMode = !selectMode;
                log.debug('Chat', 'Toggling select mode', { from: selectMode, to: newMode });
                setSelectMode(newMode);
                if (!newMode) {
                  // Exiting select mode, clear selections
                  log.debug('Chat', 'Clearing selections on mode exit');
                  setSelectedConvIds(new Set());
                }
              }}
              className="w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer hover:bg-muted"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectMode ? 'Cancel' : 'Select'}</span>
            </button>

            {selectedConvIds.size > 0 && (
              <>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    log.debug('Chat', 'Archive Selected button clicked', { count: selectedConvIds.size });
                    handleBulkArchive();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Selected ({selectedConvIds.size})</span>
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    log.debug('Chat', 'Delete Selected button clicked, showing confirmation', { count: selectedConvIds.size });
                    setOpenModal('delete-confirm');
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedConvIds.size})</span>
                </button>
              </>
            )}

            <button
              onClick={(event) => {
                event.stopPropagation();
                if (messages.length > 0) {
                  handleNewConversation();
                }
              }}
              disabled={messages.length === 0}
              className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors ${
                messages.length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:bg-muted"
              }`}
              title={messages.length === 0 ? "Send a message first to create a conversation" : "Create new chat"}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            {!searchExpanded ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setSearchExpanded(true);
                }}
                className="w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer hover:bg-muted"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!searchQuery) {
                      setSearchExpanded(false);
                    }
                  }}
                  placeholder="Search conversations"
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            )}

            <div className="border-t border-border pt-3"></div>

            <div className="space-y-1">
              {filteredConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground px-2 py-4">
                  {conversations.length === 0
                    ? "No conversations yet."
                    : "No matches found."}
                </p>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="group relative rounded-md border border-transparent transition-colors"
                  >
                    <div
                      onClick={() => {
                        if (selectMode) {
                          handleToggleSelection(conv.id);
                        } else {
                          setActiveId(conv.id);
                        }
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 text-sm cursor-pointer rounded-md ${
                        activeId === conv.id && !selectMode
                          ? "bg-accent text-accent-foreground font-medium border-accent"
                          : selectedConvIds.has(conv.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0 pr-8">
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={selectedConvIds.has(conv.id)}
                            onChange={() => handleToggleSelection(conv.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 flex-shrink-0 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        )}
                        <span className="truncate" title={conv.title}>{conv.title}</span>
                        {conv.in_knowledge_graph && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            Graph
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === conv.id ? null : conv.id);
                        }}
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:bg-accent/50 bg-transparent backdrop-blur-sm"
                        title="Conversation options"
                        data-conversation-menu-button="true"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                    {openMenuId === conv.id && (
                      <div className="absolute left-2 top-8 w-48 bg-background border rounded-lg shadow-lg z-20 py-1" data-conversation-menu="true">
                          {!conv.in_knowledge_graph && (conv.message_count || 0) > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePromoteConversation(conv.id);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2 cursor-pointer"
                            >
                              <Database className="w-3.5 h-3.5" />
                              <span>Add to KGraph</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveConversation(conv.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                            disabled={archivingId === conv.id || archiveLoading}
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>
                              {archivingId === conv.id || archiveLoading
                                ? "Archiving..."
                                : "Archive"}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-destructive/10 text-destructive flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                  </div>
                ))
              )}
            </div>
          </div>
        </AppSidebar>
      )}

      <div className={`flex-1 flex flex-col ${isWidgetMode || demoMode ? "h-full" : ""}`}>
        <ChatHeader
          isWidgetMode={isWidgetMode}
          activeId={activeId}
          loading={loading}
          sessionId={conversations.find(c => c.id === activeId)?.session_id}
          experimentName={conversations.find(c => c.id === activeId)?.experiment_name}
          onExport={() => setOpenModal('export-dialog')}
          modelSelector={
            <ModelSelector
              value={selectedModelId}
              onChange={handleModelChangeWithContext}
              sessionToken={session?.access_token}
              disabled={loading}
            />
          }
        />

        <div
          ref={messagesContainerRef}
          className={`flex-1 relative ${
            messages.length > 0 || loading || error
              ? "overflow-y-auto"
              : "overflow-hidden"
          }`}
        >
          <div className="p-6 space-y-4 max-w-4xl mx-auto">
            {loading && messages.length === 0 && (
              <div className="flex justify-center items-center py-8">
                <div className="flex items-center space-x-3 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin"></div>
                  <span>Loading...</span>
                </div>
              </div>
            )}

            {researchProgress && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    Deep Research in Progress
                  </span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 ml-8">
                  {researchProgress.currentStep}
                </p>
                <div className="ml-8 mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Step {researchProgress.completedSteps} of {researchProgress.totalSteps}
                </div>
              </div>
            )}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No messages yet
                </h3>
                <p className="text-muted-foreground">
                  Start the conversation by sending a message below.
                </p>
              </div>
            )}

          {/* Message List - Extracted to separate component */}
          <MessageList
            messages={messages}
            feedback={feedback}
            copiedMessageId={copiedMessageId}
            speakingMessageId={speakingMessageId}
            isSpeaking={isSpeaking}
            isPaused={isPaused}
            ttsSupported={ttsSupported}
            ttsEnabled={userSettings?.ttsEnabled || false}
            onCopyMessage={handleCopyMessage}
            onFeedback={handleFeedback}
            onToggleTTS={handleToggleTTS}
            onStopTTS={handleStopTTS}
            onEvaluate={setEvaluatingMessageId}
            onEmailResearch={handleEmailResearch}
            onDownloadResearch={handleDownloadResearch}
            isDeepResearchResult={isDeepResearchResult}
            onRegenerate={handleRegenerate}
          />

          {/* Structured Research Viewer (v2 with SSE streaming) */}
          {activeResearchJob && (
            <div className="mb-6 px-4">
              <ResearchStreamViewer
                jobId={activeResearchJob.jobId}
                query={activeResearchJob.query}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button - appears when user scrolls up */}
          <ScrollToBottomButton
            show={showScrollButton}
            onClick={() => scrollToBottomWithButton(true)}
          />
        </div>

  <div className="bg-background p-4">
          {/* Context Indicator - Right aligned, above send button */}
          {contextUsage && (
            <div className="flex justify-end max-w-4xl mx-auto w-full mb-2">
              <ContextIndicator
                usage={contextUsage}
                modelName={selectedModel?.name}
                showThreshold={90}
              />
            </div>
          )}

          <div className="max-w-[52rem] mx-auto w-full">
            <div
              className={
                "flex flex-col rounded-2xl border border-border bg-background shadow-sm " +
                (enableDeepResearch ? "gap-1 px-4 py-2.5" : "gap-2 px-3 py-2.5")
              }
            >
              {enableDeepResearch ? (
                <>
                  {/* Row 1: Input on top */}
                  <Input
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInput(e.target.value)
                    }
                    placeholder="Type your message..."
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                  />
                  {/* Row 2: Controls below */}
                  <div className="flex items-center justify-between mt-0">
                    <div className="flex items-center gap-2">
                      {/* Deep Research Toggle Button (visible when ON) - Hidden in demo mode */}
                      {!demoMode && (
                        <Button
                          onClick={() => {
                            setEnableDeepResearch(prev => {
                              const newValue = !prev;
                              log.debug('Chat', 'Deep Research toggled', { from: prev, to: newValue });
                              return newValue;
                            });
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 shrink-0 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                          title="Deep Research On"
                          aria-label="Deep Research On"
                        >
                          <Search className="w-4 h-4" />
                        </Button>
                      )}
                      {/* Context Injection Toggle Button */}
                      <Button
                        onClick={() => {
                          console.log('[Chat] Button 1 clicked, current state:', contextInjectionEnabled);
                          toggleContextInjection();
                          log.debug('Chat', 'Context Injection toggled', { to: !contextInjectionEnabled });
                        }}
                        variant="ghost"
                        size="sm"
                        className={`h-9 w-9 p-0 shrink-0 rounded-full ${
                          contextInjectionEnabled
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        title={contextInjectionEnabled ? "Context Injection On" : "Context Injection Off"}
                        aria-label={contextInjectionEnabled ? "Context Injection On" : "Context Injection Off"}
                        key={`context-toggle-${contextInjectionEnabled}`}
                      >
                        <User className="w-4 h-4" />
                      </Button>
                      {/* Upload Documents Button */}
                      <Button
                        onClick={() => {
                          log.debug('Chat', 'Opening Knowledge Base modal');
                          setOpenModal('knowledge-base');
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 shrink-0 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="Upload Documents"
                        aria-label="Upload Documents"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {sttSupported && userSettings?.sttEnabled && (
                        <Button
                          onClick={isListening ? stopListening : startListening}
                          variant="ghost"
                          size="sm"
                          className={`h-9 w-9 p-0 shrink-0 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                            isListening ? "text-red-500 animate-pulse" : ""
                          }`}
                          title={isListening ? "Stop listening" : "Voice input"}
                          aria-label={isListening ? "Stop listening" : "Start voice input"}
                        >
                          {isListening ? (
                            <MicOff className="w-5 h-5" />
                          ) : (
                            <Mic className="w-5 h-5" />
                          )}
                        </Button>
                      )}
                      <Button
                        onClick={loading ? handleStop : handleSend}
                        disabled={!input.trim() && !loading}
                        variant="ghost"
                        className="h-10 w-10 p-0 shrink-0 rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:bg-gray-300 disabled:text-gray-500"
                        title={loading ? "Stop generating" : "Send message"}
                        aria-label={loading ? "Stop generating" : "Send message"}
                      >
                        {loading ? (
                          <StopCircle className="w-5 h-5" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Left: Deep Research Toggle Button - Hidden in demo mode */}
                  {!demoMode && (
                    <Button
                      onClick={() => {
                        setEnableDeepResearch(prev => {
                          const newValue = !prev;
                          log.debug('Chat', 'Deep Research toggled', { from: prev, to: newValue });
                          return newValue;
                        });
                      }}
                      variant="ghost"
                      size="sm"
                      className={`h-9 w-9 p-0 shrink-0 rounded-full ${
                        enableDeepResearch
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                          : "text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      title={enableDeepResearch ? "Deep Research On" : "Deep Research Off"}
                      aria-label={enableDeepResearch ? "Deep Research On" : "Deep Research Off"}
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  )}
                  {/* Context Injection Toggle Button */}
                  <Button
                    onClick={() => {
                      console.log('[Chat] Button 2 clicked, current state:', contextInjectionEnabled);
                      toggleContextInjection();
                      log.debug('Chat', 'Context Injection toggled', { to: !contextInjectionEnabled });
                    }}
                    variant="ghost"
                    size="sm"
                    className={`h-9 w-9 p-0 shrink-0 rounded-full ${
                      contextInjectionEnabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={contextInjectionEnabled ? "Context Injection On" : "Context Injection Off"}
                    aria-label={contextInjectionEnabled ? "Context Injection On" : "Context Injection Off"}
                    key={`context-toggle-${contextInjectionEnabled}`}
                  >
                    <User className="w-4 h-4" />
                  </Button>
                  {/* Thinking Mode Toggle Button - for Qwen3 and similar reasoning models */}
                  <Button
                    onClick={() => {
                      setEnableThinking(prev => {
                        const newValue = !prev;
                        log.debug('Chat', 'Thinking Mode toggled', { from: prev, to: newValue });
                        return newValue;
                      });
                    }}
                    variant="ghost"
                    size="sm"
                    className={`h-9 w-9 p-0 shrink-0 rounded-full ${
                      enableThinking
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={enableThinking ? "Thinking Mode On (model will reason step-by-step)" : "Thinking Mode Off"}
                    aria-label={enableThinking ? "Thinking Mode On" : "Thinking Mode Off"}
                  >
                    <Brain className="w-4 h-4" />
                  </Button>
                  {/* Upload Documents Button */}
                  <Button
                    onClick={() => {
                      log.debug('Chat', 'Opening Knowledge Base modal');
                      setOpenModal('knowledge-base');
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0 rounded-full text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Upload Documents"
                    aria-label="Upload Documents"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  {/* Middle: Input expands */}
                  <Input
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInput(e.target.value)
                    }
                    placeholder="Type your message..."
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    className="flex-1 h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                  />
                  {/* Right: Send */}
                  <Button
                    onClick={loading ? handleStop : handleSend}
                    disabled={!input.trim() && !loading}
                    variant="ghost"
                    className="h-10 w-10 p-0 shrink-0 rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:bg-gray-300 disabled:text-gray-500"
                    title={loading ? "Stop generating" : "Send message"}
                    aria-label={loading ? "Stop generating" : "Send message"}
                  >
                    {loading ? (
                      <StopCircle className="w-5 h-5" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          {sttError && (
            <div className="mt-1.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">
                {sttError}
              </p>
            </div>
          )}
          {showDocumentStatus && (
            <div className="flex items-center justify-center mt-2 text-xs">
              <span className={`font-medium ${
                processedDocs.length > 0
                  ? "text-green-600 dark:text-green-500"
                  : "text-gray-500 dark:text-gray-400"
              }`}>
                {processedDocs.length > 0
                  ? `GraphRAG Ready (${processedDocs.length} ${processedDocs.length === 1 ? 'document' : 'documents'})`
                  : "GraphRAG (No documents)"
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {openModal === 'export-dialog' && hasActiveConversation && !isWidgetMode && (
        <ExportDialog
          conversationIds={[activeId]}
          onClose={() => setOpenModal(null)}
          onSuccess={() => fetchConversations()}
        />
      )}

      {openModal === 'delete-confirm' && !isWidgetMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Delete {selectedConvIds.size} Conversation{selectedConvIds.size > 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete the selected conversations and all their messages. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  log.debug('Chat', 'Delete confirmation cancelled');
                  setOpenModal(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  log.debug('Chat', 'Delete confirmation accepted');
                  setOpenModal(null);
                  handleBulkDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {openModal === 'settings' && user && !isWidgetMode && session?.access_token && (
        <SettingsDialog
          isOpen={openModal === 'settings'}
          onClose={() => setOpenModal(null)}
          sessionToken={session.access_token}
          onSettingsChange={(settings) => {
            log.debug('Chat', 'Settings updated', { settings });
            setUserSettings(settings);
          }}
        />
      )}

      {openModal === 'context-inspector' && (
        <ContextInspectorPanel
          open={openModal === 'context-inspector'}
          onClose={() => setOpenModal(null)}
          usage={contextUsage}
          modelName={selectedModel?.name}
          messages={messages}
        />
      )}

      {openModal === 'model-comparison' && (
        <ModelComparisonView
          open={openModal === 'model-comparison'}
          onClose={() => setOpenModal(null)}
          sessionToken={session?.access_token}
          initialPrompt={input}
        />
      )}

      {openModal === 'archive-manager' && user && !isWidgetMode && (
        <ArchiveManager
          onClose={() => setOpenModal(null)}
          onRestore={() => fetchConversations()}
        />
      )}

      {openModal === 'knowledge-base' && user && !isWidgetMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col m-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-foreground">
                Knowledge Base
              </h2>
              <Button
                onClick={() => setOpenModal(null)}
                variant="ghost"
                size="sm"
              >
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <DocumentUpload
                userId={user.id}
                onUploadComplete={() => refetchDocuments()}
              />
              <DocumentList userId={user.id} />
            </div>
          </div>
        </div>
      )}

      {evaluatingMessageId && (
        <EvaluationModal
          messageId={evaluatingMessageId}
          onClose={() => setEvaluatingMessageId(null)}
          onSuccess={() => {
            setEvaluatingMessageId(null);
            log.debug('Chat', 'Evaluation submitted successfully');
          }}
        />
      )}
    </div>
  );
}









