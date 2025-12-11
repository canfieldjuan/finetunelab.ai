import { useEffect, useRef, useState } from 'react';
import type {
  ResearchOutlineEvent,
  ResearchSectionEvent,
  ResearchCitationEvent,
  ResearchProgressEvent,
  ResearchCompleteEvent,
  Citation
} from '@/lib/tools/web-search/types';

/**
 * Research stream state for progressive rendering
 */
export interface ResearchStreamState {
  jobId: string;
  status: 'connecting' | 'streaming' | 'completed' | 'error';
  progress: {
    step: number;
    totalSteps: number;
    status: string;
    message?: string;
  } | null;
  outline: string[] | null;
  sections: Map<string, string>; // sectionName -> content
  citations: Map<string, Citation[]>; // section -> citations
  error: string | null;
  reportVersion: number | null;
  totalCostUsd: number | null;
}

/**
 * Hook for managing SSE connection to research stream
 * Handles progressive rendering of structured research reports
 */
export function useResearchStream(jobId: string | null) {
  const [state, setState] = useState<ResearchStreamState>({
    jobId: jobId || '',
    status: 'connecting',
    progress: null,
    outline: null,
    sections: new Map(),
    citations: new Map(),
    error: null,
    reportVersion: null,
    totalCostUsd: null
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  // Event handler functions
  const handleProgressEvent = (event: ResearchProgressEvent) => {
    console.log('[useResearchStream] Progress:', event.status, `(${event.step}/${event.totalSteps})`);
    setState(prev => ({
      ...prev,
      progress: {
        step: event.step,
        totalSteps: event.totalSteps,
        status: event.status,
        message: event.message
      }
    }));
  };

  const handleOutlineEvent = (event: ResearchOutlineEvent) => {
    console.log('[useResearchStream] Outline:', event.sections);
    setState(prev => ({
      ...prev,
      outline: event.sections
    }));
  };

  const handleSectionEvent = (event: ResearchSectionEvent) => {
    console.log('[useResearchStream] Section:', event.sectionName, 'complete:', event.isComplete);
    setState(prev => {
      const newSections = new Map(prev.sections);
      const existing = newSections.get(event.sectionName) || '';
      newSections.set(event.sectionName, existing + event.contentChunk);
      return { ...prev, sections: newSections };
    });
  };

  const handleCitationEvent = (event: ResearchCitationEvent) => {
    console.log('[useResearchStream] Citation for:', event.section);
    setState(prev => {
      const newCitations = new Map(prev.citations);
      const existing = newCitations.get(event.section) || [];
      newCitations.set(event.section, [...existing, event.citation]);
      return { ...prev, citations: newCitations };
    });
  };

  const handleCompleteEvent = (event: ResearchCompleteEvent) => {
    console.log('[useResearchStream] Complete! Version:', event.reportVersion);
    setState(prev => ({
      ...prev,
      status: 'completed',
      reportVersion: event.reportVersion,
      totalCostUsd: event.totalCostUsd || null
    }));
  };

  useEffect(() => {
    // Don't connect if no jobId
    if (!jobId) {
      console.log('[useResearchStream] No jobId provided, skipping connection');
      return;
    }

    // Don't reconnect if already connected to same job
    if (eventSourceRef.current && state.jobId === jobId) {
      console.log('[useResearchStream] Already connected to job:', jobId);
      return;
    }

    console.log('[useResearchStream] Connecting to stream for job:', jobId);

    // Create EventSource connection
    const streamUrl = `/api/research/stream?jobId=${jobId}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    // Update state to connecting
    setState(prev => ({
      ...prev,
      jobId,
      status: 'connecting',
      error: null
    }));

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[useResearchStream] Event received:', data.type);

        switch (data.type) {
          case 'connected':
            console.log('[useResearchStream] Connected to stream');
            setState(prev => ({ ...prev, status: 'streaming' }));
            break;

          case 'research_progress':
            handleProgressEvent(data as ResearchProgressEvent);
            break;

          case 'research_outline':
            handleOutlineEvent(data as ResearchOutlineEvent);
            break;

          case 'research_section':
            handleSectionEvent(data as ResearchSectionEvent);
            break;

          case 'research_citation':
            handleCitationEvent(data as ResearchCitationEvent);
            break;

          case 'research_complete':
            handleCompleteEvent(data as ResearchCompleteEvent);
            break;
        }
      } catch (error) {
        console.error('[useResearchStream] Error parsing event:', error);
      }
    };

    // Handle errors
    eventSource.onerror = (error) => {
      console.error('[useResearchStream] EventSource error:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Stream connection error'
      }));
      eventSource.close();
    };

    // Cleanup function
    return () => {
      console.log('[useResearchStream] Cleaning up connection for job:', jobId);
      if (eventSource) {
        eventSource.close();
      }
      eventSourceRef.current = null;
    };
  }, [jobId, state.jobId]);

  return { state, eventSourceRef };
}
