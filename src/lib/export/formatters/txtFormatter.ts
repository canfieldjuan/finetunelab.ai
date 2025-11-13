/**
 * Plain Text Format Generator
 *
 * Generates simple plain text exports for maximum compatibility.
 *
 * @module lib/export/formatters/txtFormatter
 */

import {
  FormatGenerator,
  ConversationData,
  ExportOptions,
  MessageData,
} from '../types';

/**
 * Plain text formatter
 */
export class TxtFormatter implements FormatGenerator {
  /**
   * Generate plain text export
   */
  async generate(
    conversations: ConversationData[],
    options: ExportOptions
  ): Promise<string> {
    let text = '';

    // Header
    text += this.createSeparator('=');
    text += this.centerText(options.title || 'CONVERSATION EXPORT');
    text += this.createSeparator('=');
    text += '\n';

    // Export info
    text += `Exported: ${new Date().toLocaleString()}\n`;
    text += `Conversations: ${conversations.length}\n`;
    text += `Format: Plain Text\n`;
    text += '\n';
    text += this.createSeparator('-');
    text += '\n';

    // Each conversation
    for (let i = 0; i < conversations.length; i++) {
      if (i > 0) {
        text += '\n';
        text += this.createSeparator('=');
        text += '\n';
      }

      text += this.formatConversation(conversations[i], options);
    }

    // Footer
    text += '\n';
    text += this.createSeparator('-');
    text += `Export generated on ${new Date().toLocaleString()}\n`;
    text += this.createSeparator('-');

    return text;
  }

  /**
   * Format a single conversation
   */
  private formatConversation(
    conversation: ConversationData,
    options: ExportOptions
  ): string {
    let text = '';

    // Conversation header
    text += `CONVERSATION: ${conversation.title}\n`;
    text += `Created: ${conversation.created_at.toLocaleString()}\n`;
    text += `Messages: ${conversation.messages.length}\n`;
    text += '\n';
    text += this.createSeparator('-');
    text += '\n';

    // Messages
    for (let i = 0; i < conversation.messages.length; i++) {
      if (i > 0) {
        text += '\n';
      }

      text += this.formatMessage(conversation.messages[i], options);
    }

    return text;
  }

  /**
   * Format a single message
   */
  private formatMessage(message: MessageData, options: ExportOptions): string {
    let text = '';

    // Message header
    const role = message.role === 'user' ? 'YOU' : 'ASSISTANT';
    text += `[${role}]`;

    if (options.includeMetadata) {
      text += ` - ${message.created_at.toLocaleString()}`;
    }

    text += '\n';

    // Message content (wrap at 80 characters)
    const wrappedContent = this.wrapText(message.content, 80);
    text += wrappedContent;
    text += '\n';

    return text;
  }

  /**
   * Wrap text at specified column width
   */
  private wrapText(text: string, width: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 > width) {
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is longer than width, break it
          lines.push(word.substring(0, width));
          currentLine = word.substring(width);
        }
      } else {
        if (currentLine.length > 0) {
          currentLine += ' ' + word;
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  /**
   * Create a separator line
   */
  private createSeparator(char: string, width: number = 80): string {
    return char.repeat(width) + '\n';
  }

  /**
   * Center text in a line
   */
  private centerText(text: string, width: number = 80): string {
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(padding) + text + '\n';
  }

  /**
   * Get file extension
   */
  getExtension(): string {
    return 'txt';
  }

  /**
   * Get MIME type
   */
  getMimeType(): string {
    return 'text/plain';
  }
}
