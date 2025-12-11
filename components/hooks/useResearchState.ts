import { useState } from 'react';

export interface ResearchProgress {
  jobId: string;
  status: string;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
}

export interface ActiveResearchJob {
  jobId: string;
  query: string;
}

/**
 * Hook for managing research job state.
 * Handles both legacy research progress and v2 streaming research.
 */
export function useResearchState() {
  const [researchProgress, setResearchProgress] = useState<ResearchProgress | null>(null);
  const [activeResearchJob, setActiveResearchJob] = useState<ActiveResearchJob | null>(null);
  const [enableDeepResearch, setEnableDeepResearch] = useState(false);

  return {
    researchProgress,
    setResearchProgress,
    activeResearchJob,
    setActiveResearchJob,
    enableDeepResearch,
    setEnableDeepResearch,
  };
}
