"use client";

import React, { useMemo, memo, useState, type ReactElement } from 'react';
import { ChevronDown, Brain } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';

interface MessageContentProps {
  content: string;
  role: "user" | "assistant";
}

interface ImageWithFallbackProps {
  src: string;
  alt: string;
}

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
      
      {/* Lightbox Modal */}
      <ImageLightbox 
        src={src} 
        alt={alt} 
        open={lightboxOpen} 
        onOpenChange={setLightboxOpen} 
      />
    </>
  );
});

// CRITICAL: These functions MUST be outside the component to prevent recreation on every render

/**
 * Parse thinking blocks from content
 * Extracts <think>...</think> tags and returns thinking blocks + cleaned response
 */
interface ParsedContent {
  thinkingBlocks: string[];
  responseContent: string;
}

function parseThinkingBlocks(content: string): ParsedContent {
  const thinkingBlocks: string[] = [];

  // Regex to match <think>...</think> (non-greedy, multiline, case-insensitive)
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/gi;

  // Extract all thinking blocks
  let match;
  while ((match = thinkingRegex.exec(content)) !== null) {
    const thinkingContent = match[1].trim();
    if (thinkingContent) {
      thinkingBlocks.push(thinkingContent);
    }
  }

  // Remove thinking blocks from response
  const responseContent = content.replace(thinkingRegex, '').trim();

  return {
    thinkingBlocks,
    responseContent
  };
}

function parseInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;

  while (remaining.length > 0) {
    // Bold text: **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={`bold-${partKey++}`} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic text: *text* or _text_
    const italicMatch = remaining.match(/^[*_]([^*_]+)[*_]/);
    if (italicMatch) {
      parts.push(
        <em key={`italic-${partKey++}`} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={`code-${partKey++}`}
          className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono border"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Markdown images: ![alt](url)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      const altText = imgMatch[1] || 'Image';
      const imgUrl = imgMatch[2];
      parts.push(
        <ImageWithFallback
          key={`img-${partKey++}`}
          src={imgUrl}
          alt={altText}
        />
      );
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // Markdown links: [text](url)
    const mdLinkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (mdLinkMatch) {
      const linkText = mdLinkMatch[1];
      const linkUrl = mdLinkMatch[2];
      parts.push(
        <a
          key={`link-${partKey++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline decoration-1 underline-offset-2 hover:decoration-2 transition-all break-words"
        >
          {linkText}
        </a>
      );
      remaining = remaining.slice(mdLinkMatch[0].length);
      continue;
    }

    // URLs: https://... or http://...
    const urlMatch = remaining.match(/^(https?:\/\/[^\s<>)"']+)/);
    if (urlMatch) {
      const url = urlMatch[1];
      parts.push(
        <a
          key={`link-${partKey++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline decoration-1 underline-offset-2 hover:decoration-2 transition-all break-all"
        >
          {url}
        </a>
      );
      remaining = remaining.slice(url.length);
      continue;
    }

    // Regular text - if we get here, no patterns matched at the start
    // If there's a special char at position 0 that didn't match, consume it as text
    const nextSpecial = remaining.search(/[*_`!\[]|https?:\/\//);
    if (nextSpecial === 0) {
      // Special char at start but no pattern matched - consume 1 char as text
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      // No special char at start, or special char found later
      const chunk = nextSpecial === -1 ? remaining : remaining.slice(0, nextSpecial);
      if (chunk) {
        parts.push(chunk);
      }
      remaining = nextSpecial === -1 ? '' : remaining.slice(nextSpecial);
    }
  }

  return parts.length > 0 ? parts : text;
}

function parseMarkdown(text: string): ReactElement[] {
  const lines = text.split('\n');
  const elements: ReactElement[] = [];
  let currentListItems: string[] = [];
  let listType: 'ol' | 'ul' | null = null;
  let key = 0;

  const flushList = () => {
    if (currentListItems.length > 0 && listType) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`list-${key++}`} className="mb-4 space-y-2 pl-6" style={{ counterReset: 'list-counter', listStyle: 'none' }}>
            {currentListItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed" style={{ counterIncrement: 'list-counter', display: 'flex' }}>
                <span style={{ minWidth: '1.5em', fontWeight: 500 }}>{idx + 1}.</span>
                <span className="flex-1">{parseInlineMarkdown(item)}</span>
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`list-${key++}`} className="mb-4 space-y-2 pl-6">
            {currentListItems.map((item, idx) => (
              <li key={idx} className="leading-relaxed flex">
                <span className="mr-2" style={{ minWidth: '1em' }}>•</span>
                <span className="flex-1">{parseInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        );
      }
      currentListItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Numbered list: 1. item or 1) item (can be on same line or next line)
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s*(.*)$/);
    if (numberedMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      // If content is empty, check next line
      let content = numberedMatch[2].trim();
      if (!content && i + 1 < lines.length) {
        content = lines[++i].trim();
      }
      if (content) {
        currentListItems.push(content);
      }
      continue;
    }

    // Bullet list: - item or * item (can be on same line or next line)
    const bulletMatch = trimmed.match(/^[-*]\s*(.*)$/);
    if (bulletMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      // If content is empty, check next line
      let content = bulletMatch[1].trim();
      if (!content && i + 1 < lines.length) {
        content = lines[++i].trim();
      }
      if (content) {
        currentListItems.push(content);
      }
      continue;
    }

    // Flush list if we hit non-list line
    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<br key={`br-${key++}`} />);
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) {
        elements.push(
          <h1 key={`h-${key++}`} className="text-2xl font-bold mb-3 mt-4 first:mt-0">
            {parseInlineMarkdown(text)}
          </h1>
        );
      } else if (level === 2) {
        elements.push(
          <h2 key={`h-${key++}`} className="text-xl font-bold mb-3 mt-4 first:mt-0">
            {parseInlineMarkdown(text)}
          </h2>
        );
      } else {
        elements.push(
          <h3 key={`h-${key++}`} className="text-lg font-semibold mb-2 mt-3 first:mt-0">
            {parseInlineMarkdown(text)}
          </h3>
        );
      }
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${key++}`} className="mb-4 last:mb-0 leading-relaxed">
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  }

  // Flush any remaining list
  flushList();

  return elements;
}

/**
 * ThinkingBlock component - displays model thinking/reasoning in collapsible UI
 */
interface ThinkingBlockProps {
  thinkingBlocks: string[];
}

function ThinkingBlock({ thinkingBlocks }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (thinkingBlocks.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-950/20">
      {/* Header - Always Visible */}
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

      {/* Thinking Content - Collapsible */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-blue-200 dark:border-blue-800 space-y-3">
          {thinkingBlocks.map((block, index) => (
            <div
              key={index}
              className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 rounded p-3 font-mono whitespace-pre-wrap"
            >
              {thinkingBlocks.length > 1 && (
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">
                  Thinking Block {index + 1}:
                </div>
              )}
              {parseMarkdown(block)}
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

  // Parse thinking blocks FIRST (before markdown parsing)
  const { thinkingBlocks, responseContent } = useMemo(() => {
    return parseThinkingBlocks(content);
  }, [content]);

  // Apply truncation to response content (not thinking blocks)
  const shouldTruncate = responseContent.length > TRUNCATE_THRESHOLD && !isExpanded;
  const displayContent = shouldTruncate
    ? responseContent.substring(0, TRUNCATE_THRESHOLD)
    : responseContent;

  // CRITICAL: useMemo dependency is ONLY displayContent - the parseMarkdown function is stable
  const parsedContent = useMemo(() => {
    return parseMarkdown(displayContent);
  }, [displayContent]);

  return (
    <div className="text-base">
      {/* Show thinking block ONLY for assistant messages */}
      {role === 'assistant' && <ThinkingBlock thinkingBlocks={thinkingBlocks} />}

      {/* Main response content */}
      {parsedContent}

      {/* Truncation toggle */}
      {responseContent.length > TRUNCATE_THRESHOLD && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          {isExpanded
            ? '▲ Show less'
            : `▼ Show more (${Math.round((responseContent.length - TRUNCATE_THRESHOLD) / 1024)}KB hidden)`
          }
        </button>
      )}
    </div>
  );
});
