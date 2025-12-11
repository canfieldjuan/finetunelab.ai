/**
 * Markdown Format Generator
 *
 * Generates Markdown (.md) exports with optional front matter.
 *
 * @module lib/export/formatters/markdownFormatter
 */

import {
  FormatGenerator,
  ConversationData,
  ExportOptions,
  MessageData,
} from '../types';
import { exportConfig } from '../config';

/**
 * Markdown formatter
 */
export class MarkdownFormatter implements FormatGenerator {
  /**
   * Generate Markdown export
   */
  async generate(
    conversations: ConversationData[],
    options: ExportOptions
  ): Promise<string> {
    let markdown = '';

    // Add front matter if enabled
    if (exportConfig.markdown.frontMatter) {
      markdown += this.generateFrontMatter(conversations, options);
      markdown += '\n---\n\n';
    }

    // Add title
    const title = options.title || 'Conversation Export';
    markdown += `# ${title}\n\n`;

    // Add export metadata
    markdown += `**Exported:** ${new Date().toLocaleString()}\n`;
    markdown += `**Conversations:** ${conversations.length}\n`;
    markdown += `**Format:** Markdown\n\n`;

    // Add table of contents if enabled
    if (exportConfig.markdown.tableOfContents && conversations.length > 1) {
      markdown += this.generateTableOfContents(conversations);
      markdown += '\n';
    }

    markdown += '---\n\n';

    // Add each conversation
    for (const conversation of conversations) {
      markdown += this.formatConversation(conversation, options);
      markdown += '\n---\n\n';
    }

    // Add footer
    markdown += `*Export generated on ${new Date().toLocaleString()}*\n`;

    return markdown;
  }

  /**
   * Generate YAML front matter
   */
  private generateFrontMatter(
    conversations: ConversationData[],
    options: ExportOptions
  ): string {
    const frontMatter = [
      '---',
      `title: "${options.title || 'Conversation Export'}"`,
      `date: ${new Date().toISOString()}`,
      `conversations: ${conversations.length}`,
      `format: markdown`,
      `exported_by: conversation_export_system`,
    ];

    if (options.dateRange) {
      frontMatter.push(`date_range_start: ${options.dateRange.start.toISOString()}`);
      frontMatter.push(`date_range_end: ${options.dateRange.end.toISOString()}`);
    }

    return frontMatter.join('\n');
  }

  /**
   * Generate table of contents
   */
  private generateTableOfContents(conversations: ConversationData[]): string {
    let toc = '## Table of Contents\n\n';

    conversations.forEach((conv, index) => {
      const anchor = this.createAnchor(conv.title);
      toc += `${index + 1}. [${conv.title}](#${anchor})\n`;
    });

    return toc;
  }

  /**
   * Format a single conversation
   */
  private formatConversation(
    conversation: ConversationData,
    options: ExportOptions
  ): string {
    let output = '';

    // Conversation title
    const anchor = this.createAnchor(conversation.title);
    output += `## ${conversation.title} {#${anchor}}\n\n`;

    // Conversation metadata
    output += `**Created:** ${conversation.created_at.toLocaleString()}\n`;
    output += `**Messages:** ${conversation.messages.length}\n\n`;

    // Messages
    for (const message of conversation.messages) {
      output += this.formatMessage(message, options);
      output += '\n';
    }

    return output;
  }

  /**
   * Format a single message
   */
  private formatMessage(message: MessageData, options: ExportOptions): string {
    let output = '';

    // Message header
    const role = message.role === 'user' ? '👤 You' : '🤖 Assistant';
    output += `### ${role}\n\n`;

    // Message content
    output += `${message.content}\n`;

    // Message metadata (if included)
    if (options.includeMetadata && message.created_at) {
      output += `\n*${message.created_at.toLocaleString()}*\n`;
    }

    return output;
  }

  /**
   * Create URL-safe anchor from title
   */
  private createAnchor(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'md';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'text/markdown';
  }
}
