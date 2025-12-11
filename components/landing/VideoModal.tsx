"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play } from "lucide-react";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
  title?: string;
  description?: string;
}

function extractScribeUrl(htmlOrUrl: string): string {
  if (htmlOrUrl.includes('<iframe')) {
    const match = htmlOrUrl.match(/src=["']([^"']+)["']/);
    return match ? match[1] : '';
  }
  return htmlOrUrl;
}

export function VideoModal({
  isOpen,
  onClose,
  videoUrl = "",
  title = "Watch Demo",
  description = "Learn how Fine Tune Lab works",
}: VideoModalProps) {
  console.log("[VideoModal] Rendered with:", { isOpen, videoUrl });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Play className="w-6 h-6 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {videoUrl ? (
            <div className="relative w-full bg-black rounded-lg overflow-hidden">
              {/* Check if it's a scribe.ai embed or regular video URL */}
              {videoUrl.includes('scribehow.com') ? (
                /* Scribe.ai embed - extract src from iframe */
                <iframe
                  src={extractScribeUrl(videoUrl)}
                  className="w-full"
                  style={{ aspectRatio: '16/9' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : videoUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                /* Direct video file */
                <video
                  controls
                  autoPlay
                  className="w-full"
                  style={{ aspectRatio: '16/9' }}
                >
                  <source src={videoUrl} type={`video/${videoUrl.split('.').pop()}`} />
                  Your browser does not support the video tag.
                </video>
              ) : videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
                /* YouTube embed */
                <iframe
                  src={videoUrl.replace('watch?v=', 'embed/')}
                  className="w-full"
                  style={{ aspectRatio: '16/9' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  frameBorder="0"
                />
              ) : (
                /* Generic iframe embed */
                <iframe
                  src={videoUrl}
                  className="w-full"
                  style={{ aspectRatio: '16/9' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  frameBorder="0"
                />
              )}
            </div>
          ) : (
            /* Placeholder when no video URL is set */
            <div
              className="w-full bg-muted rounded-lg flex flex-col items-center justify-center gap-4 py-20"
              style={{ aspectRatio: '16/9' }}
            >
              <Play className="w-16 h-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-muted-foreground">
                  Video Coming Soon
                </p>
                <p className="text-sm text-muted-foreground max-w-md">
                  We&apos;re creating tutorial videos with scribe.ai. Check back soon for comprehensive guides on using Fine Tune Lab.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
