'use client';

import { useEffect } from 'react';
import '@/lib/utils/logger'; // Import to trigger global initialization

/**
 * Logger Initialization Component
 * 
 * This component ensures the logger is loaded and available globally
 * as `__logger` in the browser console for debugging.
 * 
 * Usage: Include in root layout or any page that needs logger diagnostics.
 */
export function LoggerInit() {
  useEffect(() => {
    // The logger is initialized on import, this just confirms it
    if (typeof window !== 'undefined') {
      const win = window as Window & { __logger?: unknown };
      if (win.__logger) {
        console.log('✅ Logger initialized. Type __logger.help() for commands');
      } else {
        console.warn('⚠️ Logger not initialized. Check for import errors.');
      }

      // Also log that the page loaded successfully
      console.log('✅ Page loaded successfully at', new Date().toISOString());
    }
  }, []);

  return null; // This component renders nothing
}
