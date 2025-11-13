/**
 * Episode Service
 * Handles adding documents to Graphiti knowledge graph
 */

import { getGraphitiClient, type GraphitiEpisode } from './client';
import type { DocumentMetadata } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AddEpisodeResult {
  episodeId: string;
  entitiesCreated: number;
  relationsCreated: number;
}

export interface AddDocumentOptions {
  chunkSize?: number;
  metadata?: DocumentMetadata;
}

// ============================================================================
// Episode Service
// ============================================================================

export class EpisodeService {
  private client = getGraphitiClient();

  /**
   * Add a document as a single episode
   */
  async addDocument(
    content: string,
    userId: string,
    filename: string,
    metadata?: Record<string, unknown>
  ): Promise<AddEpisodeResult> {
    // Build source description with metadata if provided
    const sourceDescription = metadata
      ? `${filename} - ${JSON.stringify(metadata).substring(0, 200)}`
      : filename;

    const episode: GraphitiEpisode = {
      name: filename,
      episode_body: content,
      source_description: sourceDescription,
      reference_time: new Date().toISOString(),
      group_id: userId,
    };

    const response = await this.client.addEpisode(episode);

    return {
      episodeId: response.episode_id,
      entitiesCreated: response.entities_created,
      relationsCreated: response.relations_created,
    };
  }

  /**
   * Add a large document as multiple episodes (chunked)
   */
  async addDocumentChunked(
    content: string,
    userId: string,
    filename: string,
    options?: AddDocumentOptions
  ): Promise<string[]> {
    const chunkSize = options?.chunkSize || 2000; // characters
    const chunks = this.splitIntoChunks(content, chunkSize);
    const episodeIds: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkFilename = chunks.length > 1 
        ? `${filename} - Part ${i + 1}/${chunks.length}`
        : filename;

      const result = await this.addDocument(chunk, userId, chunkFilename);
      episodeIds.push(result.episodeId);
    }

    return episodeIds;
  }

  /**
   * Split text into semantic chunks
   * Tries to preserve paragraph and sentence boundaries
   */
  private splitIntoChunks(text: string, maxChunkSize: number): string[] {
    // If text is smaller than chunk size, return as-is
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    
    // Split by paragraphs first (double newline)
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds chunk size
      if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
        // If current chunk has content, save it
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // If paragraph itself is too large, split by sentences
        if (paragraph.length > maxChunkSize) {
          const sentences = this.splitIntoSentences(paragraph, maxChunkSize);
          chunks.push(...sentences);
        } else {
          currentChunk = paragraph;
        }
      } else {
        // Add paragraph to current chunk
        if (currentChunk) {
          currentChunk += '\n\n' + paragraph;
        } else {
          currentChunk = paragraph;
        }
      }
    }

    // Add remaining chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  /**
   * Split paragraph into sentences
   */
  private splitIntoSentences(text: string, maxSize: number): string[] {
    // Simple sentence splitting (can be enhanced)
    const sentences = text.split(/[.!?]+\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 2 > maxSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        // If single sentence is too large, hard split
        if (sentence.length > maxSize) {
          const hardSplits = this.hardSplit(sentence, maxSize);
          chunks.push(...hardSplits);
          currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk = currentChunk ? currentChunk + '. ' + sentence : sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Hard split text at character boundaries
   */
  private hardSplit(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize));
    }
    return chunks;
  }

  /**
   * Delete an episode
   * Handles 404 gracefully (episode already deleted or never existed)
   */
  async deleteEpisode(episodeId: string): Promise<void> {
    try {
      console.log(`[EpisodeService] Deleting episode: ${episodeId}`);
      await this.client.deleteEpisode(episodeId);
      console.log(`[EpisodeService] Successfully deleted episode: ${episodeId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If episode not found (404), log warning but don't throw
      // This handles orphaned records where episode was already deleted
      if (errorMessage.includes('404')) {
        console.warn(`[EpisodeService] Episode ${episodeId} not found (404) - likely already deleted`);
        return; // Success - episode doesn't exist (desired state)
      }

      // For other errors, log and re-throw
      console.error(`[EpisodeService] Failed to delete episode ${episodeId}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Delete multiple episodes
   * Uses best-effort approach - continues even if some deletions fail
   */
  async deleteEpisodes(episodeIds: string[]): Promise<void> {
    if (episodeIds.length === 0) {
      console.log('[EpisodeService] No episodes to delete');
      return;
    }

    console.log(`[EpisodeService] Deleting ${episodeIds.length} episode(s)`);

    // Use allSettled to continue even if individual deletions fail
    const results = await Promise.allSettled(
      episodeIds.map(id => this.deleteEpisode(id))
    );

    // Log summary
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[EpisodeService] Deletion complete: ${succeeded} succeeded, ${failed} failed`);

    // Note: We don't throw even if some failed, as long as we tried our best
    // The individual deleteEpisode calls will have logged specific errors
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const episodeService = new EpisodeService();
