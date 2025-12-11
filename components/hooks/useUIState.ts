
import { useState } from 'react';
import type { OpenModal } from '../chat/types';
import type { UserSettings } from '@/lib/settings/types';
import type { ContextUsage } from '@/lib/context/types';


/**
 * A hook for managing the UI state of the chat component.
 * @returns The UI state and setters.
 */
export function useUIState() {
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [evaluatingMessageId, setEvaluatingMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string>("__default__");
  const [selectedModel, setSelectedModel] = useState<{ id: string; name: string; context_length: number } | null>(null);
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([]);
  const [researchProgress, setResearchProgress] = useState<{ jobId: string; status: string; currentStep: string; totalSteps: number; completedSteps: number; } | null>(null);
  const [activeResearchJob, setActiveResearchJob] = useState<{ jobId: string; query: string; } | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [enableDeepResearch, setEnableDeepResearch] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | undefined>();
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [experimentName, setExperimentName] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ [key: string]: number }>({});

  return {
    openModal,
    setOpenModal,
    openMenuId,
    setOpenMenuId,
    archivingId,
    setArchivingId,
    evaluatingMessageId,
    setEvaluatingMessageId,
    searchQuery,
    setSearchQuery,
    selectedModelId,
    setSelectedModelId,
    selectedModel,
    setSelectedModel,
    availableModels,
    setAvailableModels,
    researchProgress,
    setResearchProgress,
    activeResearchJob,
    setActiveResearchJob,
    searchExpanded,
    setSearchExpanded,
    enableDeepResearch,
    setEnableDeepResearch,
    selectMode,
    setSelectMode,
    selectedConvIds,
    setSelectedConvIds,
    contextUsage,
    setContextUsage,
    selectedVoiceURI,
    setSelectedVoiceURI,
    autoSpeakEnabled,
    setAutoSpeakEnabled,
    sessionId,
    setSessionId,
    experimentName,
    setExperimentName,
    speakingMessageId,
    setSpeakingMessageId,
    userSettings,
    setUserSettings,
    copiedMessageId,
    setCopiedMessageId,
    feedback,
    setFeedback,
  };
}
