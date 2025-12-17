/**
 * GraphRAG Main Exports
 * Centralized exports for the GraphRAG system
 */

// Types
export * from './types';

// Configuration
export { graphragConfig, validateGraphRAGConfig } from './config';
export type {
  GraphRAGConfig,
  Neo4jConfig,
  SearchConfig,
  ProcessingConfig,
  SearchMetadata,
  SearchSource,
  GraphRAGRetrievalMetadata,
} from './types';

// Parsers
export { parseDocument, parserFactory } from './parsers';
export type { ParseResult } from './parsers';
// Note: Individual parsers (pdfParser, docxParser, textParser) are internal to ParserFactory
// and should not be exported to prevent duplicate module loading

// Graphiti Services
export {
  getGraphitiClient,
  episodeService,
  searchService,
  type GraphitiEpisode,
  type GraphitiSearchParams,
  type AddEpisodeResult,
} from './graphiti';

// Storage
export {
  documentStorage,
  type CreateDocumentData,
} from './storage';

// Services
export {
  documentService,
  graphragService,
} from './service';

export type {
  UploadOptions,
  ProcessingOptions,
  DeleteOptions,
  EnhanceOptions,
  EnhancedPrompt,
  Citation,
} from './service';
