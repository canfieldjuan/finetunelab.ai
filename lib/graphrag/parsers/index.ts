/**
 * Document Parser Factory
 * Automatically selects the correct parser based on file type
 */

import { pdfParser, type PDFParseResult } from './pdf-parser';
import { docxParser, type DOCXParseResult } from './docx-parser';
import { textParser, type TextParseResult } from './text-parser';
import { codeParser, type CodeParseResult } from './code-parser';
import type { DocumentFileType } from '../types';

export interface ParseResult {
  text: string;
  metadata: Record<string, unknown>;
  fileType: DocumentFileType;
  codeResult?: CodeParseResult; // NEW: Optional code parse result
}

export class ParserFactory {
  /**
   * Parse document based on file type
   */
  async parse(file: File | Buffer, fileType: DocumentFileType): Promise<ParseResult> {
    let buffer: Buffer;
    let filename = 'unknown';

    if (file instanceof Buffer) {
      buffer = file;
    } else {
      // file is File type
      buffer = Buffer.from(await (file as File).arrayBuffer());
      filename = (file as File).name || 'unknown';
    }

    // NEW: Handle code files
    if (this.isCodeFile(fileType)) {
      return this.parseCode(buffer, fileType, filename);
    }

    switch (fileType) {
      case 'pdf':
        return this.parsePDF(buffer);

      case 'docx':
        return this.parseDOCX(buffer);

      case 'txt':
      case 'md':
        return this.parseText(buffer, fileType);

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Parse PDF file
   */
  private async parsePDF(buffer: Buffer): Promise<ParseResult> {
    const result: PDFParseResult = await pdfParser.parse(buffer);
    
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
  private async parseDOCX(buffer: Buffer): Promise<ParseResult> {
    const result: DOCXParseResult = await docxParser.parse(buffer);
    
    return {
      text: result.text,
      fileType: 'docx',
      metadata: {
        parsingMessages: result.messages,
      },
    };
  }

  /**
   * Parse text file (TXT, MD)
   */
  private async parseText(buffer: Buffer, fileType: 'txt' | 'md'): Promise<ParseResult> {
    const result: TextParseResult = await textParser.parseWithAutoEncoding(buffer);
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
   * NEW: Check if file type is code
   */
  private isCodeFile(fileType: DocumentFileType): boolean {
    return ['ts', 'tsx', 'js', 'jsx', 'py'].includes(fileType);
  }

  /**
   * NEW: Parse code files using AST
   */
  private async parseCode(
    buffer: Buffer,
    fileType: DocumentFileType,
    filename: string
  ): Promise<ParseResult> {
    const codeResult = await codeParser.parse(buffer, filename);

    // Convert AST result to text for backward compatibility
    const text = this.formatCodeAsText(codeResult);

    return {
      text,
      fileType,
      codeResult, // Include full AST result
      metadata: {
        ...codeResult.metadata,
        astParsed: true,
        entityCount: codeResult.astResult.entities.length,
        relationCount: codeResult.astResult.relations.length,
        chunkCount: codeResult.astResult.chunks.length,
      },
    };
  }

  /**
   * Format code parse result as structured text
   */
  private formatCodeAsText(codeResult: CodeParseResult): string {
    const { astResult, metadata } = codeResult;

    const sections = [
      `File: ${metadata.filePath}`,
      `Language: ${metadata.language}`,
      `Lines: ${metadata.lineCount}`,
      '',
      '=== IMPORTS ===',
      ...astResult.entities.filter(e => e.type === 'import').map(e => e.name),
      '',
      '=== FUNCTIONS ===',
      ...astResult.entities.filter(e => e.type === 'function').map(e =>
        `${e.name} (lines ${e.startLine}-${e.endLine}): ${e.signature || ''}`
      ),
      '',
      '=== CLASSES ===',
      ...astResult.entities.filter(e => e.type === 'class').map(e =>
        `${e.name} (lines ${e.startLine}-${e.endLine}): ${e.properties?.join(', ') || ''}`
      ),
      '',
      '=== INTERFACES/TYPES ===',
      ...astResult.entities.filter(e => e.type === 'interface' || e.type === 'type').map(e =>
        `${e.name} (lines ${e.startLine}-${e.endLine})`
      ),
    ];

    return sections.join('\n');
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
      // NEW: Code file types
      case 'ts':
        return 'ts';
      case 'tsx':
        return 'tsx';
      case 'js':
        return 'js';
      case 'jsx':
        return 'jsx';
      case 'py':
        return 'py';
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
      // NEW: Code validation
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
        return codeParser.isValidCode(buffer, expectedType);
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
