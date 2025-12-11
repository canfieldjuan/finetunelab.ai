/**
 * GraphRAG Types
 * Core interfaces for Graphiti-powered GraphRAG system
 */

// ============================================================================
// Document Types
// ============================================================================

export interface Document {
  id: string;
  userId: string;
  filename: string;
  fileType: DocumentFileType;
  uploadPath: string;
  documentHash: string;
  content?: string; // Optional for list views (excludes large content field)
  processed: boolean;
  neo4jEpisodeIds: string[];
  createdAt: Date;
  metadata: DocumentMetadata;
  version: number;
  parentId: string | null;
}

export type DocumentFileType = 'pdf' | 'txt' | 'md' | 'docx';

export interface DocumentMetadata {
  userId: string;
  filename: string;
  documentName: string;
  fileSize?: number;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface CreateDocumentData {
  userId: string;
  filename: string;
  fileType: DocumentFileType;
  uploadPath: string;
  documentHash: string;
  content: string;
  metadata?: Partial<DocumentMetadata>;
  version?: number;
  parentId?: string | null;
}

export interface UpdateDocumentData {
  filename?: string;
  processed?: boolean;
  neo4jEpisodeIds?: string[];
  metadata?: Partial<DocumentMetadata>;
}

// ============================================================================
// Graphiti Episode Types
// ============================================================================

export interface Episode {
  episodeId: string;
  name: string;
  content: string;
  source: string;
  groupId: string;
  timestamp: Date;
}

export interface EpisodeResult {
  episodeId: string;
  entitiesCreated: number;
  relationsCreated: number;
}

// ============================================================================
// Search & Retrieval Types
// ============================================================================

export interface SearchResult {
  context: string;
  sources: SearchSource[];
  metadata: SearchMetadata;
}

export interface SearchSource {
  entity: string;
  relation: string;
  fact: string;
  confidence: number;
  sourceDescription?: string;
}

export interface SearchMetadata {
  searchMethod: 'semantic' | 'keyword' | 'hybrid';
  resultsCount: number;
  queryTime: number;
}

export interface SearchOptions {
  topK?: number;
  groupIds?: string[];
  searchMethod?: 'semantic' | 'keyword' | 'hybrid';
  threshold?: number;
}

// ============================================================================
// Graph Entity Types
// ============================================================================

export interface GraphEntity {
  uuid: string;
  name: string;
  labels: string[];
  summary: string;
  createdAt: Date;
}

export interface GraphRelation {
  uuid: string;
  name: string;
  fact: string;
  sourceNode: string;
  targetNode: string;
  episodes: string[];
  createdAt: Date;
  expiredAt?: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface GraphRAGConfig {
  enabled: boolean;
  neo4j: Neo4jConfig;
  search: SearchConfig;
  processing: ProcessingConfig;
}

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
  database?: string;
}

export interface SearchConfig {
  topK: number;
  searchMethod: 'semantic' | 'keyword' | 'hybrid';
  threshold: number;
  skipMathQueries: boolean;
  skipDateTimeQueries: boolean;
  skipWebSearchQueries: boolean;
}

export interface ProcessingConfig {
  maxFileSize: number;
  chunkSize: number;
  supportedTypes: DocumentFileType[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface UploadResponse {
  document: Document;
  message: string;
}

export interface ProcessingStatus {
  documentId: string;
  processed: boolean;
  episodeIds: string[];
  error?: string;
}

export interface DeleteResponse {
  success: boolean;
  documentId: string;
}
