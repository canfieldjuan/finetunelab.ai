'use client';

import { Cpu, Zap, Activity } from 'lucide-react';

interface MessageMetadataProps {
  modelName?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

/**
 * Displays metadata for assistant messages including model info,
 * token usage, and response latency.
 */
export function MessageMetadata({
  modelName,
  provider,
  inputTokens,
  outputTokens,
  latencyMs,
}: MessageMetadataProps) {
  // Only display if we have at least one piece of metadata
  const hasMetadata = modelName || inputTokens || outputTokens || latencyMs;
  
  if (!hasMetadata) {
    return null;
  }

  // Format numbers with commas
  const formatNumber = (num: number | undefined) => {
    return num?.toLocaleString() || '0';
  };

  // Format latency in ms or seconds
  const formatLatency = (ms: number | undefined) => {
    if (!ms) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      {/* Model Name */}
      {modelName && (
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5" />
          <span className="font-medium">{modelName}</span>
          {provider && provider !== 'unknown' && (
            <span className="text-muted-foreground/70">({provider})</span>
          )}
        </div>
      )}

      {/* Token Usage */}
      {(inputTokens !== undefined || outputTokens !== undefined) && (
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          <span>
            <span className="text-muted-foreground/70">read:</span> {formatNumber(inputTokens)}
            {' '}
            <span className="text-muted-foreground/70">generated:</span> {formatNumber(outputTokens)}
          </span>
        </div>
      )}

      {/* Response Latency */}
      {latencyMs !== undefined && (
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          <span>{formatLatency(latencyMs)}</span>
        </div>
      )}
    </div>
  );
}
