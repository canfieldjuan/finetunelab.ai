import type { Citation } from '@/lib/graphrag/service';
import type { ChatAttachmentDto } from '@/lib/chat/attachments';
import type { WebSearchDocument } from '@/lib/tools/web-search/types';
import type { ImageAttribution } from '@/lib/tools/image-gen/types';

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
  attachmentIds?: string[];
  attachments?: ChatAttachmentDto[];
  graphRAG?: GraphRAGMessageMetadataInput;
  timestamp?: string;
}

export interface AttachmentMessageMetadataInput {
  attachmentIds?: string[];
  attachments?: ChatAttachmentDto[];
  timestamp?: string;
}

export interface GeneratedImageMessageMetadataInput {
  jobId: string;
  prompt: string;
  source?: string | null;
  url?: string | null;
  storagePath?: string | null;
  attribution?: ImageAttribution | null;
  timestamp?: string;
}

export interface HydratedGeneratedImageMetadata {
  jobId: string;
  prompt: string;
  source?: string;
  url?: string;
  storagePath?: string;
  attribution?: ImageAttribution;
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

export interface HydratedAttachmentMessageFields {
  attachment_ids?: string[];
  attachments?: ChatAttachmentDto[];
}

export interface HydratedGeneratedImageMessageFields {
  generatedImage?: HydratedGeneratedImageMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeImageAttribution(value: unknown): ImageAttribution | undefined {
  if (!isRecord(value)) return undefined;

  const authorName = nonEmptyString(value.authorName);
  const authorUrl = nonEmptyString(value.authorUrl);
  const sourceName = nonEmptyString(value.sourceName);
  const sourceUrl = nonEmptyString(value.sourceUrl);

  if (!authorName || !authorUrl || !sourceName || !sourceUrl) {
    return undefined;
  }

  return {
    authorName,
    authorUrl,
    sourceName,
    sourceUrl,
  };
}

function escapeMarkdownLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/[[\]]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ')
    .trim();
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

function normalizeAttachment(value: unknown): ChatAttachmentDto | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const filename = typeof value.filename === 'string' ? value.filename.trim() : '';
  const sizeBytes = finiteNumber(value.sizeBytes);
  const extractedChars = finiteNumber(value.extractedChars) ?? 0;
  const kind = typeof value.kind === 'string' ? value.kind : '';
  const status = typeof value.status === 'string' ? value.status : '';

  if (!id || !filename || sizeBytes === undefined) return null;
  if (!['text', 'document', 'code', 'image', 'unknown'].includes(kind)) return null;
  if (!['uploaded', 'attaching', 'attached', 'deleted'].includes(status)) return null;

  return {
    id,
    filename,
    contentType: typeof value.contentType === 'string' ? value.contentType : null,
    sizeBytes,
    kind: kind as ChatAttachmentDto['kind'],
    extractedChars,
    status: status as ChatAttachmentDto['status'],
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
  const attachmentMetadata = buildAttachmentMessageMetadata(input);
  const fields = {
    ...(input.modelId && input.modelName && input.provider ? {
      model_name: input.modelName,
      provider: input.provider,
      model_id: input.modelId,
    } : {}),
    ...(input.webSearchResults && input.webSearchResults.length > 0 ? {
      web_search_results: input.webSearchResults,
    } : {}),
    ...(attachmentMetadata ?? {}),
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

export function buildAttachmentMessageMetadata(input: AttachmentMessageMetadataInput): Record<string, unknown> | undefined {
  const fields = {
    ...(input.attachmentIds && input.attachmentIds.length > 0 ? {
      attachment_ids: input.attachmentIds,
    } : {}),
    ...(input.attachments && input.attachments.length > 0 ? {
      attachments: input.attachments,
    } : {}),
  };

  if (Object.keys(fields).length === 0) return undefined;

  return {
    ...fields,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

export function buildGeneratedImageMessageMetadata(input: GeneratedImageMessageMetadataInput): Record<string, unknown> | undefined {
  const jobId = nonEmptyString(input.jobId);
  const prompt = nonEmptyString(input.prompt) ?? 'generated image';
  if (!jobId) return undefined;

  const source = nonEmptyString(input.source);
  const storagePath = nonEmptyString(input.storagePath);
  const url = nonEmptyString(input.url);
  const attribution = normalizeImageAttribution(input.attribution);
  const generatedImage = {
    job_id: jobId,
    prompt,
    ...(source ? { source } : {}),
    ...(storagePath ? { storage_path: storagePath } : {}),
    ...(!storagePath && url ? { url } : {}),
    ...(attribution ? { attribution } : {}),
  };

  return {
    generated_image: generatedImage,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

export function buildGeneratedImageFallbackContent(prompt: string): string {
  return `Generated image: ${nonEmptyString(prompt) ?? 'generated image'}`;
}

export function buildGeneratedImageMarkdown(input: {
  prompt: string;
  url: string;
  attribution?: ImageAttribution | null;
}): string {
  const alt = escapeMarkdownLabel(input.prompt || 'generated image') || 'generated image';
  let content = `![${alt}](${input.url})`;
  const attribution = normalizeImageAttribution(input.attribution);
  if (attribution) {
    content += `\n\n*Photo by [${escapeMarkdownLabel(attribution.authorName)}](${attribution.authorUrl}) on [${escapeMarkdownLabel(attribution.sourceName)}](${attribution.sourceUrl})*`;
  }
  return content;
}

export function hydrateAttachmentMessageFields(metadata: unknown): HydratedAttachmentMessageFields {
  if (!isRecord(metadata)) return {};

  const attachmentIds = Array.isArray(metadata.attachment_ids)
    ? metadata.attachment_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : undefined;
  const attachments = Array.isArray(metadata.attachments)
    ? metadata.attachments.map(normalizeAttachment).filter((attachment): attachment is ChatAttachmentDto => attachment !== null)
    : undefined;

  return {
    ...(attachmentIds && attachmentIds.length > 0 ? { attachment_ids: attachmentIds } : {}),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
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

export function hydrateGeneratedImageMessageFields(metadata: unknown): HydratedGeneratedImageMessageFields {
  if (!isRecord(metadata) || !isRecord(metadata.generated_image)) {
    return {};
  }

  const generatedImage = metadata.generated_image;
  const jobId = nonEmptyString(generatedImage.job_id);
  const prompt = nonEmptyString(generatedImage.prompt);
  if (!jobId || !prompt) return {};

  return {
    generatedImage: {
      jobId,
      prompt,
      ...(nonEmptyString(generatedImage.source) ? { source: nonEmptyString(generatedImage.source) } : {}),
      ...(nonEmptyString(generatedImage.url) ? { url: nonEmptyString(generatedImage.url) } : {}),
      ...(nonEmptyString(generatedImage.storage_path) ? { storagePath: nonEmptyString(generatedImage.storage_path) } : {}),
      ...(normalizeImageAttribution(generatedImage.attribution) ? { attribution: normalizeImageAttribution(generatedImage.attribution) } : {}),
    },
  };
}
