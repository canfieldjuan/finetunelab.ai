"use client";

import React, { useMemo, memo, useState, type ReactElement } from 'react';

interface MessageContentProps {
  content: string;
  role: "user" | "assistant";
}

export const MessageContent = memo(function MessageContent({ content, role }: MessageContentProps) {
  // Truncation state
  const [isExpanded, setIsExpanded] = useState(false);
  const TRUNCATE_THRESHOLD = 15000; // 15KB
  const shouldTruncate = content.length > TRUNCATE_THRESHOLD && !isExpanded;
  const displayContent = shouldTruncate
    ? content.substring(0, TRUNCATE_THRESHOLD)
    : content;

  // Simple markdown parser for common patterns
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: ReactElement[] = [];
    let currentListItems: string[] = [];
    let listType: 'ol' | 'ul' | null = null;
    let key = 0;

    const flushList = () => {
      if (currentListItems.length > 0 && listType) {
        if (listType === 'ol') {
          elements.push(
            <ol key={`list-${key++}`} className="list-decimal list-outside ml-6 mb-4 space-y-2">
              {currentListItems.map((item, idx) => (
                <li key={idx} className="leading-relaxed pl-1">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ol>
          );
        } else {
          elements.push(
            <ul key={`list-${key++}`} className="list-disc list-outside ml-6 mb-4 space-y-2">
              {currentListItems.map((item, idx) => (
                <li key={idx} className="leading-relaxed pl-1">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        }
        currentListItems = [];
        listType = null;
      }
    };

    const parseInlineMarkdown = (text: string): React.ReactNode => {
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

        // Regular text
        const nextSpecial = remaining.search(/[*_`\[]|https?:\/\//);
        const chunk = nextSpecial === -1 ? remaining : remaining.slice(0, nextSpecial);
        if (chunk) {
          parts.push(chunk);
        }
        remaining = nextSpecial === -1 ? '' : remaining.slice(nextSpecial);
      }

      return parts.length > 0 ? parts : text;
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Numbered list: 1. item or 1) item
      const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
      if (numberedMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        currentListItems.push(numberedMatch[2]);
        continue;
      }

      // Bullet list: - item or * item
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
      if (bulletMatch) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        currentListItems.push(bulletMatch[1]);
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
  };

  // Memoize parsed content to avoid re-parsing on every render during streaming
  const parsedContent = useMemo(() => {
    return parseMarkdown(displayContent);
  }, [displayContent]);

  return (
    <div className="text-base">
      {parsedContent}
      {content.length > TRUNCATE_THRESHOLD && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          {isExpanded
            ? '▲ Show less'
            : `▼ Show more (${Math.round((content.length - TRUNCATE_THRESHOLD) / 1024)}KB hidden)`
          }
        </button>
      )}
    </div>
  );
});
