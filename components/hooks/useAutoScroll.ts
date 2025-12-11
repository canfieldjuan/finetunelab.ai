import { useState, useEffect, useCallback, RefObject } from 'react';

/**
 * Hook to manage scroll-to-bottom behavior with sticky auto-scroll during streaming
 * Implements ChatGPT/Claude-style UX:
 * - Auto-scrolls during AI responses by default
 * - Stops auto-scrolling if user manually scrolls up
 * - Shows "scroll to bottom" button when not at bottom
 * - Resumes auto-scroll when button is clicked
 */
export function useAutoScroll(
  messagesContainerRef: RefObject<HTMLDivElement | null>,
  isStreaming: boolean,
  messagesLength: number
) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  /**
   * Check if the container is scrolled to bottom (with small threshold)
   */
  const isAtBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 100; // 100px threshold
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  }, [messagesContainerRef]);

  /**
   * Scroll to bottom smoothly
   */
  const scrollToBottom = useCallback((smooth = true) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });

    setUserHasScrolledUp(false);
    setShowScrollButton(false);
  }, [messagesContainerRef]);

  /**
   * Handle manual scroll by user
   */
  const handleScroll = useCallback(() => {
    const atBottom = isAtBottom();
    
    // If user scrolled to bottom, resume auto-scroll
    if (atBottom) {
      setUserHasScrolledUp(false);
      setShowScrollButton(false);
    } else {
      // User is not at bottom
      setUserHasScrolledUp(true);
      setShowScrollButton(true);
    }
  }, [isAtBottom]);

  /**
   * Auto-scroll during streaming if user hasn't scrolled up
   */
  useEffect(() => {
    if (isStreaming && !userHasScrolledUp) {
      // Instant scroll during streaming (not smooth to keep up with rapid updates)
      scrollToBottom(false);
    }
  }, [isStreaming, messagesLength, userHasScrolledUp, scrollToBottom]);

  /**
   * Auto-scroll when new message arrives (not streaming)
   */
  useEffect(() => {
    if (!isStreaming && messagesLength > 0 && !userHasScrolledUp) {
      // Smooth scroll for new messages
      scrollToBottom(true);
    }
  }, [messagesLength, isStreaming, userHasScrolledUp, scrollToBottom]);

  /**
   * Attach scroll listener
   */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [messagesContainerRef, handleScroll]);

  return {
    showScrollButton,
    scrollToBottom,
    isAtBottom: isAtBottom()
  };
}
