'use client';

import React from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScrollToBottomButtonProps {
  onClick: () => void;
  show: boolean;
}

/**
 * Floating scroll-to-bottom button that appears when user scrolls up
 * ChatGPT/Claude style - positioned above the input box
 * Uses fixed positioning to stay in place while scrolling
 * Centered within the chat content area (accounts for sidebar offset)
 */
export function ScrollToBottomButton({ onClick, show }: ScrollToBottomButtonProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-32 left-64 right-0 z-50 pointer-events-none">
      <div className="max-w-4xl mx-auto flex justify-center">
        <Button
          onClick={onClick}
          size="sm"
          variant="secondary"
          className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border pointer-events-auto"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
          <span className="text-sm font-medium">Scroll to bottom</span>
        </Button>
      </div>
    </div>
  );
}
