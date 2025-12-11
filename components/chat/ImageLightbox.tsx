"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';
import { X, Download, Copy, ExternalLink, Check } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ImageLightbox component - Full-screen image viewer modal
 * 
 * Features (Phase 1 & 2):
 * - Click-to-enlarge images from chat
 * - ESC key to close (built-in Radix Dialog)
 * - Click overlay to close
 * - Download image
 * - Copy image URL to clipboard
 * - Open image in new tab
 * - Accessible (ARIA labels, keyboard navigation)
 * - Dark theme optimized
 * 
 * Future enhancements (Phase 3+):
 * - Gallery mode (next/prev)
 * - Zoom and pan
 */
export function ImageLightbox({ src, alt, open, onOpenChange }: ImageLightboxProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  // Handle download button click
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = alt || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle copy URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // Handle open in new tab
  const handleOpenInNewTab = () => {
    window.open(src, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/90" />
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 border-0 bg-transparent shadow-none"
        aria-describedby="lightbox-image"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 rounded-full p-2 bg-black/50 hover:bg-black/70 text-white transition-colors"
          aria-label="Close image viewer"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Action buttons */}
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          {/* Download button */}
          <button
            onClick={handleDownload}
            className="rounded-full p-2 bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Download image"
            title="Download image"
          >
            <Download className="h-5 w-5" />
          </button>

          {/* Copy URL button */}
          <button
            onClick={handleCopyUrl}
            className="rounded-full p-2 bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Copy image URL"
            title={copySuccess ? "Copied!" : "Copy image URL"}
          >
            {copySuccess ? (
              <Check className="h-5 w-5 text-green-400" />
            ) : (
              <Copy className="h-5 w-5" />
            )}
          </button>

          {/* Open in new tab button */}
          <button
            onClick={handleOpenInNewTab}
            className="rounded-full p-2 bg-black/50 hover:bg-black/70 text-white transition-colors"
            aria-label="Open image in new tab"
            title="Open image in new tab"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
        </div>

        {/* Image container */}
        <div 
          className="flex items-center justify-center w-full h-full"
          onClick={(e) => {
            // Close on overlay click, not image click
            if (e.target === e.currentTarget) {
              onOpenChange(false);
            }
          }}
        >
          <img
            src={src}
            alt={alt}
            id="lightbox-image"
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
            style={{ 
              margin: 'auto',
              display: 'block'
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
