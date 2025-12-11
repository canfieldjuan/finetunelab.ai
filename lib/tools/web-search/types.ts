export interface WebSearchProvider {
  name: string;
  search(params: ProviderSearchParams): Promise<ProviderResult>;
}

export interface ProviderSearchParams {
  query: string;
  maxResults: number;
  timeoutMs: number;
}

export interface ProviderResult {
  provider: string;
  latencyMs: number;
  results: WebSearchDocument[];
  raw: unknown;
}

export interface WebSearchDocument {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source?: string;
  imageUrl?: string;
  summary?: string;
  confidenceScore?: number;
  fullContent?: string;
}

export interface GraphRagDocument {
  id: string;
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchDocument[];
  graphRagResults?: GraphRagDocument[];
  metadata: {
    provider: string;
    latencyMs: number;
    cached: boolean;
    fetchedAt: string;
    resultCount: number;
  };
  raw: unknown;
}

export interface SearchOptions {
  deepSearch?: boolean;
  summarize?: boolean;
  autoRefine?: boolean;
  skipCache?: boolean;
  providerOverride?: string;
  sortBy?: SortBy;
}

export interface SummarizationOptions {
  enabled: boolean;
  maxSummaryLength: number;
  provider: string;
  model: string;
}

export interface SearchResultSummary {
  id: string;
  query: string;
  resultUrl: string;
  resultTitle: string;
  originalSnippet: string;
  summary: string;
  source?: string;
  publishedAt?: string;
  createdAt: string;
  isIngested: boolean;
  isSaved: boolean;
}

export interface SavedSearchResult extends SearchResultSummary {
  userId: string;
  conversationId: string | null;
  updatedAt: string;
}

export interface CacheLookupOptions {
  query: string;
  provider: string;
  maxResults: number;
}

export interface CacheSavePayload {
  query: string;
  provider: string;
  maxResults: number;
  results: WebSearchDocument[];
  raw: unknown;
  ttlSeconds: number;
  latencyMs: number;
}

export interface CachedSearchEntry {
  id: string;
  query: string;
  queryHash: string;
  provider: string;
  maxResults: number;
  resultCount: number;
  results: WebSearchDocument[];
  raw: unknown;
  expiresAt: string;
  fetchedAt: string;
  createdAt: string;
}

export type SortBy = 'relevance' | 'date';

export interface Citation {
  title: string;
  url: string;
  source?: string;
}

export type ResearchJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ResearchStepType = 'initial_search' | 'sub_query_generation' | 'sub_query_search' | 'deep_search' | 'synthesis' | 'refinement' | 'report_generation';

export interface ResearchStep {
  id: string;
  type: ResearchStepType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  results?: unknown;
  output?: unknown;
  input?: Record<string, unknown>;
}

export interface ResearchReport {
  title: string;
  summary: string;
  body: string;
  generatedAt: string;
}

export interface ResearchJob {
  id: string;
  query: string;
  userId?: string;
  status: ResearchJobStatus;
  steps: ResearchStep[];
  collectedContent: WebSearchDocument[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  failureReason?: string;
  report?: ResearchReport;
}

export interface ResearchProgressEvent {
  type: 'research_progress';
  step: number;
  totalSteps: number;
  status: string;
  message?: string;
}

export interface ResearchOutlineEvent {
  type: 'research_outline';
  sections: string[];
}

export interface ResearchSectionEvent {
  type: 'research_section';
  sectionName: string;
  contentChunk: string;
  isComplete: boolean;
}

export interface ResearchCitationEvent {
  type: 'research_citation';
  section: string;
  citation: Citation;
}

export interface ResearchCompleteEvent {
  type: 'research_complete';
  reportVersion: number;
  totalCostUsd?: number;
}

export type ReportSections = Map<string, string>;