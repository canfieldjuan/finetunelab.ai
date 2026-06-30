import type { ToolDefinition } from '../types';
import { urlReaderConfig } from '../config';
import { contentService } from '../web-search/content.service';
import {
  assertSafeHttpUrl,
  createPinnedPublicLookup,
  resolvePublicHost,
  type DnsLookup,
  type RequestLookup,
} from '../url-safety';

const DEFAULT_MAX_CHARACTERS = 8000;
const HARD_MAX_CHARACTERS = 15000;

let testDnsLookup: DnsLookup | null = null;

interface ReadUrlResult {
  status: 'completed';
  url: string;
  content: string;
  contentLength: number;
  returnedLength: number;
  truncated: boolean;
}

interface ReadablePublicUrl {
  parsedUrl: URL;
  lookup: RequestLookup;
}

export function __setUrlReaderDnsLookupForTests(lookup: DnsLookup | null): void {
  testDnsLookup = lookup;
}

function clampMaxCharacters(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return DEFAULT_MAX_CHARACTERS;
  return Math.max(1000, Math.min(Math.floor(value), HARD_MAX_CHARACTERS));
}

function truncateAtBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentence > maxLength * 0.75) return cut.slice(0, sentence + 1);

  const newline = cut.lastIndexOf('\n');
  if (newline > maxLength * 0.75) return cut.slice(0, newline);

  const space = cut.lastIndexOf(' ');
  return space > maxLength * 0.75 ? cut.slice(0, space) : cut;
}

function normalizeGuardError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`[UrlReader] ValidationError: ${message}`);
}

async function lookupAddresses(hostname: string): ReturnType<DnsLookup> {
  if (testDnsLookup) return testDnsLookup(hostname, { all: true });

  // This tool module is imported by the global registry, which is also reached
  // from client-side bundles. Hide the Node-only import from webpack; execution
  // still happens server-side through the tool manager.
  const importNodeModule = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<typeof import('dns/promises')>;
  const dns = await importNodeModule('dns/promises');
  return dns.lookup(hostname.replace(/^\[|\]$/g, ''), { all: true });
}

async function assertReadablePublicUrl(rawUrl: string): Promise<ReadablePublicUrl> {
  try {
    const parsed = assertSafeHttpUrl(rawUrl);
    const addresses = await resolvePublicHost(parsed.hostname, lookupAddresses);
    return {
      parsedUrl: parsed,
      lookup: createPinnedPublicLookup(parsed.hostname, addresses),
    };
  } catch (error) {
    throw normalizeGuardError(error);
  }
}

const urlReaderTool: ToolDefinition = {
  name: 'read_url',
  description:
    'Read and extract readable text from one specific public web page URL. Use this when the user asks to read, summarize, inspect, or analyze a URL they provided. Do not use this for broad web searches.',
  version: '1.0.0',

  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The public http(s) URL to read.',
      },
      maxCharacters: {
        type: 'number',
        description: 'Optional maximum characters to return, from 1000 to 15000. Defaults to 8000.',
      },
    },
    required: ['url'],
  },

  config: { enabled: urlReaderConfig.enabled },

  async execute(params: Record<string, unknown>): Promise<ReadUrlResult> {
    const rawUrl = typeof params.url === 'string' ? params.url.trim() : '';
    if (!rawUrl) {
      throw new Error('[UrlReader] ValidationError: url is required');
    }

    const { parsedUrl, lookup } = await assertReadablePublicUrl(rawUrl);
    const cleaned = await contentService.fetchAndCleanWithMetadataOrThrow(parsedUrl.toString(), {
      publicOnly: true,
      lookup,
    });
    const content = cleaned.content;

    if (!content.trim()) {
      throw new Error('[UrlReader] ExecutionError: No readable content found at the requested URL');
    }

    const maxCharacters = clampMaxCharacters(params.maxCharacters);
    const boundedContent = truncateAtBoundary(content, maxCharacters);

    return {
      status: 'completed',
      url: parsedUrl.toString(),
      content: boundedContent,
      contentLength: cleaned.originalLength,
      returnedLength: boundedContent.length,
      truncated: cleaned.truncated || boundedContent.length < content.length,
    };
  },
};

export default urlReaderTool;
