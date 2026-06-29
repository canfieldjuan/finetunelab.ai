import type { Citation } from '@/lib/graphrag/service';
import type { WebSearchDocument } from '@/lib/tools/web-search/types';

export interface GraphRAGMessageMetadataInput {
  citations?: Citation[];
  contextsUsed?: number;
  graphUsed?: boolean;
  nodesRetrieved?: number;
  chunksUsed?: number;
  retrievalMs?: number;
  relevance?: number;
  grounded?: boolean;
  method?: string;
}

export interface AssistantMessageMetadataInput {
  modelId?: string | null;
  modelName?: string | null;
  provider?: string | null;
  webSearchResults?: WebSearchDocument[];
  graphRAG?: GraphRAGMessageMetadataInput;
  timestamp?: string;
}

interface PersistedGraphRAGMetadata {
  graph_used?: boolean;
  nodes_retrieved?: number;
  context_chunks_used?: number;
  retrieval_time_ms?: number;
  context_relevance_score?: number;
  answer_grounded_in_graph?: boolean;
  retrieval_method?: string;
  citations?: unknown;
  contexts_used?: number;
}

export interface HydratedGraphRAGMessageFields {
  citations?: Citation[];
  contextsUsed?: number;
  graphrag_used?: boolean;
  graphrag_nodes?: number;
  graphrag_chunks?: number;
  graphrag_retrieval_ms?: number;
  graphrag_relevance?: number;
  graphrag_grounded?: boolean;
  graphrag_method?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeCitation(value: unknown): Citation | null {
  if (!isRecord(value)) return null;

  const source = typeof value.source === 'string' ? value.source.trim() : '';
  const content = typeof value.content === 'string' ? value.content.trim() : '';
  const confidence = finiteNumber(value.confidence);

  if (!source || !content || confidence === undefined) return null;

  return {
    source,
    content,
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}

export function normalizeGraphRAGCitations(value: unknown): Citation[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const citations = value
    .map(normalizeCitation)
    .filter((citation): citation is Citation => citation !== null);

  return citations.length > 0 ? citations : undefined;
}

function hasGraphRAGInput(graphRAG?: GraphRAGMessageMetadataInput): boolean {
  return Boolean(
    graphRAG?.citations?.length ||
    graphRAG?.contextsUsed ||
    graphRAG?.graphUsed !== undefined ||
    graphRAG?.nodesRetrieved !== undefined ||
    graphRAG?.chunksUsed !== undefined ||
    graphRAG?.retrievalMs !== undefined ||
    graphRAG?.relevance !== undefined ||
    graphRAG?.grounded !== undefined ||
    graphRAG?.method
  );
}

function buildGraphRAGMetadata(graphRAG?: GraphRAGMessageMetadataInput): PersistedGraphRAGMetadata | undefined {
  if (!hasGraphRAGInput(graphRAG)) return undefined;

  const citations = normalizeGraphRAGCitations(graphRAG?.citations);
  const metadata = {
    ...(graphRAG?.graphUsed !== undefined ? { graph_used: graphRAG.graphUsed } : {}),
    ...(graphRAG?.nodesRetrieved !== undefined ? { nodes_retrieved: graphRAG.nodesRetrieved } : {}),
    ...(graphRAG?.chunksUsed !== undefined ? { context_chunks_used: graphRAG.chunksUsed } : {}),
    ...(graphRAG?.retrievalMs !== undefined ? { retrieval_time_ms: graphRAG.retrievalMs } : {}),
    ...(graphRAG?.relevance !== undefined ? { context_relevance_score: graphRAG.relevance } : {}),
    ...(graphRAG?.grounded !== undefined ? { answer_grounded_in_graph: graphRAG.grounded } : {}),
    ...(graphRAG?.method ? { retrieval_method: graphRAG.method } : {}),
    ...(graphRAG?.contextsUsed !== undefined ? { contexts_used: graphRAG.contextsUsed } : {}),
    ...(citations ? { citations } : {}),
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function buildAssistantMessageMetadata(input: AssistantMessageMetadataInput): Record<string, unknown> | undefined {
  const graphRAGMetadata = buildGraphRAGMetadata(input.graphRAG);
  const fields = {
    ...(input.modelId && input.modelName && input.provider ? {
      model_name: input.modelName,
      provider: input.provider,
      model_id: input.modelId,
    } : {}),
    ...(input.webSearchResults && input.webSearchResults.length > 0 ? {
      web_search_results: input.webSearchResults,
    } : {}),
    ...(graphRAGMetadata ? {
      graphrag: graphRAGMetadata,
    } : {}),
  };

  if (Object.keys(fields).length === 0) {
    return undefined;
  }

  return {
    ...fields,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

export function hydrateGraphRAGMessageFields(metadata: unknown): HydratedGraphRAGMessageFields {
  if (!isRecord(metadata) || !isRecord(metadata.graphrag)) {
    return {};
  }

  const graphRAG = metadata.graphrag as PersistedGraphRAGMetadata;
  const citations = normalizeGraphRAGCitations(graphRAG.citations);
  const contextsUsed = finiteNumber(graphRAG.contexts_used)
    ?? finiteNumber(graphRAG.context_chunks_used)
    ?? citations?.length;

  return {
    ...(citations ? { citations } : {}),
    ...(contextsUsed !== undefined ? { contextsUsed } : {}),
    ...(typeof graphRAG.graph_used === 'boolean' ? { graphrag_used: graphRAG.graph_used } : {}),
    ...(finiteNumber(graphRAG.nodes_retrieved) !== undefined ? { graphrag_nodes: graphRAG.nodes_retrieved } : {}),
    ...(finiteNumber(graphRAG.context_chunks_used) !== undefined ? { graphrag_chunks: graphRAG.context_chunks_used } : {}),
    ...(finiteNumber(graphRAG.retrieval_time_ms) !== undefined ? { graphrag_retrieval_ms: graphRAG.retrieval_time_ms } : {}),
    ...(finiteNumber(graphRAG.context_relevance_score) !== undefined ? { graphrag_relevance: graphRAG.context_relevance_score } : {}),
    ...(typeof graphRAG.answer_grounded_in_graph === 'boolean' ? { graphrag_grounded: graphRAG.answer_grounded_in_graph } : {}),
    ...(typeof graphRAG.retrieval_method === 'string' && graphRAG.retrieval_method ? { graphrag_method: graphRAG.retrieval_method } : {}),
  };
}
