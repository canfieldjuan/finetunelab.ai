/**
 * Document Parser Factory
 * Automatically selects the correct parser based on file type
 */

import { pdfParser, type PDFParseResult } from './pdf-parser';
import { docxParser, type DOCXParseResult } from './docx-parser';
import { textParser, type TextParseResult } from './text-parser';
import type { CodeParseResult } from './code-parser';
import type { DocumentFileType } from '../types';

export interface ParseResult {
  text: string;
  metadata: Record<string, unknown>;
  fileType: DocumentFileType;
  codeResult?: CodeParseResult; // Optional: populated for code files with AST parsing
}

export interface ParseOptions {
  // Third-party parsers used below do not all expose mid-call cancellation.
  // This signal prevents starting after an upstream timeout and rejects late
  // completions, while callers that own streams can still cancel those directly.
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('Document parsing aborted');
}

export class ParserFactory {
  /**
   * Parse document based on file type
   */
  async parse(file: File | Buffer, fileType: DocumentFileType, options: ParseOptions = {}): Promise<ParseResult> {
    throwIfAborted(options.signal);
    let buffer: Buffer;
    
    if (file instanceof Buffer) {
      buffer = file;
    } else {
      // file is File type
      buffer = Buffer.from(await (file as File).arrayBuffer());
    }
    throwIfAborted(options.signal);

    let result: ParseResult;
    switch (fileType) {
      case 'pdf':
        result = await this.parsePDF(buffer, options);
        break;
      
      case 'docx':
        result = await this.parseDOCX(buffer, options);
        break;
      
      case 'txt':
      case 'md':
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
        result = await this.parseText(buffer, fileType, options);
        break;
      
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    throwIfAborted(options.signal);
    return result;
  }

  /**
   * Parse PDF file
   */
  private async parsePDF(buffer: Buffer, options: ParseOptions): Promise<ParseResult> {
    throwIfAborted(options.signal);
    const result: PDFParseResult = await pdfParser.parse(buffer);
    throwIfAborted(options.signal);
    
    return {
      text: result.text,
      fileType: 'pdf',
      metadata: {
        numPages: result.numPages,
        title: result.metadata.title,
        author: result.metadata.author,
        creator: result.metadata.creator,
        producer: result.metadata.producer,
        creationDate: result.metadata.creationDate,
      },
    };
  }

  /**
   * Parse DOCX file
   */
  private async parseDOCX(buffer: Buffer, options: ParseOptions): Promise<ParseResult> {
    throwIfAborted(options.signal);
    const result: DOCXParseResult = await docxParser.parse(buffer);
    throwIfAborted(options.signal);
    
    return {
      text: result.text,
      fileType: 'docx',
      metadata: {
        parsingMessages: result.messages,
      },
    };
  }

  /**
   * Parse Text file (including code files)
   */
  private async parseText(buffer: Buffer, fileType: DocumentFileType, options: ParseOptions): Promise<ParseResult> {
    throwIfAborted(options.signal);
    const result: TextParseResult = await textParser.parseWithAutoEncoding(buffer);
    throwIfAborted(options.signal);
    const cleanedText = textParser.cleanText(result.text);
    
    return {
      text: cleanedText,
      fileType,
      metadata: {
        encoding: result.encoding,
        lineCount: result.lineCount,
        originalLength: result.text.length,
        cleanedLength: cleanedText.length,
      },
    };
  }

  /**
   * Detect file type from filename extension
   */
  detectFileType(filename: string): DocumentFileType | null {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'docx':
        return 'docx';
      case 'txt':
        return 'txt';
      case 'md':
      case 'markdown':
        return 'md';
      default:
        return null;
    }
  }

  /**
   * Validate file type from buffer
   */
  validateFileType(buffer: Buffer, expectedType: DocumentFileType): boolean {
    switch (expectedType) {
      case 'pdf':
        return pdfParser.isValidPDF(buffer);
      case 'docx':
        return docxParser.isValidDOCX(buffer);
      case 'txt':
      case 'md':
        // Text files don't have a magic number, assume valid
        return true;
      default:
        return false;
    }
  }
}

export const parserFactory = new ParserFactory();

/**
 * Convenience function to parse a document
 */
export async function parseDocument(
  file: File | Buffer,
  filename: string
): Promise<ParseResult> {
  const factory = new ParserFactory();
  
  // Detect file type from filename
  const fileType = factory.detectFileType(filename);
  if (!fileType) {
    throw new Error(`Unable to detect file type from filename: ${filename}`);
  }

  // Validate file type
  let buffer: Buffer;
  if (file instanceof Buffer) {
    buffer = file;
  } else {
    buffer = Buffer.from(await (file as File).arrayBuffer());
  }
  
  const isValid = factory.validateFileType(buffer, fileType);
  if (!isValid) {
    throw new Error(`File validation failed: ${filename} is not a valid ${fileType} file`);
  }

  // Parse document
  return factory.parse(buffer, fileType);
}
