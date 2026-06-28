"use client";

import React, { memo, useMemo, useState } from 'react';
import ReactMarkdown, { type Components, type UrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, Check, ChevronDown, Copy } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { copyTextToClipboard } from '@/lib/utils/clipboard';

interface MessageContentProps {
  content: string;
  role: "user" | "assistant";
}

interface ImageWithFallbackProps {
  src: string;
  alt: string;
}

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

function sanitizeMarkdownUrl(value: unknown, kind: 'link' | 'image'): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('#')) {
    return kind === 'link' ? trimmed : undefined;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  const hasExplicitProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
  if (!hasExplicitProtocol) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const allowedProtocols = kind === 'image' ? IMAGE_PROTOCOLS : LINK_PROTOCOLS;
    return allowedProtocols.has(parsed.protocol.toLowerCase()) ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

const safeUrlTransform: UrlTransform = (url, key) => {
  return sanitizeMarkdownUrl(url, key === 'src' ? 'image' : 'link') ?? '';
};

const ImageWithFallback = memo(function ImageWithFallback({ src, alt }: ImageWithFallbackProps) {
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageStatus('loaded');
  };

  const handleError = () => {
    setImageStatus('error');
  };

  if (imageStatus === 'error') {
    return (
      <div className="my-2 p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/30">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load image: {alt}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline break-all"
        >
          {src}
        </a>
      </div>
    );
  }

  return (
    <>
      <div
        className="my-2 relative inline-block max-w-full cursor-pointer hover:opacity-95 transition-opacity"
        onClick={() => setLightboxOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setLightboxOpen(true)}
        aria-label={`View full size: ${alt}`}
      >
        {imageStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`max-w-full h-auto rounded-lg border border-border shadow-sm ${
            imageStatus === 'loading' ? 'opacity-0' : 'opacity-100'
          } transition-opacity duration-200`}
          style={{
            maxHeight: dimensions && dimensions.height > 600 ? '600px' : 'none',
            objectFit: 'contain'
          }}
        />
      </div>

      <ImageLightbox
        src={src}
        alt={alt}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
});

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(code);
    if (!ok) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-gray-950 text-gray-100">
      <div className="flex h-9 items-center justify-between border-b border-gray-800 px-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-300 hover:bg-gray-800 hover:text-white"
          aria-label="Copy code"
          title="Copy code"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6">
        <code className="font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  a({ href, children }) {
    const safeHref = sanitizeMarkdownUrl(href, 'link');
    if (!safeHref) {
      return <span className="break-words">{children}</span>;
    }

    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline decoration-1 underline-offset-2 hover:decoration-2 transition-all break-words"
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    const safeSrc = sanitizeMarkdownUrl(src, 'image');
    if (!safeSrc) {
      return (
        <span className="text-sm text-muted-foreground">
          {alt ? `Image omitted: ${alt}` : 'Image omitted'}
        </span>
      );
    }

    return <ImageWithFallback src={safeSrc} alt={alt || 'Image'} />;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const rawCode = String(children).replace(/\n$/, '');
    const language = /language-([\w-]+)/.exec(className || '')?.[1];
    const isBlock = Boolean(language) || rawCode.includes('\n');

    if (isBlock) {
      return <CodeBlock code={rawCode} language={language} />;
    }

    return (
      <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono border">
        {children}
      </code>
    );
  },
  h1({ children }) {
    return <h1 className="text-2xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h3>;
  },
  p({ children }) {
    return <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>;
  },
  ul({ children }) {
    return <ul className="mb-4 space-y-2 pl-6 list-disc">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-4 space-y-2 pl-6 list-decimal">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed pl-1">{children}</li>;
  },
  table({ children }) {
    return (
      <div className="my-4 max-w-full overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-muted/70">{children}</thead>;
  },
  th({ children }) {
    return <th className="border-b border-border px-3 py-2 text-left font-semibold">{children}</th>;
  },
  td({ children }) {
    return <td className="border-t border-border px-3 py-2 align-top">{children}</td>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-4 border-l-4 border-border pl-4 text-muted-foreground">
        {children}
      </blockquote>
    );
  },
};

interface ParsedContent {
  thinkingBlocks: string[];
  responseContent: string;
}

function parseThinkingBlocks(content: string): ParsedContent {
  const thinkingBlocks: string[] = [];
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/gi;

  let match;
  while ((match = thinkingRegex.exec(content)) !== null) {
    const thinkingContent = match[1].trim();
    if (thinkingContent) {
      thinkingBlocks.push(thinkingContent);
    }
  }

  return {
    thinkingBlocks,
    responseContent: content.replace(thinkingRegex, '').trim()
  };
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
      skipHtml
      urlTransform={safeUrlTransform}
    >
      {content}
    </ReactMarkdown>
  );
}

function ThinkingBlock({ thinkingBlocks }: { thinkingBlocks: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (thinkingBlocks.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-950/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" />
          <span>Model Thinking Process {thinkingBlocks.length > 1 ? `(${thinkingBlocks.length} blocks)` : ''}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-blue-200 dark:border-blue-800 space-y-3">
          {thinkingBlocks.map((block, index) => (
            <div
              key={index}
              className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 rounded p-3"
            >
              {thinkingBlocks.length > 1 && (
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">
                  Thinking Block {index + 1}:
                </div>
              )}
              <MarkdownContent content={block} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const MessageContent = memo(function MessageContent({ content, role }: MessageContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const TRUNCATE_THRESHOLD = 15000;

  const { thinkingBlocks, responseContent } = useMemo(() => {
    return parseThinkingBlocks(content);
  }, [content]);

  const shouldTruncate = responseContent.length > TRUNCATE_THRESHOLD && !isExpanded;
  const displayContent = shouldTruncate
    ? responseContent.substring(0, TRUNCATE_THRESHOLD)
    : responseContent;

  return (
    <div className="text-base">
      {role === 'assistant' && <ThinkingBlock thinkingBlocks={thinkingBlocks} />}

      {displayContent ? <MarkdownContent content={displayContent} /> : null}

      {responseContent.length > TRUNCATE_THRESHOLD && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          {isExpanded
            ? 'Show less'
            : `Show more (${Math.round((responseContent.length - TRUNCATE_THRESHOLD) / 1024)}KB hidden)`
          }
        </button>
      )}
    </div>
  );
});
